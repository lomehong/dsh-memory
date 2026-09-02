// dsh-memory v2.1 冒烟测试：判断状态轨道 / 关系轨（轻量类型+开环）/ 装配回执
// 运行前必须设置 USERPROFILE 指向临时目录（避免触碰真实数据）：
//   USERPROFILE=<tmp> node tests/smoke-v21.mjs
import {
  addMemoryEntry, addRelationEntry, updateMemorySupport, closeOpenLoop, openLoopsForActor,
  loadSharedMemory, filterMemoriesByUser, effectiveSupport, effectiveStatementType,
  clearSharedMemory,
} from 'file:///D:/development/Coder/nodejs/dsh/dsh-memory/lib/memory-store.js'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const { assembleMemoryPack: assemble, loadReceipt } = await import('file:///D:/development/Coder/nodejs/dsh/dsh-memory/lib/memory-assemble.js')

let failed = 0
function check(name, cond, extra = '') {
  if (cond) { console.log(`  PASS ${name}`) } else { failed++; console.log(`  FAIL ${name} ${extra}`) }
}

// 冒烟假设干净库：清掉既有条目（归档区保留），保证顺序无关
await clearSharedMemory()

console.log('== 1. 判断状态轨道（缺省=提议中，权限类原地改） ==')
const f1 = await addMemoryEntry({ content: '客户预算约五万', type: 'note', scope: 'master', author: 'u-master', authorRole: 'master' })
check('缺省支持度=提议中', effectiveSupport(f1) === '提议中')
const up = await updateMemorySupport(f1.id, { state: '已支持', basis: '主人确认' })
check('支持度原地更新为已支持', up?.support?.state === '已支持' && up.lifecycle === undefined)
const down = await updateMemorySupport(f1.id, { state: '已动摇', basis: '客户口径反复' })
check('支持度可降为已动摇', down?.support?.state === '已动摇')

console.log('== 2. 关系轨（观察/推断 + 开环） ==')
const rel1 = await addRelationEntry({ actorId: 'act_a', kind: '观察', content: 'act_a 询问了 A 产品报价' })
const rel2 = await addRelationEntry({ actorId: 'act_a', kind: '推断', content: 'act_a 对价格敏感', openLoop: { via: '对话承诺' } })
check('关系轨 type=relation', rel1?.type === 'relation' && rel2?.type === 'relation')
check('关系轨强制候选', effectiveStatementType(rel1) === '候选')
check('观察条目不带开环', rel1?.relation?.openLoop === undefined)
check('开环条目未闭环', rel2?.relation?.openLoop?.closedAt === undefined)
check('openLoopsForActor 命中', openLoopsForActor('act_a').length === 1 && openLoopsForActor('act_a')[0]?.id === rel2?.id)
const closed = await closeOpenLoop(rel2.id, '主人确认已跟进')
check('闭环后不再出现在开环查询', closed?.relation?.openLoop?.closedAt !== undefined && openLoopsForActor('act_a').length === 0)

console.log('== 3. 关系轨可见性（当事人可知，他人不可见） ==')
await addMemoryEntry({ content: '主人私事', type: 'note', scope: 'master', author: 'u-master', authorRole: 'master' })
const all = loadSharedMemory()
const guestA = filterMemoriesByUser(all, 'act_a', false)
const guestB = filterMemoriesByUser(all, 'act_b', false)
check('当事人可见关系条目', guestA.some(e => e.id === rel1?.id))
check('其他访客不可见 act_a 的关系条目', !guestB.some(e => e.id === rel1?.id) && !guestB.some(e => e.id === rel2?.id))
check('其他访客不可见主人私事', !guestB.some(e => e.scope === 'master'))

console.log('== 4. 装配与回执 ==')
const { pack, receipt } = assemble({ userId: 'act_a', isMaster: false }, { keywords: ['报价'], limit: 10, turnId: 'turn-test-001' })
check('装配按可见性过滤（无主人私事）', pack.every(e => e.scope !== 'master'))
check('装配命中关键词', pack.some(e => e.content.includes('报价')))
check('回执 items 与 pack 等长', receipt.items.length === pack.length)
check('回执含 sha256', /^[0-9a-f]{64}$/.test(receipt.packSha256))
check('回执含支持度标注', receipt.items.every(i => ['提议中', '已支持', '已动摇'].includes(i.support)))
const back = loadReceipt('turn-test-001')
check('回执可从磁盘读回', back !== null && back.turnId === 'turn-test-001' && back.packSha256 === receipt.packSha256)
const masterView = assemble({ userId: 'u-master', isMaster: true }, { turnId: 'turn-test-002' })
check('主人视野大于访客（回执 items 更多）', masterView.receipt.items.length >= receipt.items.length)
try {
  assemble({ userId: '', isMaster: false })
  check('空 viewer fail-closed', false)
} catch {
  check('空 viewer fail-closed', true)
}

console.log(failed === 0 ? '\n全部通过 ✓' : `\n${failed} 项失败 ✗`)
process.exit(failed === 0 ? 0 : 1)
