/**
 * 记忆自动驾驶配置表单（plugins.bundle.config 槽位，key=@dsh-extra/dsh-memory）。
 *
 * - `view: 'summary'`：插件卡片上的一行简介（无状态、无 hooks）。
 * - `view: 'page'`：完整表单——读侧按轮装配 / 写侧复盘 / 审批留痕的开关与预算，
 *   经 GET/POST /dsh-memory/autopilot 读写；POST 携带 x-memory-token（同 MemoryView）。
 * - 保存即生效：宿主端 saveAutopilotConfig 夹紧校验后原子写 autopilot.json 并失效 30s 配置缓存。
 */
import { useCallback, useEffect, useState } from 'react'

interface AutopilotConfigDto {
  injectPerTurn: boolean
  injectLimit: number
  injectBudgetBytes: number
  reviewerEnabled: boolean
  reviewOnIdle: boolean
  idleDebounceSec: number
  reviewPeriodicHours: number
  reviewGuests: boolean
  reviewMaxEntries: number
  reviewTranscriptChars: number
  approvalMemory: boolean
}

const c = {
  text: 'var(--dsw-alias-label-primary, #1f2329)',
  textSecondary: 'var(--dsw-alias-label-secondary, #4e5969)',
  bgBase: 'var(--dsw-alias-bg-base, #ffffff)',
  bgLayer: 'var(--dsw-alias-bg-layer-1, #f7f8fa)',
  border: 'var(--dsw-alias-separator-primary, #e5e6eb)',
  accent: 'var(--dsw-alias-state-business-primary, #3370ff)',
  ok: 'var(--dsw-alias-state-success-primary, #00b42a)',
  error: 'var(--dsw-alias-state-error-primary, #f53f3f)',
}

const sectionStyle = { border: `1px solid ${c.border}`, borderRadius: 8, padding: '12px 16px', background: c.bgBase, marginBottom: 12 }
const titleStyle = { fontSize: 13, fontWeight: 600, color: c.text, margin: '0 0 8px' }
const hintStyle = { fontSize: 12, color: c.textSecondary, lineHeight: 1.5 }
const rowStyle = { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0' }
const labelStyle = { fontSize: 13, color: c.text }
const numStyle = { width: 90, padding: '4px 8px', borderRadius: 6, border: `1px solid ${c.border}`, background: c.bgBase, color: c.text, fontSize: 13 }
const btnStyle = { padding: '4px 10px', borderRadius: 6, border: `1px solid ${c.border}`, background: c.bgBase, color: c.textSecondary, fontSize: 12, cursor: 'pointer' }
const primaryBtn = { ...btnStyle, background: c.accent, color: '#fff', border: 'none', fontWeight: 600, padding: '6px 22px', fontSize: 13 }

async function api<T>(path: string, init?: { method?: string; body?: unknown; token?: string }): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (init?.token) headers['x-memory-token'] = init.token
  if (init?.body !== undefined) headers['content-type'] = 'application/json'
  const res = await fetch(path, {
    method: init?.method ?? 'GET',
    headers,
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    signal: AbortSignal.timeout(10_000),
  })
  return (await res.json()) as T
}

/** 一行开关项（label + 说明）。 */
function SwitchRow(props: { checked: boolean; label: string; hint: string; onChange: (v: boolean) => void }) {
  return (
    <div style={rowStyle}>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
        style={{ marginTop: 2 }}
      />
      <div>
        <div style={labelStyle}>{props.label}</div>
        <div style={hintStyle}>{props.hint}</div>
      </div>
    </div>
  )
}

/** 一行数字项（label + 说明 + 输入框）。 */
function NumberRow(props: { value: number; label: string; hint: string; onChange: (v: number) => void }) {
  return (
    <div style={{ ...rowStyle, alignItems: 'center' }}>
      <div style={{ minWidth: 150 }}>
        <div style={labelStyle}>{props.label}</div>
        <div style={hintStyle}>{props.hint}</div>
      </div>
      <input
        type="number"
        style={numStyle}
        value={props.value}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v)) props.onChange(v)
        }}
      />
    </div>
  )
}

