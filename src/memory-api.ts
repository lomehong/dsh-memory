/**
 * 共享记忆 HTTP API
 *
 * 提供 RESTful API 供设置页面查看和管理共享记忆。
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomBytes } from 'node:crypto'
import { loadSharedMemory, loadArchivedMemories, clearSharedMemory, addMemoryEntry, updateMemoryEntry, deleteMemoryEntry, archiveMemoryEntry, pruneExpiredMemories, STATEMENT_TYPES, effectiveStatementType } from './memory-store.ts'
import type { MemorySource, MemoryAuth, MemoryVerify, StatementType } from './memory-store.ts'
import { serveAdminPage } from './memory-admin-page.ts'

/** 读取请求体 JSON */
function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    req.on('data', (chunk: Uint8Array) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const all = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0))
        let offset = 0
        for (const c of chunks) { all.set(c, offset); offset += c.length }
        resolve(JSON.parse(new TextDecoder().decode(all)) as Record<string, unknown>)
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

/** 返回 JSON 响应 */
function respondJson(res: ServerResponse, status: number, data: Record<string, unknown>): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

/** 校验写操作的自定义请求头 token（跨域表单/脚本无法携带自定义头，因此同时起到 CSRF 防护作用） */
function hasAdminToken(req: IncomingMessage, token: string): boolean {
  return req.headers['x-memory-token'] === token
}

/** 拒绝未通过 token 校验的写请求 */
function unauthorized(res: ServerResponse): void {
  respondJson(res, 401, { ok: false, error: '缺少或无效的校验 token（x-memory-token）' })
}

