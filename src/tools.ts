/**
 * 记忆工具的 agent preset 入口：preset 行（`name: '@dsh-extra/dsh-memory/tools'`）
 * 引用本模块，由该 preset 组合出的会话获得 memory_read / memory_write /
 * memory_update / memory_delete 工具 + **按轮记忆自动装配段**（memory-pack）。
 *
 * 自洽设计（2026-09-15 根治）：按轮装配段随本模块挂载、注册进**所在 agent 的
 * systemPrompt**——不依赖宿主接线或兄弟插件。此前注册挂在 bundle 的 app 层
 * ctx（ctx.inject(['systemPrompt'])），而 systemPrompt 服务是 per-agent 的，
 * 注入永不触发（装配回执 0 条实证），读侧自动驾驶整体哑火。
 *
 * 宿主平面服务（'dsh-memory' service + HTTP API）由 bundle 补丁另行挂载。
 * web GUI 用户是主人（isMaster=true），IM 通道 agent 会被 im-channel 的
 * mountSharedMemory 覆盖（带正确的 userId/isMaster）。
 *
 * @module @dsh-extra/dsh-memory/tools
 */
import type { Context } from '@deepseek-ai/cordis'
import { registerMemoryTools } from './memory-tools.ts'
import { captureClaim, SECTION_NAME, SECTION_ORDER, renderMemorySection, trace } from './memory-autopilot.ts'

export const name = 'tool-memory'
export const inject = ['tools', 'systemPrompt']

export function apply(ctx: Context): void {
  trace('apply 进入（agent 上下文实例化 tool-memory）')

  // preset 组合中注册记忆工具。web GUI 用户是主人，isMaster=true。
  registerMemoryTools(ctx, 'master', true)
  trace('registerMemoryTools 完成（identity 已登记 viewerByCtx）')

  // per-agent 捕获兜底：app 层监听若收不到 agent 级事件，本会话自己的 ctx 上
  // 再挂一份（captureClaim 按消息 id 幂等，双监听不双捕）。
  try {
    const events = ctx as unknown as { on?: (event: string, handler: (payload: unknown) => void) => void }
    if (typeof events.on === 'function') {
      events.on('agent/inbox/claimed', (payload: unknown) => { try { captureClaim(payload) } catch { /* 防御 */ } })
      trace('per-agent claimed 监听已注册')
    } else {
      trace('ctx.on 缺席——per-agent claimed 兜底不可用')
    }
  } catch { /* 防御 */ }

  // 按轮记忆装配段：随工具挂载注册进所在 agent 的 systemPrompt（每模型步重求值；
  // 身份未登记/injectPerTurn 关闭 → 空串 fail-closed）。注册失败只失去自动化，
  // 工具路径不受影响。
  try {
    const spViaProp = (ctx as unknown as { systemPrompt?: { section?: (s: unknown) => void } }).systemPrompt
    const spViaGet = (() => { try { return (ctx as unknown as { get?: (n: string) => unknown }).get?.('systemPrompt') } catch { return undefined } })()
    const systemPrompt = (spViaProp && typeof spViaProp.section === 'function' ? spViaProp
      : spViaGet && typeof (spViaGet as { section?: unknown }).section === 'function' ? spViaGet : undefined) as { section?: (s: unknown) => void } | undefined
    trace(`systemPrompt 解析：prop=${spViaProp ? '有' : '无'} get=${spViaGet ? '有' : '无'}`)
    if (systemPrompt && typeof systemPrompt.section === 'function') {
      systemPrompt.section({ name: SECTION_NAME, order: SECTION_ORDER, text: renderMemorySection })
      trace(`memory-pack 段注册成功（order ${SECTION_ORDER}）`)
      ctx.logger?.info?.('[dsh-memory] 按轮记忆装配段已随工具挂载注册（memory-pack，随会话自洽）')
    } else {
      trace('✗ systemPrompt 服务缺席——按轮装配未注册（memory_read 工具路径不受影响）')
      ctx.logger?.warn?.('[dsh-memory] systemPrompt 服务缺席——按轮装配未注册（memory_read 工具路径不受影响）')
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    trace(`✗ 装配段注册失败：${msg}`)
    ctx.logger?.warn?.('[dsh-memory] 装配段注册失败（工具路径不受影响）:', msg)
  }
}
