/**
 * 记忆工具的 agent preset 入口：preset 行（`name: '@dsh-extra/dsh-memory/tools'`）
 * 引用本模块，由该 preset 组合出的会话获得 memory_read / memory_write /
 * memory_update / memory_delete 工具。
 *
 * 宿主平面服务（'dsh-memory' service + HTTP API）由 bundle 补丁另行挂载。
 * web GUI 用户是主人（isMaster=true），IM 通道 agent 会被 im-channel 的
 * mountSharedMemory 覆盖（带正确的 userId/isMaster）。
 *
 * @module @dsh-extra/dsh-memory/tools
 */
import type { Context } from '@deepseek-ai/cordis'
import { registerMemoryTools } from './memory-tools.ts'

export const name = 'tool-memory'
export const inject = ['tools']

export function apply(ctx: Context): void {
  // preset 组合中注册记忆工具。web GUI 用户是主人，isMaster=true。
  registerMemoryTools(ctx, 'master', true)
}
