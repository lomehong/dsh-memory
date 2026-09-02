/**
 * 共享记忆 DSH 工具定义（v2：认识论参数 + 读取过滤 + 替代式更新）
 *
 * 注册工具到 DSH agent：
 *   - memory_write：写入记忆（含陈述类型 / 来源归因 / 授权 / 验证）
 *   - memory_read：读取记忆（自动按权限过滤，默认仅当前条目）
 *   - memory_update / memory_delete（仅主人；陈述类变更走替代链）
 *
 * 治理语义见 docs/决策记忆治理-设计.md：写入默认值即治理——
 * 主人亲述默认「事实」，访客与外部消息默认「候选」，来源登记 ≠ 事实晋升。
 */
import type { Context } from '@deepseek-ai/cordis'
import type { JsonValue } from '@deepseek-ai/dsh-session'
import {
  addMemoryEntry,
  loadSharedMemory,
  loadArchivedMemories,
  filterMemoriesByUser,
  filterMemoriesForRead,
  searchMemories,
  updateMemoryEntry,
  deleteMemoryEntry,
  effectiveStatementType,
  effectiveLifecycle,
  STATEMENT_TYPES,
} from './memory-store.ts'
import type { StatementType, MemorySource, MemoryAuth, MemoryVerify } from './memory-store.ts'
import { defineTool } from '@deepseek-ai/dsh-tools'

const AUTH_STATUSES = ['未授权', '已授权', '已拒绝'] as const
const SOURCE_ORIGINS = ['seed', 'conversation', 'yuyi_message', 'tool_result', 'human', 'api'] as const

/** 渲染 JSON 结果为文本 */
function renderJson(_args: unknown, value: JsonValue): Array<{ type: string; text: string }> {
  const text = typeof value === 'object' && value !== null
    ? JSON.stringify(value, null, 2)
    : String(value ?? '')
  return [{ type: 'text' as const, text }]
}

