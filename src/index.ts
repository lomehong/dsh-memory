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
import { registerAssembleApi } from './memory-assemble.ts'
import { registerMemoryTools, getMemorySummaryForUser } from './memory-tools.ts'
import {
  loadSharedMemory,
  loadArchivedMemories,
  filterMemoriesByUser,
  filterMemoriesForRead,
  addMemoryEntry,
  clearSharedMemory,
  updateMemoryEntry,
  supersedeMemoryEntry,
  markMemorySuperseded,
  archiveMemoryEntry,
  deleteMemoryEntry,
  pruneExpiredMemories,
  effectiveStatementType,
  effectiveLifecycle,
} from './memory-store.ts'
import type { MemoryEntry, StatementType, LifecycleState, MemorySource, MemoryAuth, MemoryVerify, MemoryLifecycle } from './memory-store.ts'
import { assembleMemoryPack } from './memory-assemble.ts'

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
    loadArchivedMemories,
    filterMemoriesByUser,
    filterMemoriesForRead,
    addMemoryEntry,
    clearSharedMemory,
    updateMemoryEntry,
    supersedeMemoryEntry,
    markMemorySuperseded,
    archiveMemoryEntry,
    deleteMemoryEntry,
    pruneExpiredMemories,
    effectiveStatementType,
    effectiveLifecycle,
    // 按回合记忆装配（可选增强，宪章第三阶段）：依消息文本检索相关记忆，
    // 生成带审计回执的记忆包文本。im-channel 开关开启时逐回合调用；
    // 装配失败返回空文本，绝不阻断消息派发。
    assemblePack: (userId: string, isMaster: boolean, query: string): { text: string } => {
      try {
        const result = assembleMemoryPack({ userId, isMaster }, { keywords: [query.trim()].filter(Boolean), limit: 8 })
        if (result.pack.length === 0) return { text: '' }
        const lines = result.pack.map(e => `• [${effectiveStatementType(e)}] ${e.content}`)
        return { text: `【相关共享记忆（自动装配，仅供参考）】\n${lines.join('\n')}` }
      } catch {
        return { text: '' }
      }
    },
  }
  ;(ctx as unknown as { provide: (name: string, value: unknown) => void }).provide('dsh-memory', memoryService)

  // 过期记忆自动清理：插件加载时清理一次，之后定期清理，
  // 避免过期条目长期占用 MAX_ENTRIES 配额并计入摘要。
  void pruneExpiredMemories().catch((error: unknown) => {
    ctx.logger?.warn?.('[dsh-memory] 过期记忆清理失败（下个周期重试）:', error instanceof Error ? error.message : String(error))
  })
  const pruneTimer = setInterval(() => {
    void pruneExpiredMemories().catch((error: unknown) => {
      ctx.logger?.warn?.('[dsh-memory] 过期记忆清理失败（下个周期重试）:', error instanceof Error ? error.message : String(error))
    })
  }, 10 * 60 * 1000)
  pruneTimer.unref?.()
  const maybeLifecycle = ctx as unknown as { on?: (event: 'dispose', fn: () => void) => void }
  maybeLifecycle.on?.('dispose', () => clearInterval(pruneTimer))

  // 注册 HTTP API 路由（供管理页面查看记忆）
  ctx.inject(['webServer'], (wctx: Context) => {
    const web = wctx.get('webServer') as unknown as {
      register: (route: { kind: string; path: string; handler: (req: unknown, res: unknown) => void }) => void
    }
    const { token } = registerMemoryApi(web)
    registerAssembleApi(web, token)
    ctx.logger?.info?.('[dsh-memory] API 路由已注册（含 v2.1 assemble/回执）')
  })
}

export { registerMemoryTools, getMemorySummaryForUser } from './memory-tools.ts'
export {
  loadSharedMemory,
  loadArchivedMemories,
  filterMemoriesByUser,
  filterMemoriesForRead,
  addMemoryEntry,
  clearSharedMemory,
  updateMemoryEntry,
  supersedeMemoryEntry,
  markMemorySuperseded,
  archiveMemoryEntry,
  deleteMemoryEntry,
  pruneExpiredMemories,
  effectiveStatementType,
  effectiveLifecycle,
  MAX_ENTRIES,
  MAX_ARCHIVE_ENTRIES,
} from './memory-store.ts'
export type {
  MemoryEntry,
  StatementType,
  LifecycleState,
  MemorySource,
  MemoryAuth,
  MemoryVerify,
  MemoryLifecycle,
} from './memory-store.ts'