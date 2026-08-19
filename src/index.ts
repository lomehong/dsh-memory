/**
 * dsh-memory 共享记忆插件入口
 *
 * 提供跨会话共享记忆能力，所有 agent 实例（主人和访客）可以读写同一份记忆。
 * 记忆访问权限由 scope + participants 控制。
 *
 * 使用方式：
 * 1. 在 agent 创建时，调用 registerMemoryTools(agentCtx, userId, isMaster) 注册工具
 * 2. 调用 getMemorySummaryForUser(userId, isMaster) 获取记忆摘要注入系统提示词
 * 3. 注册 HTTP API 路由供管理页面使用
 */
import type { Context } from '@deepseek-ai/cordis'
import { registerMemoryApi } from './memory-api.ts'
import { registerMemoryTools, getMemorySummaryForUser } from './memory-tools.ts'
import { loadSharedMemory, filterMemoriesByUser, addMemoryEntry, clearSharedMemory, updateMemoryEntry, deleteMemoryEntry, pruneExpiredMemories } from './memory-store.ts'
import type { MemoryEntry } from './memory-store.ts'

export const name = 'dsh-memory'
// webServer 不是硬依赖：核心功能（provide 服务 + 工具注册）不需要 webServer，
// 只有 HTTP API 路由需要（apply 里用 ctx.inject 可选注入）。
// 去掉硬依赖声明，让插件尽早加载并 provide 'dsh-memory' 服务，
// 避免 im-channel 等 consumer 在 agent 创建时 ctx.get('dsh-memory') 返回 undefined。
export const provide = ['dsh-memory']

export function apply(ctx: Context): void {
  ctx.logger?.info?.('[dsh-memory] 共享记忆插件已加载')

  // 注册为服务，供其他插件（如 im-channel）通过 ctx.get('dsh-memory') 访问
  const memoryService = {
    registerMemoryTools,
    getMemorySummaryForUser,
    loadSharedMemory,
    filterMemoriesByUser,
    addMemoryEntry,
    clearSharedMemory,
    updateMemoryEntry,
    deleteMemoryEntry,
    pruneExpiredMemories,
  }
  ;(ctx as unknown as { provide: (name: string, value: unknown) => void }).provide('dsh-memory', memoryService)

  // 注册 HTTP API 路由（供管理页面查看记忆）
  ctx.inject(['webServer'], (wctx: Context) => {
    const web = wctx.get('webServer') as unknown as {
      register: (route: { kind: string; path: string; handler: (req: unknown, res: unknown) => void }) => void
    }
    registerMemoryApi(web)
    ctx.logger?.info?.('[dsh-memory] API 路由已注册')
  })
}

export { registerMemoryTools, getMemorySummaryForUser } from './memory-tools.ts'
export { loadSharedMemory, filterMemoriesByUser, addMemoryEntry, clearSharedMemory, updateMemoryEntry, deleteMemoryEntry, pruneExpiredMemories } from './memory-store.ts'
export type { MemoryEntry } from './memory-store.ts'