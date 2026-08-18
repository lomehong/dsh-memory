/**
 * 共享记忆 HTTP API
 *
 * 提供 RESTful API 供设置页面查看和管理共享记忆。
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadSharedMemory, clearSharedMemory, addMemoryEntry, updateMemoryEntry, deleteMemoryEntry, pruneExpiredMemories } from './memory-store.ts'
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

/** 获取错误信息 */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 注册共享记忆 API 路由 */
export function registerMemoryApi(web: {
  register: (route: { kind: string; path: string; handler: (req: unknown, res: unknown) => void }) => void
}): void {
  // GET /dsh-memory - 管理页面
  web.register({
    kind: 'exact',
    path: '/dsh-memory',
    handler: (_req: unknown, res: unknown) => {
      serveAdminPage(res as ServerResponse)
    },
  })
  // GET /dsh-memory/entries - 获取所有记忆（用于管理页面）
  web.register({
    kind: 'exact',
    path: '/dsh-memory/entries',
    handler: (_req: unknown, res: unknown) => {
      try {
        const entries = loadSharedMemory()
        respondJson(res as ServerResponse, 200, { ok: true, entries, total: entries.length })
      } catch (error) {
        respondJson(res as ServerResponse, 500, { ok: false, error: messageOf(error) })
      }
    },
  })

  // POST /dsh-memory/entries - 添加记忆（管理页面手动添加）
  web.register({
    kind: 'exact',
    path: '/dsh-memory/entries',
    handler: async (req: unknown, res: unknown) => {
      try {
        const body = await readJsonBody(req as IncomingMessage) as { content?: string; type?: string; scope?: string; participants?: string[] }
        if (typeof body.content !== 'string' || !body.content.trim()) {
          respondJson(res as ServerResponse, 400, { ok: false, error: '需要 content' })
          return
        }
        const participants = Array.isArray(body.participants) ? body.participants.filter((p): p is string => typeof p === 'string') : undefined
        const entry = addMemoryEntry({
          content: body.content.trim(),
          type: typeof body.type === 'string' ? body.type : 'note',
          scope: (body.scope === 'master' || body.scope === 'self' || body.scope === 'public') ? body.scope : 'master',
          author: 'admin',
          authorRole: 'master',
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
    },
  })

  // POST /dsh-memory/clear - 清除所有记忆
  web.register({
    kind: 'exact',
    path: '/dsh-memory/clear',
    handler: (_req: unknown, res: unknown) => {
      try {
        const ok = clearSharedMemory()
        respondJson(res as ServerResponse, 200, { ok })
      } catch (error) {
        respondJson(res as ServerResponse, 500, { ok: false, error: messageOf(error) })
      }
    },
  })

  // POST /dsh-memory/entries/update - 更新一条记忆
  web.register({
    kind: 'exact',
    path: '/dsh-memory/entries/update',
    handler: async (req: unknown, res: unknown) => {
      try {
        const body = await readJsonBody(req as IncomingMessage) as { id?: string; content?: string; scope?: string; participants?: string[] }
        if (typeof body.id !== 'string' || !body.id) {
          respondJson(res as ServerResponse, 400, { ok: false, error: '需要 id' })
          return
        }
        const updates: { content?: string; scope?: 'master' | 'self' | 'public'; participants?: string[] } = {}
        if (typeof body.content === 'string') updates.content = body.content
        if (typeof body.scope === 'string' && ['master', 'self', 'public'].includes(body.scope)) {
          updates.scope = body.scope as 'master' | 'self' | 'public'
        }
        if (Array.isArray(body.participants)) {
          updates.participants = body.participants.filter((p): p is string => typeof p === 'string')
        }
        const result = updateMemoryEntry(body.id, updates)
        if (result === null) {
          respondJson(res as ServerResponse, 404, { ok: false, error: '未找到该记忆' })
        } else {
          respondJson(res as ServerResponse, 200, { ok: true, entry: result })
        }
      } catch (error) {
        respondJson(res as ServerResponse, 500, { ok: false, error: messageOf(error) })
      }
    },
  })

  // POST /dsh-memory/entries/delete - 删除一条记忆
  web.register({
    kind: 'exact',
    path: '/dsh-memory/entries/delete',
    handler: async (req: unknown, res: unknown) => {
      try {
        const body = await readJsonBody(req as IncomingMessage) as { id?: string }
        if (typeof body.id !== 'string' || !body.id) {
          respondJson(res as ServerResponse, 400, { ok: false, error: '需要 id' })
          return
        }
        const ok = deleteMemoryEntry(body.id)
        respondJson(res as ServerResponse, ok ? 200 : 404, { ok })
      } catch (error) {
        respondJson(res as ServerResponse, 500, { ok: false, error: messageOf(error) })
      }
    },
  })

  // POST /dsh-memory/prune - 清除过期记忆
  web.register({
    kind: 'exact',
    path: '/dsh-memory/prune',
    handler: (_req: unknown, res: unknown) => {
      try {
        const count = pruneExpiredMemories()
        respondJson(res as ServerResponse, 200, { ok: true, pruned: count })
      } catch (error) {
        respondJson(res as ServerResponse, 500, { ok: false, error: messageOf(error) })
      }
    },
  })
}