/** 完整配置表单（有状态，由 React 渲染）。 */
export function AutopilotConfigForm(): JSX.Element {
  const [cfg, setCfg] = useState<AutopilotConfigDto | null>(null)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState('')
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api<{ ok: boolean; config: AutopilotConfigDto }>('/dsh-memory/autopilot')
      if (res.ok && res.config) { setCfg(res.config); setDirty(false); setLoadError(false) }
    } catch {
      setLoadError(true)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function save() {
    if (cfg === null) return
    try {
      const t = await api<{ ok: boolean; token?: string }>('/dsh-memory/token')
      if (!t.ok || typeof t.token !== 'string') { setStatus('获取校验 token 失败'); return }
      const res = await api<{ ok: boolean; config?: AutopilotConfigDto; error?: string }>('/dsh-memory/autopilot', {
        method: 'POST',
        body: cfg,
        token: t.token,
      })
      if (res.ok && res.config) {
        setCfg(res.config)
        setDirty(false)
        setStatus('已保存并生效')
      } else {
        setStatus('保存失败：' + (res.error ?? '未知错误'))
      }
    } catch (e) {
      setStatus('保存失败：' + String(e))
    }
  }

  if (loadError) {
    return <div style={{ ...hintStyle, color: c.error }}>配置获取失败（dsh-memory 宿主服务不可用？）。</div>
  }
  if (cfg === null) {
    return <div style={hintStyle}>加载中…</div>
  }

  const patch = (p: Partial<AutopilotConfigDto>) => { setCfg({ ...cfg, ...p }); setDirty(true) }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={sectionStyle}>
        <div style={titleStyle}>读侧 · 按轮自动装配</div>
        <SwitchRow
          checked={cfg.injectPerTurn}
          label="按轮自动装配注入"
          hint="每轮对话自动检索相关记忆并注入 system prompt（memory-pack 段），装配失败不阻断对话。"
          onChange={(v) => patch({ injectPerTurn: v })}
        />
        <NumberRow value={cfg.injectLimit} label="每轮最多注入条数" hint="1–20，默认 5" onChange={(v) => patch({ injectLimit: v })} />
        <NumberRow value={cfg.injectBudgetBytes} label="注入字节预算" hint="200–8192，默认 1600；超限按序裁剪" onChange={(v) => patch({ injectBudgetBytes: v })} />
      </div>

      <div style={sectionStyle}>
        <div style={titleStyle}>写侧 · 对话复盘沉淀</div>
        <SwitchRow
          checked={cfg.reviewerEnabled}
          label="对话复盘沉淀（总开关）"
          hint="会话告一段落后经模型提取值得记住的事实，判重后写入记忆库。"
          onChange={(v) => patch({ reviewerEnabled: v })}
        />
        <SwitchRow
          checked={cfg.reviewOnIdle}
          label="空闲去抖触发"
          hint="会话转入空闲后延迟触发复盘（默认开）。"
          onChange={(v) => patch({ reviewOnIdle: v })}
        />
        <NumberRow value={cfg.idleDebounceSec} label="空闲去抖秒数" hint="10–3600，默认 90" onChange={(v) => patch({ idleDebounceSec: v })} />
        <NumberRow value={cfg.reviewPeriodicHours} label="周期兜底间隔（小时）" hint="0=关，默认 6；对漏掉的会话做扫尾复盘" onChange={(v) => patch({ reviewPeriodicHours: v })} />
        <SwitchRow
          checked={cfg.reviewGuests}
          label="复盘访客会话"
          hint="默认关（保守侧）：访客会话不自动沉淀记忆；主人的记忆仍受可见性规则约束。"
          onChange={(v) => patch({ reviewGuests: v })}
        />
        <NumberRow value={cfg.reviewMaxEntries} label="单次复盘最多落库条数" hint="1–20，默认 5" onChange={(v) => patch({ reviewMaxEntries: v })} />
        <NumberRow value={cfg.reviewTranscriptChars} label="回合窗口文本上限（字符）" hint="200–20000，默认 4000" onChange={(v) => patch({ reviewTranscriptChars: v })} />
      </div>

      <div style={sectionStyle}>
        <div style={titleStyle}>审批留痕</div>
        <SwitchRow
          checked={cfg.approvalMemory}
          label="批准/拒绝自动落「授权」记忆"
          hint="approval/request 观察者记录（透传不改裁决），授权四元组写入记忆库。"
          onChange={(v) => patch({ approvalMemory: v })}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
        <button type="button" style={primaryBtn} disabled={!dirty} onClick={() => { void save() }}>保存并生效</button>
        {dirty && <span style={{ ...hintStyle, color: c.warn }}>有未保存更改</span>}
        {!dirty && status !== '' && <span style={{ ...hintStyle, color: c.ok }}>{status}</span>}
        {dirty && status !== '' && <span style={{ ...hintStyle, color: c.error }}>{status}</span>}
      </div>
    </div>
  )
}

/** 插件页配置入口：summary 一行简介（无 hooks）；page 渲染完整表单。 */
export function AutopilotPluginConfig(props: { view: 'summary' | 'page' }): JSX.Element {
  if (props.view === 'page') return <AutopilotConfigForm />
  return (
    <span style={{ fontSize: 12, color: c.textSecondary }}>
      记忆自动驾驶：按轮装配注入 + 对话复盘沉淀 + 审批留痕；点开配置开关与预算。
    </span>
  )
}