/** 注册共享记忆工具到 agent 上下文 */
export function registerMemoryTools(
  agentCtx: Context,
  userId: string,
  isMaster: boolean,
): void {
  // memory_write 工具
  const writeTool = defineTool({
    name: 'memory_write',
    description: '写入一条共享记忆，让其他会话（包括访客）也能知道这件事。重要：如果创建了日程、待办或涉及其他人（如会议参与者），请务必在 participants 参数中传入他们的 userid，他们即可读到这条记忆。主人写入默认仅主人可见；访客写入默认对主人、作者本人和参与者可见（访客不可写 master 范围）。陈述类型默认：主人=事实、访客=候选——转述他人或御驿消息的内容请显式传 statementType=候选 并附来源，不要把听说写成事实；记录主人对某个行动的批准时传 statementType=授权 并填 auth 字段。',
    parameters: {
      content: { type: 'string', required: true, description: '记忆内容，简洁清晰地描述发生了什么' },
      type: { type: 'string', description: '记忆类型：schedule_created/todo_created/decision/note/conversation_summary，默认 note' },
      statementType: { type: 'string', description: '陈述类型：事实/推断/偏好/候选/授权/已验证结果。默认主人=事实、访客=候选。转述御驿消息=候选；主人批准某行动=授权；附验证依据的结论=已验证结果' },
      scope: { type: 'string', description: `可见范围：master=仅主人可见${isMaster ? '' : '（仅主人可用）'}, self=主人+作者+参与者, public=所有人可见，默认 ${isMaster ? 'master' : 'self'}` },
      participants: { type: 'array', items: { type: 'string' }, description: '关联当事人 userid 列表。重要：如果这条记忆涉及其他人（如会议参与者、待办负责人），请务必传入他们的 userid，他们即可通过 memory_read 查看到这条记忆' },
      sourceOrigin: { type: 'string', description: `来源类型：human=主人亲述/conversation=会话上下文/yuyi_message=御驿消息/tool_result=工具执行结果/seed=知识种子。默认${isMaster ? 'human' : 'conversation'}。转述御驿消息时必须传 yuyi_message` },
      sourceRef: { type: 'string', description: '来源引用：消息ID/日程ID/文件名/对端 agentId。来自御驿消息时填消息标识，便于回查' },
      hubEndorsed: { type: 'boolean', description: '御驿消息发送方是否经 Hub 背书（仅 sourceOrigin=yuyi_message 时有意义）' },
      authStatus: { type: 'string', description: '授权状态：未授权/已授权/已拒绝。statementType=授权时填写；主人明确批准=已授权' },
      authBy: { type: 'string', description: '授权人 userid（statementType=授权时填写）' },
      authVia: { type: 'string', description: '授权来源：批准消息的标识或会话引用（statementType=授权时填写）' },
      authRange: { type: 'string', description: '授权范围：允许的具体对象与动作（statementType=授权时填写）' },
      verifyStatus: { type: 'string', description: '验证状态：未验证/已验证。statementType=已验证结果时必须为已验证，否则写入时自动回落为候选' },
      verifyMethod: { type: 'string', description: '验证方法：实际检查了什么范围、采用什么方式' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: renderJson,
    },
    execute: async (args: Record<string, unknown>): Promise<JsonValue> => {
      const content = typeof args.content === 'string' ? args.content : ''
      if (!content.trim()) return { ok: false, error: '内容不能为空' }

      const type = typeof args.type === 'string' ? args.type : 'note'
      let scope: 'master' | 'self' | 'public' =
        typeof args.scope === 'string' && ['master', 'self', 'public'].includes(args.scope)
          ? args.scope as 'master' | 'self' | 'public'
          : (isMaster ? 'master' : 'self')
      // 访客不允许写 master-only 记忆（既无意义又易误导），统一回落为 self
      if (!isMaster && scope === 'master') scope = 'self'

      // 陈述类型：显式传入优先，否则主人=事实、访客=候选
      let statementType: StatementType =
        typeof args.statementType === 'string' && (STATEMENT_TYPES as readonly string[]).includes(args.statementType)
          ? args.statementType as StatementType
          : (isMaster ? '事实' : '候选')

      const notes: string[] = []

      // 验证信息：已验证结果必须附验证，否则回落为候选（写入侧也会归一）
      let verify: MemoryVerify | undefined
      if (args.verifyStatus === '已验证' || args.verifyStatus === '未验证') {
        verify = {
          status: args.verifyStatus,
          ...(typeof args.verifyMethod === 'string' && args.verifyMethod.trim() ? { method: args.verifyMethod.trim() } : {}),
        }
      }
      if (statementType === '已验证结果' && verify?.status !== '已验证') {
        statementType = '候选'
        notes.push('已验证结果需要附验证依据（verifyStatus=已验证），已回落为候选')
      }

      // 授权信息：授权类条目缺省补「未授权」，由主人后续显式更新
      let auth: MemoryAuth | undefined
      if (typeof args.authStatus === 'string' && (AUTH_STATUSES as readonly string[]).includes(args.authStatus)) {
        auth = {
          status: args.authStatus as MemoryAuth['status'],
          ...(typeof args.authBy === 'string' && args.authBy.trim() ? { by: args.authBy.trim() } : {}),
          ...(typeof args.authVia === 'string' && args.authVia.trim() ? { via: args.authVia.trim() } : {}),
          ...(typeof args.authRange === 'string' && args.authRange.trim() ? { range: args.authRange.trim() } : {}),
        }
      } else if (statementType === '授权') {
        auth = { status: '未授权' }
        notes.push('授权条目缺少授权状态，已记为未授权；请主人在批准后用 memory_update 确认')
      }

      // 来源归因：默认主人=human、访客=conversation；转述御驿消息必须显式声明
      const source: MemorySource = {
        origin: (
          typeof args.sourceOrigin === 'string' && (SOURCE_ORIGINS as readonly string[]).includes(args.sourceOrigin)
            ? args.sourceOrigin
            : (isMaster ? 'human' : 'conversation')
        ) as MemorySource['origin'],
        ...(typeof args.sourceRef === 'string' && args.sourceRef.trim() ? { ref: args.sourceRef.trim() } : {}),
        ...(args.hubEndorsed === true ? { hubEndorsed: true } : {}),
      }

      let participants: string[] | undefined
      if (Array.isArray(args.participants)) {
        participants = args.participants.filter((p): p is string => typeof p === 'string')
        if (participants.length === 0) participants = undefined
      }

      const entry = await addMemoryEntry({
        content,
        type,
        scope,
        author: userId,
        authorRole: isMaster ? 'master' : 'guest',
        statementType,
        source,
        ...(auth !== undefined ? { auth } : {}),
        ...(verify !== undefined ? { verify } : {}),
        ...(participants !== undefined ? { participants } : {}),
      })

      if (entry === null) return { ok: false, error: '写入失败（并发冲突）' }
      return {
        ok: true,
        id: entry.id,
        scope: entry.scope,
        statementType: effectiveStatementType(entry),
        ...(notes.length > 0 ? { notes } : {}),
      }
    },
    isConcurrencySafe: () => false,
  })

  // memory_read 工具
  const readTool = defineTool({
    name: 'memory_read',
    description: '读取共享记忆。按关键词搜索有权限查看的记忆，默认只返回当前有效的条目；可按陈述类型过滤（如只看授权或事实），也可包含已被替代的历史版本和归档条目。',
    parameters: {
      keywords: { type: 'string', description: '搜索关键词，不传则返回所有有权限的记忆' },
      limit: { type: 'number', description: '返回条数上限，默认 20，最大 50' },
      statementType: { type: 'string', description: '按陈述类型过滤：事实/推断/偏好/候选/授权/已验证结果。例如执行不可逆动作前查授权记录时传 授权' },
      includeSuperseded: { type: 'boolean', description: '是否包含已被替代的历史版本，默认 false' },
      includeArchived: { type: 'boolean', description: '是否包含归档区条目，默认 false' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: renderJson,
    },
    execute: async (args: Record<string, unknown>): Promise<JsonValue> => {
      const includeArchived = args.includeArchived === true
      const pool = includeArchived ? [...loadSharedMemory(), ...loadArchivedMemories()] : loadSharedMemory()
      const allowed = filterMemoriesByUser(pool, userId, isMaster)

      const statementType = typeof args.statementType === 'string' && (STATEMENT_TYPES as readonly string[]).includes(args.statementType)
        ? args.statementType as StatementType
        : undefined
      let results = filterMemoriesForRead(allowed, {
        ...(statementType !== undefined ? { statementType } : {}),
        includeSuperseded: args.includeSuperseded === true,
      })
      if (typeof args.keywords === 'string' && args.keywords.trim()) {
        results = searchMemories(results, args.keywords.trim())
      }

      const limit = typeof args.limit === 'number' ? Math.min(Math.max(1, args.limit), 50) : 20
      const sliced = results.slice(-limit)

      return {
        ok: true,
        total: results.length,
        returned: sliced.length,
        entries: sliced.map(e => ({
          id: e.id,
          time: e.timestamp.slice(0, 19).replace('T', ' '),
          type: e.type,
          statementType: effectiveStatementType(e),
          lifecycle: effectiveLifecycle(e),
          content: e.content,
          scope: e.scope,
          author: e.authorRole === 'master' ? '主人' : e.author,
          ...(e.source !== undefined ? { source: `${e.source.origin}${e.source.ref ? `(${e.source.ref})` : ''}` } : {}),
          ...(e.auth !== undefined ? { auth: e.auth.status } : {}),
        })),
      }
    },
    isConcurrencySafe: () => true,
  })

  // memory_update 工具（仅主人可用）
  const updateTool = defineTool({
    name: 'memory_update',
    description: '更新一条已有的共享记忆。修改内容或陈述类型时采用「替代」语义：生成新记录并与旧记录双向链接，历史保留可查（返回新 id）；仅修改可见范围或参与者时原地生效。仅主人可用。',
    parameters: {
      id: { type: 'string', required: true, description: '要更新的记忆 ID' },
      content: { type: 'string', description: '新的记忆内容（触发替代：生成新记录，旧记录标记已替代）' },
      statementType: { type: 'string', description: '新的陈述类型：事实/推断/偏好/候选/授权/已验证结果（触发替代）。例如主人批准后把授权条目从未授权确认为已授权' },
      scope: { type: 'string', description: '新的可见范围：master/self/public（原地修改，不产生历史）' },
      participants: { type: 'array', items: { type: 'string' }, description: '新的参与者 userid 列表（原地修改，不产生历史）' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: renderJson,
    },
    execute: async (args: Record<string, unknown>): Promise<JsonValue> => {
      const id = typeof args.id === 'string' ? args.id : ''
      if (!id) return { ok: false, error: '需要 id' }

      const updates: Parameters<typeof updateMemoryEntry>[1] = {}
      if (typeof args.content === 'string') updates.content = args.content
      if (typeof args.statementType === 'string' && (STATEMENT_TYPES as readonly string[]).includes(args.statementType)) {
        updates.statementType = args.statementType as StatementType
      }
      if (typeof args.scope === 'string' && ['master', 'self', 'public'].includes(args.scope)) {
        updates.scope = args.scope as 'master' | 'self' | 'public'
      }
      if (Array.isArray(args.participants)) {
        updates.participants = args.participants.filter((p): p is string => typeof p === 'string')
      }

      const result = await updateMemoryEntry(id, updates, { author: userId, authorRole: 'master' })
      if (result === null) return { ok: false, error: '未找到该记忆或更新失败' }
      const superseded = result.lifecycle?.supersedes
      return {
        ok: true,
        id: result.id,
        mode: superseded !== undefined ? '替代（历史保留）' : '原地',
        ...(superseded !== undefined ? { superseded } : {}),
        statementType: effectiveStatementType(result),
      }
    },
    isConcurrencySafe: () => false,
  })

  // memory_delete 工具（仅主人可用）
  const deleteTool = defineTool({
    name: 'memory_delete',
    description: '删除一条共享记忆。仅主人可用。若只是想让条目退出当前视野但保留历史，请改用管理页的归档功能。',
    parameters: {
      id: { type: 'string', required: true, description: '要删除的记忆 ID' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: renderJson,
    },
    execute: async (args: Record<string, unknown>): Promise<JsonValue> => {
      const id = typeof args.id === 'string' ? args.id : ''
      if (!id) return { ok: false, error: '需要 id' }
      const ok = await deleteMemoryEntry(id)
      return ok ? { ok: true } : { ok: false, error: '未找到该记忆' }
    },
    isConcurrencySafe: () => false,
  })

  try {
    const agent = agentCtx as unknown as {
      tools?: {
        register?: (tool: unknown) => (() => void) | void
      }
      effect?: (callback: () => (() => void) | void) => (() => void) | void
      logger?: { warn?: (...args: unknown[]) => void; info?: (...args: unknown[]) => void }
    }
    if (agent.tools === undefined || typeof agent.tools.register !== 'function') {
      // tools 服务未就绪：这不是致命错误（某些 agent 组合可能没有 tools 服务），
      // 但要留痕，否则工具静默缺失极难排查。
      agent.logger?.warn?.('[dsh-memory] agent 上下文无 tools.register，跳过记忆工具注册')
      return
    }
    const disposers: Array<() => void> = []
    const track = (tool: unknown): void => {
      // 必须以方法调用保持 this 上下文（ToolRuntime 实例），
      // 提取为独立变量会丢失 this 导致 "Cannot read properties of undefined (reading 'layers')"
      const dispose = agent.tools!.register!(tool)
      if (typeof dispose === 'function') disposers.push(dispose)
    }
    track(writeTool)
    track(readTool)
    if (isMaster) {
      track(updateTool)
      track(deleteTool)
    }
    // 把工具注册的 disposer 绑定到 agentCtx 生命周期：
    // agent dispose 时工具自动注销，避免泄漏或「工具残留但 agent 已销毁」。
    if (typeof agent.effect === 'function') {
      agent.effect(() => () => { for (const d of disposers) { try { d() } catch { /* ignore */ } } })
    }
    agent.logger?.info?.(`[dsh-memory] 已注册记忆工具 (${isMaster ? '主人: read/write/update/delete' : '访客: read/write'})`)
  } catch (error) {
    console.error('[dsh-memory] 注册工具失败:', error)
  }
}

/**
 * 获取记忆摘要（用于注入系统提示词）
 *
 * 只注入真实的元信息（当前条数、陈述类型分布、最近写入时间），不声称“相关”——
 * 是否相关由模型调用 memory_read 后自行判断。
 */
export function getMemorySummaryForUser(userId: string, isMaster: boolean): string {
  const allEntries = loadSharedMemory()
  const allowed = filterMemoriesByUser(allEntries, userId, isMaster)
  if (allowed.length === 0) return ''

  const current = filterMemoriesForRead(allowed)
  const typeCounts = new Map<string, number>()
  for (const e of current) {
    const st = effectiveStatementType(e)
    typeCounts.set(st, (typeCounts.get(st) ?? 0) + 1)
  }
  const breakdown = [...typeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([t, n]) => `${t}×${n}`)
    .join('、')
  const latest = allowed[allowed.length - 1]
  const latestTime = latest ? latest.timestamp.slice(0, 19).replace('T', ' ') : '未知'

  const scopeNote = current.length !== allowed.length ? `（另有 ${allowed.length - current.length} 条历史版本）` : ''
  return `【共享记忆】你共有 ${allowed.length} 条共享记忆${scopeNote}，当前有效 ${current.length} 条（${breakdown}；最近一条写入于 ${latestTime}）。使用 memory_read 可按陈述类型过滤（如查授权记录）。`
}
