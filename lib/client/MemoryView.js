/**
 * 共享记忆视图 - 对话区域的第三个 Tab
 *
 * 提供记忆管理界面，与 admin page 功能相同但作为 React 组件嵌入。
 */
import { useState, useEffect, useCallback } from 'react';
const SCOPE_LABELS = { master: '仅主人', self: '当事人', public: '公开' };
const SCOPE_COLORS = { master: '#fff3cd', self: '#d4edda', public: '#cce5ff' };
const SCOPE_TEXT = { master: '#856404', self: '#155724', public: '#004085' };
async function api(path, method = 'GET', body) {
    const opts = { method, headers: { Accept: 'application/json' } };
    if (body) {
        opts.headers = { ...opts.headers, 'Content-Type': 'application/json' };
        opts.body = JSON.stringify(body);
    }
    const res = await fetch(path, opts);
    return res.json();
}
export function MemoryView(_props) {
    const [entries, setEntries] = useState([]);
    const [search, setSearch] = useState('');
    const [scopeFilter, setScopeFilter] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [editId, setEditId] = useState(null);
    const [addContent, setAddContent] = useState('');
    const [addType, setAddType] = useState('note');
    const [addScope, setAddScope] = useState('master');
    const [addParticipants, setAddParticipants] = useState('');
    const [editContent, setEditContent] = useState('');
    const [editScope, setEditScope] = useState('master');
    const [editParticipants, setEditParticipants] = useState('');
    const load = useCallback(async () => {
        const d = await api('/dsh-memory/entries', 'GET');
        setEntries(d.entries ?? []);
    }, []);
    useEffect(() => { load(); }, [load]);
    const filtered = entries.filter(e => {
        if (search && !e.content.toLowerCase().includes(search.toLowerCase()) && !e.type.toLowerCase().includes(search.toLowerCase()))
            return false;
        if (scopeFilter && e.scope !== scopeFilter)
            return false;
        return true;
    });
    const now = new Date().toISOString();
    const expiredCount = entries.filter(e => e.expireAt && e.expireAt < now).length;
    async function handleAdd() {
        if (!addContent.trim()) {
            alert('请输入内容');
            return;
        }
        const p = addParticipants.split(',').map(s => s.trim()).filter(Boolean);
        const r = await api('/dsh-memory/entries', 'POST', { content: addContent, type: addType, scope: addScope, participants: p });
        if (r.ok) {
            setShowAdd(false);
            setAddContent('');
            setAddParticipants('');
            load();
        }
        else {
            alert('添加失败: ' + (r.error || '未知错误'));
        }
    }
    async function handleEdit() {
        if (!editId)
            return;
        const p = editParticipants.split(',').map(s => s.trim()).filter(Boolean);
        const r = await api('/dsh-memory/entries/update', 'POST', { id: editId, content: editContent, scope: editScope, participants: p });
        if (r.ok) {
            setEditId(null);
            load();
        }
        else {
            alert('更新失败: ' + (r.error || '未知错误'));
        }
    }
    async function handleDelete(id) {
        if (!confirm('确定删除？'))
            return;
        const r = await api('/dsh-memory/entries/delete', 'POST', { id });
        if (r.ok)
            load();
    }
    async function handleClear() {
        if (!confirm('确定清除所有记忆？'))
            return;
        const r = await api('/dsh-memory/clear', 'POST');
        if (r.ok)
            load();
    }
    async function handlePrune() {
        const r = await api('/dsh-memory/prune', 'POST');
        if (r.ok) {
            load();
            alert('已清除 ' + (r.pruned ?? 0) + ' 条过期记忆');
        }
    }
    function openEdit(e) {
        setEditId(e.id);
        setEditContent(e.content);
        setEditScope(e.scope);
        setEditParticipants((e.participants || []).join(', '));
    }
    const styles = {
        container: { padding: '16px', height: '100%', display: 'flex', flexDirection: 'column' },
        toolbar: { display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', flexWrap: 'wrap' },
        input: { flex: 1, minWidth: '150px', padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' },
        select: { padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' },
        btn: { padding: '6px 12px', border: 'none', borderRadius: '4px', fontSize: '13px', cursor: 'pointer' },
        btnPrimary: { background: '#4a6cf7', color: '#fff' },
        btnDanger: { background: '#e74c3c', color: '#fff' },
        btnSmall: { padding: '3px 8px', fontSize: '11px' },
        table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
        th: { padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #eee', background: '#fafafa', fontWeight: 600, color: '#666', fontSize: '12px' },
        td: { padding: '8px 10px', borderBottom: '1px solid #eee', fontSize: '13px' },
        content: { maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
        badge: { display: 'inline-block', padding: '2px 6px', borderRadius: '8px', fontSize: '11px', fontWeight: 600 },
        modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
        modal: { background: '#fff', borderRadius: '8px', padding: '20px', minWidth: '350px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' },
        modalLabel: { display: 'block', marginBottom: '4px', fontSize: '12px', color: '#666' },
        modalInput: { width: '100%', padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', marginBottom: '10px', boxSizing: 'border-box' },
        modalTextarea: { width: '100%', padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', marginBottom: '10px', minHeight: '60px', resize: 'vertical', boxSizing: 'border-box' },
        modalSelect: { width: '100%', padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', marginBottom: '10px', boxSizing: 'border-box' },
        btnRow: { display: 'flex', gap: '8px', justifyContent: 'flex-end' },
        expired: { opacity: 0.5 },
        stats: { display: 'flex', gap: '12px', marginBottom: '12px' },
        statCard: { background: '#fff', borderRadius: '6px', padding: '10px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', flex: 1 },
        statNum: { fontSize: '22px', fontWeight: 700, color: '#4a6cf7' },
        statLabel: { fontSize: '12px', color: '#666', marginTop: '2px' },
        scrollContainer: { flex: 1, overflow: 'auto' },
    };
    return (<div style={styles.container}>
      <div style={styles.stats}>
        <div style={styles.statCard}>
          <div style={styles.statNum}>{entries.length}</div>
          <div style={styles.statLabel}>总记忆</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNum}>{filtered.length}</div>
          <div style={styles.statLabel}>筛选后</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNum}>{expiredCount}</div>
          <div style={styles.statLabel}>已过期</div>
        </div>
      </div>

      <div style={styles.toolbar}>
        <input style={styles.input} placeholder="搜索记忆..." value={search} onChange={e => setSearch(e.target.value)}/>
        <select style={styles.select} value={scopeFilter} onChange={e => setScopeFilter(e.target.value)}>
          <option value="">所有范围</option>
          <option value="master">仅主人</option>
          <option value="self">当事人</option>
          <option value="public">公开</option>
        </select>
        <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => setShowAdd(true)}>+ 添加</button>
        <button style={{ ...styles.btn, ...styles.btnDanger, ...styles.btnSmall }} onClick={handleClear}>清除全部</button>
        <button style={{ ...styles.btn, ...styles.btnSmall }} onClick={handlePrune}>清除过期</button>
      </div>

      <div style={styles.scrollContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>时间</th>
              <th style={styles.th}>类型</th>
              <th style={styles.th}>内容</th>
              <th style={styles.th}>范围</th>
              <th style={styles.th}>作者</th>
              <th style={styles.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (<tr><td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: '#999', padding: '40px' }}>暂无记忆</td></tr>) : filtered.map(e => {
            const expired = e.expireAt && e.expireAt < now;
            const scopeColor = SCOPE_COLORS[e.scope] || '#e8e8e8';
            const scopeText = SCOPE_TEXT[e.scope] || '#555';
            return (<tr key={e.id} style={expired ? styles.expired : undefined}>
                  <td style={styles.td}>{(e.timestamp || '').slice(0, 19).replace('T', ' ')}</td>
                  <td style={styles.td}><span style={{ ...styles.badge, background: '#e8e8e8', color: '#555' }}>{e.type}</span></td>
                  <td style={{ ...styles.td, ...styles.content }} title={e.content}>{e.content}</td>
                  <td style={styles.td}><span style={{ ...styles.badge, background: scopeColor, color: scopeText }}>{SCOPE_LABELS[e.scope] || e.scope}</span></td>
                  <td style={styles.td}>{e.authorRole === 'master' ? '主人' : e.author}</td>
                  <td style={styles.td}>
                    <button style={{ ...styles.btn, ...styles.btnPrimary, ...styles.btnSmall, marginRight: '4px' }} onClick={() => openEdit(e)}>编辑</button>
                    <button style={{ ...styles.btn, ...styles.btnDanger, ...styles.btnSmall }} onClick={() => handleDelete(e.id)}>删除</button>
                  </td>
                </tr>);
        })}
          </tbody>
        </table>
      </div>

      {/* 添加记忆弹窗 */}
      {showAdd && (<div style={styles.modalOverlay} onClick={() => setShowAdd(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>添加记忆</h3>
            <label style={styles.modalLabel}>内容</label>
            <textarea style={styles.modalTextarea} value={addContent} onChange={e => setAddContent(e.target.value)} placeholder="记忆内容"/>
            <label style={styles.modalLabel}>类型</label>
            <select style={styles.modalSelect} value={addType} onChange={e => setAddType(e.target.value)}>
              <option value="note">笔记</option>
              <option value="schedule_created">日程</option>
              <option value="todo_created">待办</option>
              <option value="decision">决策</option>
              <option value="conversation_summary">对话摘要</option>
            </select>
            <label style={styles.modalLabel}>可见范围</label>
            <select style={styles.modalSelect} value={addScope} onChange={e => setAddScope(e.target.value)}>
              <option value="master">仅主人可见</option>
              <option value="self">主人+当事人</option>
              <option value="public">所有人可见</option>
            </select>
            <label style={styles.modalLabel}>参与者 userid（逗号分隔）</label>
            <input style={styles.modalInput} value={addParticipants} onChange={e => setAddParticipants(e.target.value)} placeholder="userid1, userid2"/>
            <div style={styles.btnRow}>
              <button style={{ ...styles.btn }} onClick={() => setShowAdd(false)}>取消</button>
              <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={handleAdd}>添加</button>
            </div>
          </div>
        </div>)}

      {/* 编辑记忆弹窗 */}
      {editId !== null && (<div style={styles.modalOverlay} onClick={() => setEditId(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>编辑记忆</h3>
            <label style={styles.modalLabel}>内容</label>
            <textarea style={styles.modalTextarea} value={editContent} onChange={e => setEditContent(e.target.value)}/>
            <label style={styles.modalLabel}>可见范围</label>
            <select style={styles.modalSelect} value={editScope} onChange={e => setEditScope(e.target.value)}>
              <option value="master">仅主人可见</option>
              <option value="self">主人+当事人</option>
              <option value="public">所有人可见</option>
            </select>
            <label style={styles.modalLabel}>参与者 userid（逗号分隔）</label>
            <input style={styles.modalInput} value={editParticipants} onChange={e => setEditParticipants(e.target.value)} placeholder="userid1, userid2"/>
            <div style={styles.btnRow}>
              <button style={{ ...styles.btn }} onClick={() => setEditId(null)}>取消</button>
              <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={handleEdit}>保存</button>
            </div>
          </div>
        </div>)}
    </div>);
}
