/**
 * 共享记忆客户端插件
 *
 * 在对话区域注册「记忆」Tab，位于轨迹之后。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { MemoryView } from './MemoryView.tsx'

export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'memory',
    order: 20,
    label: () => '记忆',
  }, MemoryView))
}