/**
 * 共享记忆视图 - 对话区域的第三个 Tab
 *
 * 提供记忆管理界面，与 admin page 功能相同但作为 React 组件嵌入。
 * 样式走产品语义令牌（--dsw-alias-*），深浅主题自动适配；
 * 通过组件内注入一段样式表获得 hover/focus 等伪类能力
 * （构建链是 esbuild 无 CSS 管线，内联样式表达不了伪类）。
 */
import { useState, useEffect, useCallback } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client/contract/slots'
import { formatLocal } from '../time-format.js'

interface MemoryEntry {
  id: string
  timestamp: string
  type: string
  content: string
  scope: 'master' | 'self' | 'public'
  author: string
  authorRole: 'master' | 'guest'
  participants?: string[]
  expireAt?: string
}

const SCOPE_LABELS: Record<string, string> = { master: '仅主人', self: '当事人', public: '公开' }

async function api(path: string, method = 'GET', body?: unknown, token?: string): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  // 写操作需携带服务端下发的校验 token（自定义头同时起到 CSRF 防护作用）
  if (token) headers['x-memory-token'] = token
  const opts: RequestInit = { method, headers }
  if (body) {
    headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(path, opts)
  return res.json() as Promise<Record<string, unknown>>
}

/* * 组件样式表：全部走 --dsw-alias-* 语义令牌，深浅主题自适应。 */
const CSS = `
.dsh-mem-root { padding: 16px 20px 20px; height: 100%; display: flex; flex-direction: column; gap: 12px; color: var(--dsw-alias-label-primary); }
.dsh-mem-stats { display: flex; gap: 12px; }
.dsh-mem-stat { flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 12px 16px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; background: var(--dsw-alias-bg-layer-2); }
.dsh-mem-statNum { font-size: 22px; font-weight: 700; line-height: 1.2; color: var(--dsw-alias-label-primary); }
.dsh-mem-statNum[data-accent='brand'] { color: var(--dsw-alias-brand-primary, var(--dsw-alias-label-primary)); }
.dsh-mem-statNum[data-accent='warn'] { color: var(--dsw-alias-state-warn-primary); }
.dsh-mem-statLabel { font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.dsh-mem-toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.dsh-mem-input, .dsh-mem-select { padding: 6px 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; font-size: 13px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); transition: border-color .12s ease; outline: none; }
.dsh-mem-input { flex: 1; min-width: 160px; }
.dsh-mem-input::placeholder { color: var(--dsw-alias-label-tertiary); }
.dsh-mem-input:focus, .dsh-mem-select:focus, .dsh-mem-modalInput:focus, .dsh-mem-modalTextarea:focus, .dsh-mem-modalSelect:focus { border-color: var(--dsw-alias-brand-primary, var(--dsw-alias-border-l2)); }
.dsh-mem-select option { background: var(--dsw-alias-bg-base, #1b1b1b); color: var(--dsw-alias-label-primary); }
.dsh-mem-btn { padding: 6px 14px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; font-size: 13px; line-height: 1.5; cursor: pointer; background: transparent; color: var(--dsw-alias-label-secondary); transition: background .12s ease, border-color .12s ease, color .12s ease; }
.dsh-mem-btn:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.dsh-mem-btnSmall { padding: 3px 10px; font-size: 11px; border-radius: 6px; }
/* 主动作按钮走 button-info-*（DeepSeek 蓝，深浅主题各有一档）——
   与产品输入区的蓝色发送键同一视觉族；不要用 button-primary-fill，
   深色模式下它是反色白底，需配 brand-primary-invert 深色标签。 */
.dsh-mem-btnPrimary { background: var(--dsw-alias-button-info-fill, #4a6cf7); border-color: transparent; color: #fff; }
.dsh-mem-btnPrimary:hover { background: var(--dsw-alias-button-info-hover, #5a7cff); color: #fff; }
.dsh-mem-btnDanger { color: var(--dsw-alias-state-error-primary); }
.dsh-mem-btnDanger:hover { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
.dsh-mem-scroll { flex: 1; overflow: auto; border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; background: var(--dsw-alias-bg-layer-1); }
.dsh-mem-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.dsh-mem-th { padding: 9px 12px; text-align: left; font-weight: 600; font-size: 12px; color: var(--dsw-alias-label-tertiary); background: var(--dsw-alias-bg-layer-3); border-bottom: 1px solid var(--dsw-alias-border-l2); position: sticky; top: 0; }
.dsh-mem-td { padding: 8px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); font-size: 13px; line-height: 1.5; }
.dsh-mem-tbody tr:hover .dsh-mem-td { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-mem-trExpired .dsh-mem-td { opacity: 0.45; }
.dsh-mem-content { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-mem-badge { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 500; line-height: 18px; border: 1px solid transparent; }
.dsh-mem-badgeNeutral { background: var(--dsw-alias-bg-layer-3); border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-secondary); }
.dsh-mem-badge[data-scope='master'] { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent); border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 40%, transparent); color: var(--dsw-alias-state-warn-primary); }
.dsh-mem-badge[data-scope='self'] { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent); border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 40%, transparent); color: var(--dsw-alias-state-success-primary); }
.dsh-mem-badge[data-scope='public'] { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent); border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 40%, transparent); color: var(--dsw-alias-brand-primary, var(--dsw-alias-label-secondary)); }
.dsh-mem-empty { padding: 48px 24px; text-align: center; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.dsh-mem-overlay { position: fixed; inset: 0; background: rgb(0 0 0 / 52%); z-index: 1000; display: flex; align-items: center; justify-content: center; }
.dsh-mem-modal { background: var(--dsw-alias-bg-base); border: 1px solid var(--dsw-alias-border-l2); border-radius: 14px; padding: 20px; min-width: 360px; max-width: 480px; box-shadow: 0 12px 36px rgb(0 0 0 / 36%); color: var(--dsw-alias-label-primary); }
.dsh-mem-modalTitle { margin: 0 0 14px; font-size: 15px; font-weight: 600; }
.dsh-mem-modalLabel { display: block; margin-bottom: 4px; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.dsh-mem-modalInput, .dsh-mem-modalTextarea, .dsh-mem-modalSelect { width: 100%; padding: 6px 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; font-size: 13px; margin-bottom: 12px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); box-sizing: border-box; outline: none; transition: border-color .12s ease; font-family: inherit; }
.dsh-mem-modalTextarea { min-height: 64px; resize: vertical; }
.dsh-mem-btnRow { display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px; }
`