/** 获取错误信息 */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 注册共享记忆 API 路由；返回写门禁 token（供同插件其他 HTTP 面复用同一门禁）。 */
export function registerMemoryApi(web: {
  register: (route: { kind: string; path: string; handler: (req: unknown, res: unknown) => void }) => void
}): { token: string } {
  // 写操作统一由启动时随机生成的 token 门禁：外部扫描器/跨站请求无法携带该自定义头。
  // 待 DSH webServer 未来在请求上携带会话身份后，应升级为真正的用户级鉴权。
  const adminToken = randomBytes(16).toString('hex')

  // 同源门禁（安全加固）：带 Origin 且与 Host 不一致的跨源请求一律 403——
  // 覆盖 token 下发与全部读写路由；无 Origin（同源导航/宿主内调用）放行。
  const sameOrigin = (req: IncomingMessage): boolean => {
    const origin = req.headers.origin
    if (origin === undefined) return true
    const host = req.headers.host
    if (typeof host !== 'string') return false
    try { return new URL(String(origin)).host === host } catch { return false }
  }
  const register = (route: { kind: string; path: string; handler: (req: unknown, res: unknown) => void | Promise<void> }): void => {
    // 修复（自递归事故）：此处必须调用宿主的 web.register——曾经写成 register(自身)
    // 导致无限递归、首条路由注册即栈溢出（被上层吞掉），/dsh-memory/* 全部 404。
    web.register({
      kind: route.kind,
      path: route.path,
      handler: (req: unknown, res: unknown) => {
        if (!sameOrigin(req as IncomingMessage)) {
          respondJson(res as ServerResponse, 403, { ok: false, error: 'cross-origin denied' })
          return
        }
        void route.handler(req, res)
      },
    })
  }

  // GET /dsh-memory - 管理页面
  register({
    kind: 'exact',
    path: '/dsh-memory',
    handler: (_req: unknown, res: unknown) => {
      serveAdminPage(res as ServerResponse, adminToken)
    },
  })

  // GET /dsh-memory/token - 下发写操作校验 token（供对话 Tab 等内置客户端使用）
  register({
    kind: 'exact',
    path: '/dsh-memory/token',
    handler: (_req: unknown, res: unknown) => {
      respondJson(res as ServerResponse, 200, { ok: true, token: adminToken })
    },
  })

  // /dsh-memory/entries - 单一路由按方法分发（GET 列表 / POST 新增）。
  // 修复：同 path 用 kind:'exact' 注册两次会让 webServer 冲突、导致清除/更新/删除/清理等后续路由全部注册失败。
  // 注意：当前 DSH webServer 未在请求上附带用户身份，此处返回全部条目；待身份可用后应做按身份的权限过滤。
  register({
    kind: 'exact',
    path: '/dsh-memory/entries',
    handler: async (req: unknown, res: unknown) => {
      if (req && typeof req === 'object' && (req as IncomingMessage).method === 'POST') {
        if (!hasAdminToken(req as IncomingMessage, adminToken)) {
          unauthorized(res as ServerResponse)
          return
        }
        try {
          const body = await readJsonBody(req as IncomingMessage) as {
            content?: string; type?: string; scope?: string; participants?: string[]
            statementType?: string; source?: Partial<MemorySource>; auth?: Partial<MemoryAuth>; verify?: Partial<MemoryVerify>
          }
          if (typeof body.content !== 'string' || !body.content.trim()) {
            respondJson(res as ServerResponse, 400, { ok: false, error: '需要 content' })
            return
          }
          const participants = Array.isArray(body.participants) ? body.participants.filter((p): p is string => typeof p === 'string') : undefined
          // 管理页写入=主人代笔：默认 事实 + api 归因
          const statementType = typeof body.statementType === 'string' && (STATEMENT_TYPES as readonly string[]).includes(body.statementType)
            ? body.statementType as StatementType
            : '事实'
          const source: MemorySource = {
            origin: (typeof body.source?.origin === 'string' ? body.source.origin : 'api') as MemorySource['origin'],
            ...(typeof body.source?.ref === 'string' ? { ref: body.source.ref } : {}),
            ...(body.source?.hubEndorsed === true ? { hubEndorsed: true } : {}),
          }
          const entry = await addMemoryEntry({
            content: body.content.trim(),
            type: typeof body.type === 'string' ? body.type : 'note',
            scope: (body.scope === 'master' || body.scope === 'self' || body.scope === 'public') ? body.scope : 'master',
            author: 'admin',
            authorRole: 'master',
            statementType,
            source,
            ...(body.auth !== undefined ? { auth: body.auth as MemoryAuth } : {}),
            ...(body.verify !== undefined ? { verify: body.verify as MemoryVerify } : {}),
            ...(participants !== undefined ? { participants } : {}),
          })
          if (entry === null) {
            respondJson(res as ServerResponse, 500, { ok: false, error: '写入失败（并发冲突）' })
          } else {
            respondJson(res as ServerResponse, 200, { ok: true, entry })
          }
        } catch (error) {
          respondJson(res as ServerResponse, 500, { ok: false, error: messageOf(error) })
        }
        return
      }
      try {
        const entries = loadSharedMemory()
        respondJson(res as ServerResponse, 200, { ok: true, entries, total: entries.length })
      } catch (error) {
        respondJson(res as ServerResponse, 500, { ok: false, error: messageOf(error) })
      }
    },
  })

  // POST /dsh-memory/clear - 清除所有记忆
  register({
    kind: 'exact',
    path: '/dsh-memory/clear',
    handler: async (_req: unknown, res: unknown) => {
      if (!hasAdminToken(_req as IncomingMessage, adminToken)) {
        unauthorized(res as ServerResponse)
        return
      }
      try {
        const ok = await clearSharedMemory()
        respondJson(res as ServerResponse, 200, { ok })
      } catch (error) {
        respondJson(res as ServerResponse, 500, { ok: false, error: messageOf(error) })
      }
    },
  })

  // POST /dsh-memory/entries/update - 更新一条记忆
  register({
    kind: 'exact',
    path: '/dsh-memory/entries/update',
    handler: async (req: unknown, res: unknown) => {
      if (!hasAdminToken(req as IncomingMessage, adminToken)) {
        unauthorized(res as ServerResponse)
        return
      }
      try {
        const body = await readJsonBody(req as IncomingMessage) as {
          id?: string; content?: string; scope?: string; participants?: string[]; statementType?: string
        }
        if (typeof body.id !== 'string' || !body.id) {
          respondJson(res as ServerResponse, 400, { ok: false, error: '需要 id' })
          return
        }
        const updates: Parameters<typeof updateMemoryEntry>[1] = {}
        if (typeof body.content === 'string') updates.content = body.content
        if (typeof body.statementType === 'string' && (STATEMENT_TYPES as readonly string[]).includes(body.statementType)) {
          updates.statementType = body.statementType as StatementType
        }
        if (typeof body.scope === 'string' && ['master', 'self', 'public'].includes(body.scope)) {
          updates.scope = body.scope as 'master' | 'self' | 'public'
        }
        if (Array.isArray(body.participants)) {
          updates.participants = body.participants.filter((p): p is string => typeof p === 'string')
        }
        // 管理页修订者记为 admin/master；陈述类变更走替代链
        const result = await updateMemoryEntry(body.id, updates, { author: 'admin', authorRole: 'master' })
        if (result === null) {
          respondJson(res as ServerResponse, 404, { ok: false, error: '未找到该记忆' })
        } else {
          const superseded = result.lifecycle?.supersedes
          respondJson(res as ServerResponse, 200, {
            ok: true,
            entry: result,
            mode: superseded !== undefined ? '替代（历史保留）' : '原地',
            ...(superseded !== undefined ? { superseded } : {}),
            statementType: effectiveStatementType(result),
          })
        }
      } catch (error) {
        respondJson(res as ServerResponse, 500, { ok: false, error: messageOf(error) })
      }
    },
  })

  // POST /dsh-memory/entries/delete - 删除一条记忆
  register({
    kind: 'exact',
    path: '/dsh-memory/entries/delete',
    handler: async (req: unknown, res: unknown) => {
      if (!hasAdminToken(req as IncomingMessage, adminToken)) {
        unauthorized(res as ServerResponse)
        return
      }
      try {
        const body = await readJsonBody(req as IncomingMessage) as { id?: string }
        if (typeof body.id !== 'string' || !body.id) {
          respondJson(res as ServerResponse, 400, { ok: false, error: '需要 id' })
          return
        }
        const ok = await deleteMemoryEntry(body.id)
        respondJson(res as ServerResponse, ok ? 200 : 404, { ok })
      } catch (error) {
        respondJson(res as ServerResponse, 500, { ok: false, error: messageOf(error) })
      }
    },
  })

  // GET /dsh-memory/archive - 归档区列表（管理页为主人视图，不做按用户过滤）
  register({
    kind: 'exact',
    path: '/dsh-memory/archive',
    handler: (_req: unknown, res: unknown) => {
      try {
        const entries = loadArchivedMemories()
        respondJson(res as ServerResponse, 200, { ok: true, entries, total: entries.length })
      } catch (error) {
        respondJson(res as ServerResponse, 500, { ok: false, error: messageOf(error) })
      }
    },
  })

  // POST /dsh-memory/entries/archive - 手动归档一条活跃记忆（不删除，可查回）
  register({
    kind: 'exact',
    path: '/dsh-memory/entries/archive',
    handler: async (req: unknown, res: unknown) => {
      if (!hasAdminToken(req as IncomingMessage, adminToken)) {
        unauthorized(res as ServerResponse)
        return
      }
      try {
        const body = await readJsonBody(req as IncomingMessage) as { id?: string }
        if (typeof body.id !== 'string' || !body.id) {
          respondJson(res as ServerResponse, 400, { ok: false, error: '需要 id' })
          return
        }
        const ok = await archiveMemoryEntry(body.id)
        respondJson(res as ServerResponse, ok ? 200 : 404, { ok })
      } catch (error) {
        respondJson(res as ServerResponse, 500, { ok: false, error: messageOf(error) })
      }
    },
  })

  // POST /dsh-memory/prune - 清除过期记忆
  register({
    kind: 'exact',
    path: '/dsh-memory/prune',
    handler: async (_req: unknown, res: unknown) => {
      if (!hasAdminToken(_req as IncomingMessage, adminToken)) {
        unauthorized(res as ServerResponse)
        return
      }
      try {
        const count = await pruneExpiredMemories()
        respondJson(res as ServerResponse, 200, { ok: true, pruned: count })
      } catch (error) {
        respondJson(res as ServerResponse, 500, { ok: false, error: messageOf(error) })
      }
    },
  })

  return { token: adminToken }
}