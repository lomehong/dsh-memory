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
  // alpha.2 全局面板（特性检测双写）：宿主具备 main/sidebar.panellist slot 时，
  // 记忆管理视图同时挂为侧边栏全局面板。alpha.1 无此 slot，静默跳过，零副作用。
  const slots = ctx.slots as ClientContext['slots'] & { spec?: (name: string) => unknown }
  if (typeof slots.spec !== 'function') return
  try {
    if (slots.spec('main') !== undefined) {
      ctx.slots.inject('main', () =>
        ctx.slots.register({ name: 'main', key: 'memory' }, MemoryView),
      )
    }
    if (slots.spec('sidebar.panellist') !== undefined) {
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          { name: 'sidebar.panellist', id: 'memory', order: 20, label: () => '记忆' },
          ({ size, active }) => memoryIcon(size, active),
        ),
      )
    }
  } catch { /* 新 API 不可用时静默回退旧注册 */ }
}

/** 侧边栏面板图标（记忆：分层记忆库），active 时用业务主色。 */
function memoryIcon(size: number, active: boolean): JSX.Element {
  const color = active ? 'var(--dsw-alias-state-business-primary)' : 'var(--dsw-alias-label-secondary)'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <ellipse cx="12" cy="5.5" rx="7" ry="2.8" stroke={color} strokeWidth="2" />
      <path d="M5 5.5v6c0 1.6 3.1 2.9 7 2.9s7-1.3 7-2.9v-6" stroke={color} strokeWidth="2" />
      <path d="M5 11.5v6c0 1.6 3.1 2.9 7 2.9s7-1.3 7-2.9v-6" stroke={color} strokeWidth="2" />
    </svg>
  )
}