export function MemoryView(_props: ConvViewProps): JSX.Element {
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [token, setToken] = useState('')
  const [search, setSearch] = useState('')
  const [scopeFilter, setScopeFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [addContent, setAddContent] = useState('')
  const [addType, setAddType] = useState('note')
  const [addScope, setAddScope] = useState('master')
  const [addParticipants, setAddParticipants] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editScope, setEditScope] = useState('master')
  const [editParticipants, setEditParticipants] = useState('')

  const load = useCallback(async () => {
    try {
      const d = await api('/dsh-memory/entries', 'GET')
      setEntries((d.entries as MemoryEntry[]) ?? [])
    } catch {
      // API 不可用时保持空列表，不阻断页面
    }
  }, [])

  useEffect(() => {
    load()
    // 获取写操作校验 token，供添加/编辑/删除等变更请求携带
    api('/dsh-memory/token', 'GET').then(d => { setToken(String(d.token ?? '')) }).catch(() => {})
  }, [load])

  const filtered = entries.filter(e => {
    if (search && !e.content.toLowerCase().includes(search.toLowerCase()) && !e.type.toLowerCase().includes(search.toLowerCase())) return false
    if (scopeFilter && e.scope !== scopeFilter) return false
    return true
  })

  const now = new Date().toISOString()
  const expiredCount = entries.filter(e => e.expireAt && e.expireAt < now).length

  async function handleAdd() {
    if (!addContent.trim()) { alert('请输入内容'); return }
    const p = addParticipants.split(',').map(s => s.trim()).filter(Boolean)
    const r = await api('/dsh-memory/entries', 'POST', { content: addContent, type: addType, scope: addScope, participants: p }, token)
    if (r.ok) { setShowAdd(false); setAddContent(''); setAddParticipants(''); load() }
    else { alert('添加失败: ' + (r.error || '未知错误')) }
  }

  async function handleEdit() {
    if (!editId) return
    const p = editParticipants.split(',').map(s => s.trim()).filter(Boolean)
    const r = await api('/dsh-memory/entries/update', 'POST', { id: editId, content: editContent, scope: editScope, participants: p }, token)
    if (r.ok) { setEditId(null); load() }
    else { alert('更新失败: ' + (r.error || '未知错误')) }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除？')) return
    const r = await api('/dsh-memory/entries/delete', 'POST', { id }, token)
    if (r.ok) load()
  }

  async function handleClear() {
    if (!confirm('确定清除所有记忆？')) return
    const r = await api('/dsh-memory/clear', 'POST', undefined, token)
    if (r.ok) load()
  }

  async function handlePrune() {
    const r = await api('/dsh-memory/prune', 'POST', undefined, token)
    if (r.ok) { load(); alert('已清除 ' + (r.pruned ?? 0) + ' 条过期记忆') }
  }

  function openEdit(e: MemoryEntry) {
    setEditId(e.id)
    setEditContent(e.content)
    setEditScope(e.scope)
    setEditParticipants((e.participants || []).join(', '))
  }

  return (
    <div className="dsh-mem-root">
      <style>{CSS}</style>

      <div className="dsh-mem-stats">
        <div className="dsh-mem-stat">
          <div className="dsh-mem-statNum">{entries.length}</div>
          <div className="dsh-mem-statLabel">总记忆</div>
        </div>
        <div className="dsh-mem-stat">
          <div className="dsh-mem-statNum" data-accent={scopeFilter || search ? 'brand' : undefined}>{filtered.length}</div>
          <div className="dsh-mem-statLabel">筛选后</div>
        </div>
        <div className="dsh-mem-stat">
          <div className="dsh-mem-statNum" data-accent={expiredCount > 0 ? 'warn' : undefined}>{expiredCount}</div>
          <div className="dsh-mem-statLabel">已过期</div>
        </div>
      </div>

      <div className="dsh-mem-toolbar">
        <input className="dsh-mem-input" placeholder="搜索记忆..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="dsh-mem-select" value={scopeFilter} onChange={e => setScopeFilter(e.target.value)}>
          <option value="">所有范围</option>
          <option value="master">仅主人</option>
          <option value="self">当事人</option>
          <option value="public">公开</option>
        </select>
        <button className="dsh-mem-btn dsh-mem-btnPrimary" onClick={() => setShowAdd(true)}>+ 添加</button>
        <button className="dsh-mem-btn dsh-mem-btnDanger dsh-mem-btnSmall" onClick={handleClear}>清除全部</button>
        <button className="dsh-mem-btn dsh-mem-btnSmall" onClick={handlePrune}>清除过期</button>
      </div>

      <div className="dsh-mem-scroll">
        <table className="dsh-mem-table">
          <thead>
            <tr>
              <th className="dsh-mem-th">时间</th>
              <th className="dsh-mem-th">类型</th>
              <th className="dsh-mem-th">内容</th>
              <th className="dsh-mem-th">范围</th>
              <th className="dsh-mem-th">作者</th>
              <th className="dsh-mem-th">操作</th>
            </tr>
          </thead>
          <tbody className="dsh-mem-tbody">
            {filtered.length === 0 ? (
              <tr><td className="dsh-mem-td" colSpan={6}><div className="dsh-mem-empty">暂无记忆</div></td></tr>
            ) : filtered.map(e => {
              const expired = e.expireAt && e.expireAt < now
              return (
                <tr key={e.id} className={expired ? 'dsh-mem-trExpired' : undefined}>
                  <td className="dsh-mem-td">{formatLocal(e.timestamp)}</td>
                  <td className="dsh-mem-td"><span className="dsh-mem-badge dsh-mem-badgeNeutral">{e.type}</span></td>
                  <td className="dsh-mem-td dsh-mem-content" title={e.content}>{e.content}</td>
                  <td className="dsh-mem-td"><span className="dsh-mem-badge" data-scope={e.scope}>{SCOPE_LABELS[e.scope] || e.scope}</span></td>
                  <td className="dsh-mem-td">{e.authorRole === 'master' ? '主人' : e.author}</td>
                  <td className="dsh-mem-td">
                    <button className="dsh-mem-btn dsh-mem-btnSmall" style={{ marginRight: '4px' }} onClick={() => openEdit(e)}>编辑</button>
                    <button className="dsh-mem-btn dsh-mem-btnDanger dsh-mem-btnSmall" onClick={() => handleDelete(e.id)}>删除</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 添加记忆弹窗 */}
      {showAdd && (
        <div className="dsh-mem-overlay" onClick={() => setShowAdd(false)}>
          <div className="dsh-mem-modal" onClick={e => e.stopPropagation()}>
            <h3 className="dsh-mem-modalTitle">添加记忆</h3>
            <label className="dsh-mem-modalLabel">内容</label>
            <textarea className="dsh-mem-modalTextarea" value={addContent} onChange={e => setAddContent(e.target.value)} placeholder="记忆内容" />
            <label className="dsh-mem-modalLabel">类型</label>
            <select className="dsh-mem-modalSelect" value={addType} onChange={e => setAddType(e.target.value)}>
              <option value="note">笔记</option>
              <option value="schedule_created">日程</option>
              <option value="todo_created">待办</option>
              <option value="decision">决策</option>
              <option value="conversation_summary">对话摘要</option>
            </select>
            <label className="dsh-mem-modalLabel">可见范围</label>
            <select className="dsh-mem-modalSelect" value={addScope} onChange={e => setAddScope(e.target.value)}>
              <option value="master">仅主人可见</option>
              <option value="self">主人+当事人</option>
              <option value="public">所有人可见</option>
            </select>
            <label className="dsh-mem-modalLabel">参与者 userid（逗号分隔）</label>
            <input className="dsh-mem-modalInput" value={addParticipants} onChange={e => setAddParticipants(e.target.value)} placeholder="userid1, userid2" />
            <div className="dsh-mem-btnRow">
              <button className="dsh-mem-btn" onClick={() => setShowAdd(false)}>取消</button>
              <button className="dsh-mem-btn dsh-mem-btnPrimary" onClick={handleAdd}>添加</button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑记忆弹窗 */}
      {editId !== null && (
        <div className="dsh-mem-overlay" onClick={() => setEditId(null)}>
          <div className="dsh-mem-modal" onClick={e => e.stopPropagation()}>
            <h3 className="dsh-mem-modalTitle">编辑记忆</h3>
            <label className="dsh-mem-modalLabel">内容</label>
            <textarea className="dsh-mem-modalTextarea" value={editContent} onChange={e => setEditContent(e.target.value)} />
            <label className="dsh-mem-modalLabel">可见范围</label>
            <select className="dsh-mem-modalSelect" value={editScope} onChange={e => setEditScope(e.target.value)}>
              <option value="master">仅主人可见</option>
              <option value="self">主人+当事人</option>
              <option value="public">所有人可见</option>
            </select>
            <label className="dsh-mem-modalLabel">参与者 userid（逗号分隔）</label>
            <input className="dsh-mem-modalInput" value={editParticipants} onChange={e => setEditParticipants(e.target.value)} placeholder="userid1, userid2" />
            <div className="dsh-mem-btnRow">
              <button className="dsh-mem-btn" onClick={() => setEditId(null)}>取消</button>
              <button className="dsh-mem-btn dsh-mem-btnPrimary" onClick={handleEdit}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
