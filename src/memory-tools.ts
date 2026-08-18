/**
 * 共享记忆 DSH 工具定义
 *
 * 注册两个工具到 DSH agent：
 *   - memory_write：写入记忆
 *   - memory_read：读取记忆（自动按权限过滤）
 */
import type { Context } from '@deepseek-ai/cordis'
import type { JsonValue } from '@deepseek-ai/dsh-session'
import { addMemoryEntry, loadSharedMemory, filterMemoriesByUser, searchMemories, updateMemoryEntry, deleteMemoryEntry } from './memory-store.ts'

/** 注册共享记忆工具到 agent 上下文 */
export function registerMemoryTools(
  agentCtx: Context,
  userId: string,
  isMaster: boolean,
): void {
  // memory_write 工具
  const writeTool = {
    name: 'memory_write',
    description: '写入一条共享记忆，让其他会话（包括访客）也能知道这件事。重要：如果创建了日程、待办或涉及其他人（如会议参与者），请务必在 participants 参数中传入他们的 userid，这样他们才能看到这条记忆。主人写入默认仅主人可见，访客写入默认仅主人和该访客可见。',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '记忆内容，简洁清晰地描述发生了什么' },
        type: { type: 'string', description: '记忆类型：schedule_created/todo_created/decision/note/conversation_summary', default: 'note' },
        scope: { type: 'string', description: '可见范围：master=仅主人可见, self=主人+当事人, public=所有人可见', default: isMaster ? 'master' : 'self' },
        participants: { type: 'array', items: { type: 'string' }, description: '关联当事人 userid 列表。重要：如果这条记忆涉及其他人（如会议参与者、待办负责人），请务必传入他们的 userid，这样他们才能通过 memory_read 查看到这条记忆' },
      },
      required: ['content'],
    },
    output: {
      schema: { type: 'object' },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      render: (_args: unknown, value: JsonValue): Array<{ type: string; text: string }> => {
        const text = typeof value === 'object' && value !== null
          ? JSON.stringify(value, null, 2)
          : String(value ?? '')
        return [{ type: 'text' as const, text }]
      },
    },
    execute: async (args: Record<string, unknown>): Promise<JsonValue> => {
      const content = typeof args.content === 'string' ? args.content : ''
      if (!content.trim()) return { ok: false, error: '内容不能为空' }

      const type = typeof args.type === 'string' ? args.type : 'note'
      const scope = typeof args.scope === 'string' && ['master', 'self', 'public'].includes(args.scope)
        ? args.scope as 'master' | 'self' | 'public'
        : (isMaster ? 'master' : 'self')

      let participants: string[] | undefined
      if (Array.isArray(args.participants)) {
        participants = args.participants.filter((p): p is string => typeof p === 'string')
        if (participants.length === 0) participants = undefined
      }

      const entry = addMemoryEntry({
        content,
        type,
        scope,
        author: userId,
        authorRole: isMaster ? 'master' : 'guest',
        ...(participants !== undefined ? { participants } : {}),
      })

      if (entry === null) return { ok: false, error: '写入失败（并发冲突）' }
      return { ok: true, id: entry.id, scope: entry.scope }
    },
    isConcurrencySafe: () => false,
  }

  // memory_read 工具
  const readTool = {
    name: 'memory_read',
    description: '读取共享记忆。按关键词搜索有权限查看的记忆，返回匹配结果。',
    parameters: {
      type: 'object',
      properties: {
        keywords: { type: 'string', description: '搜索关键词，不传则返回所有有权限的记忆' },
        limit: { type: 'number', description: '返回条数上限，默认 20，最大 50' },
      },
    },
    output: {
      schema: { type: 'object' },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      render: (_args: unknown, value: JsonValue): Array<{ type: string; text: string }> => {
        const text = typeof value === 'object' && value !== null
          ? JSON.stringify(value, null, 2)
          : String(value ?? '')
        return [{ type: 'text' as const, text }]
      },
    },
    execute: async (args: Record<string, unknown>): Promise<JsonValue> => {
      const allEntries = loadSharedMemory()
      const allowed = filterMemoriesByUser(allEntries, userId, isMaster)

      let results = allowed
      if (typeof args.keywords === 'string' && args.keywords.trim()) {
        results = searchMemories(allowed, args.keywords.trim())
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
          content: e.content,
          scope: e.scope,
          author: e.authorRole === 'master' ? '主人' : e.author,
        })),
      }
    },
    isConcurrencySafe: () => true,
  }

  // memory_update 工具（仅主人可用）
  const updateTool = {
    name: 'memory_update',
    description: '更新一条已有的共享记忆。可以修改内容、可见范围、参与者等。仅主人可用。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '要更新的记忆 ID' },
        content: { type: 'string', description: '新的记忆内容' },
        scope: { type: 'string', description: '新的可见范围：master/self/public' },
        participants: { type: 'array', items: { type: 'string' }, description: '新的参与者 userid 列表' },
      },
      required: ['id'],
    },
    output: {
      schema: { type: 'object' },
      render: (_args: unknown, value: JsonValue): Array<{ type: string; text: string }> => {
        const text = typeof value === 'object' && value !== null
          ? JSON.stringify(value, null, 2)
          : String(value ?? '')
        return [{ type: 'text' as const, text }]
      },
    },
    execute: async (args: Record<string, unknown>): Promise<JsonValue> => {
      const id = typeof args.id === 'string' ? args.id : ''
      if (!id) return { ok: false, error: '需要 id' }

      const updates: { content?: string; scope?: 'master' | 'self' | 'public'; participants?: string[] } = {}
      if (typeof args.content === 'string') updates.content = args.content
      if (typeof args.scope === 'string' && ['master', 'self', 'public'].includes(args.scope)) {
        updates.scope = args.scope as 'master' | 'self' | 'public'
      }
      if (Array.isArray(args.participants)) {
        updates.participants = args.participants.filter((p): p is string => typeof p === 'string')
      }

      const result = updateMemoryEntry(id, updates)
      if (result === null) return { ok: false, error: '未找到该记忆或更新失败' }
      return { ok: true, id: result.id }
    },
    isConcurrencySafe: () => false,
  }

  // memory_delete 工具（仅主人可用）
  const deleteTool = {
    name: 'memory_delete',
    description: '删除一条共享记忆。仅主人可用。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '要删除的记忆 ID' },
      },
      required: ['id'],
    },
    output: {
      schema: { type: 'object' },
      render: (_args: unknown, value: JsonValue): Array<{ type: string; text: string }> => {
        const text = typeof value === 'object' && value !== null
          ? JSON.stringify(value, null, 2)
          : String(value ?? '')
        return [{ type: 'text' as const, text }]
      },
    },
    execute: async (args: Record<string, unknown>): Promise<JsonValue> => {
      const id = typeof args.id === 'string' ? args.id : ''
      if (!id) return { ok: false, error: '需要 id' }
      const ok = deleteMemoryEntry(id)
      return ok ? { ok: true } : { ok: false, error: '未找到该记忆' }
    },
    isConcurrencySafe: () => false,
  }

  try {
    const agent = agentCtx as unknown as { tools?: { register?: (tool: unknown) => void } }
    agent.tools?.register?.(writeTool)
    agent.tools?.register?.(readTool)
    // 仅主人可注册 update/delete 工具
    if (isMaster) {
      agent.tools?.register?.(updateTool)
      agent.tools?.register?.(deleteTool)
    }
  } catch (error) {
    console.error('[dsh-memory] 注册工具失败:', error)
  }
}

/** 获取记忆摘要（用于注入系统提示词） */
export function getMemorySummaryForUser(userId: string, isMaster: boolean): string {
  const allEntries = loadSharedMemory()
  const allowed = filterMemoriesByUser(allEntries, userId, isMaster)
  if (allowed.length === 0) return ''
  return `【共享记忆】你有 ${allowed.length} 条相关记忆，可能包含之前创建的日程、待办或重要信息。请使用 memory_read 工具查看这些记忆，了解上下文后再回答用户的问题。`
}