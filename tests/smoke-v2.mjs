// dsh-memory v2 冒烟测试：替代链 / 归档 / 过滤 / 认识论归一
// 运行前必须设置 USERPROFILE 指向临时目录（由外层 pwsh 设置），避免触碰真实数据
import {
  addMemoryEntry, updateMemoryEntry, archiveMemoryEntry, markMemorySuperseded,
  loadSharedMemory, loadArchivedMemories,
  filterMemoriesForRead, effectiveStatementType, effectiveLifecycle,
  MAX_ENTRIES,
} from '../lib/memory-store.js'

let failed = 0
function check(name, cond, extra = '') {
  if (cond) { console.log(`  PASS ${name}`) } else { failed++; console.log(`  FAIL ${name} ${extra}`) }
}

console.log('== 1. 写入默认值（主人=事实、访客=候选） ==')
const m1 = await addMemoryEntry({ content: '主人亲述', type: 'note', scope: 'master', author: 'u-master', authorRole: 'master' })
const g1 = await addMemoryEntry({ content: '访客转述', type: 'note', scope: 'self', author: 'u-guest', authorRole: 'guest' })
check('主人默认事实', m1?.statementType === '事实')
check('访客默认候选', g1?.statementType === '候选')

console.log('== 2. 认识论归一 ==')
const v1 = await addMemoryEntry({ content: '声称已验证但无依据', type: 'note', scope: 'master', author: 'u-master', authorRole: 'master', statementType: '已验证结果' })
check('已验证结果无依据回落候选', v1?.statementType === '候选')
const a1 = await addMemoryEntry({ content: '授权条目', type: 'decision', scope: 'master', author: 'u-master', authorRole: 'master', statementType: '授权' })
check('授权缺省补未授权', a1?.auth?.status === '未授权')

console.log('== 3. 替代语义（陈述类变更） ==')
const up = await updateMemoryEntry(m1.id, { content: '修订后的内容', statementType: '偏好' }, { author: 'u-master', authorRole: 'master' })
const after = loadSharedMemory()
const oldEntry = after.find(e => e.id === m1.id)
check('产生新条目', up !== null && up.id !== m1.id)
check('旧条目标记已替代', oldEntry?.lifecycle?.state === '已替代')
check('双向链接 supersededBy', oldEntry?.lifecycle?.supersededBy === up?.id)
check('双向链接 supersedes', up?.lifecycle?.supersedes === m1.id)
check('新条目继承变更', up?.statementType === '偏好' && up?.content === '修订后的内容')

console.log('== 4. 权限类变更原地生效 ==')
const perm = await updateMemoryEntry(g1.id, { scope: 'public' }, { author: 'u-master', authorRole: 'master' })
check('scope 原地修改', perm?.id === g1.id && perm?.scope === 'public' && perm.lifecycle === undefined)

console.log('== 5. 读取过滤 ==')
const all = loadSharedMemory()
const currentOnly = filterMemoriesForRead(all)
check('默认不含已替代', !currentOnly.some(e => e.id === m1.id) && currentOnly.some(e => e.id === up.id))
const withHistory = filterMemoriesForRead(all, { includeSuperseded: true })
check('includeSuperseded 含历史', withHistory.some(e => e.id === m1.id))
const onlyAuth = filterMemoriesForRead(all, { statementType: '授权' })
check('按陈述类型过滤', onlyAuth.length === 1 && onlyAuth[0].id === a1.id)

console.log('== 6. 手动归档 ==')
const arc = await archiveMemoryEntry(a1.id)
check('归档成功', arc === true)
check('活跃集已移除', !loadSharedMemory().some(e => e.id === a1.id))
check('归档区可查回', loadArchivedMemories().some(e => e.id === a1.id && e.lifecycle?.state === '已归档'))

console.log(`== 7. 容量淘汰：写入 ${MAX_ENTRIES + 10} 条，活跃集应保持 ${MAX_ENTRIES}，超出者进归档 ==`)
// 先记下当前归档基线
const archiveBaseline = loadArchivedMemories().length
for (let i = 0; i < MAX_ENTRIES + 10; i++) {
  const r = await addMemoryEntry({ content: `bulk-${i}`, type: 'note', scope: 'master', author: 'u-bulk', authorRole: 'master' })
  if (r === null) { check('批量写入失败', false); break }
}
const active = loadSharedMemory()
const archived = loadArchivedMemories()
check(`活跃集 = ${MAX_ENTRIES}`, active.length === MAX_ENTRIES, `actual=${active.length}`)
check('超出者进归档而非消失', archived.length >= archiveBaseline + 10, `archived=${archived.length}`)
check('授权条目受保护', archived.every(e => e.id === a1.id || effectiveStatementType(e) !== '授权'))

console.log('== 8. 旧条目兼容（模拟无新字段的历史文件结构） ==')
const legacy = { id: 'legacy1', timestamp: '2026-01-01T00:00:00.000Z', type: 'note', content: '旧条目', author: 'x', authorRole: 'guest', scope: 'self' }
check('缺省陈述类型=候选', effectiveStatementType(legacy) === '候选')
check('缺省生命周期=当前', effectiveLifecycle(legacy) === '当前')

console.log('== 9. markMemorySuperseded（治理流程用：不删除、仅推进生命周期） ==')
const s1 = await addMemoryEntry({ content: '去重源A', type: 'note', scope: 'master', author: 'u-dedup', authorRole: 'master' })
const s2 = await addMemoryEntry({ content: '去重源B', type: 'note', scope: 'master', author: 'u-dedup', authorRole: 'master' })
const mk = await markMemorySuperseded(s1.id, s2.id, '去重合并')
const s1After = loadSharedMemory().find(e => e.id === s1.id)
check('标记成功', mk === true)
check('内容保留', s1After?.content === '去重源A')
check('状态已替代且指向新条目', s1After?.lifecycle?.state === '已替代' && s1After?.lifecycle?.supersededBy === s2.id)
const curAfterDedup = filterMemoriesForRead(loadSharedMemory())
check('默认读取不再包含已替代', !curAfterDedup.some(e => e.id === s1.id))

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
