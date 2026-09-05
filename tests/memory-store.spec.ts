/**
 * 记忆存储 vitest 骨架（宪章 G-04）：迁移、可见性过滤、装配回执。
 *
 * 隔离：homedir() 与 DSH_HOME 均指向每次运行的临时目录——
 * 旧机器级路径（~/.dsh/im-channel/credentials/）与实例级路径
 * （$DSH_HOME/dsh-memory/）都落在沙箱内，绝不触碰真实数据。
 */
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 每个用例独立的临时目录（beforeEach 重建；mock 闭包在调用时读取）
let home = ''
let dshHome = ''
const tempDirs: string[] = []

vi.mock('node:os', async importOriginal => {
  const actual = await importOriginal<typeof import('node:os')>()
  return { ...actual, homedir: () => home }
})

// 供测试写入的夹具构造
function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `m-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: '2026-09-05T00:00:00.000Z',
    type: 'note',
    content: '测试记忆',
    author: 'master',
    authorRole: 'master',
    scope: 'master',
    ...overrides,
  }
}

describe('记忆库迁移（宪章 #02）', () => {
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'dsh-mem-home-'))
    dshHome = mkdtempSync(join(tmpdir(), 'dsh-mem-state-'))
    process.env.DSH_HOME = dshHome
  })
  afterEach(() => {
    delete process.env.DSH_HOME
    for (const dir of tempDirs.splice(0).reverse()) {
      try { rmSync(dir, { recursive: true, force: true }) } catch { /* Windows 锁由系统清理 */ }
    }
  })

  it('首次读取把旧机器级路径的存储复制到实例级目录', async () => {
    const { loadSharedMemory } = await import('../src/memory-store.ts')
    const legacyFile = join(home, '.dsh', 'im-channel', 'credentials', 'shared-memory.json')
    mkdirSync(join(legacyFile, '..'), { recursive: true })
    writeFileSync(legacyFile, JSON.stringify({ entries: [entry({ content: '旧库记忆' })] }), 'utf8')

    const entries = loadSharedMemory()
    expect(entries.map(e => e.content)).toContain('旧库记忆')
    expect(existsSync(join(dshHome, 'dsh-memory', 'shared-memory.json'))).toBe(true)
    expect(existsSync(legacyFile)).toBe(true) // 旧文件保留（迁移前备份）
  })

  it('新位置已有文件时不覆盖（迁移幂等）', async () => {
    const { loadSharedMemory } = await import('../src/memory-store.ts')
    mkdirSync(join(dshHome, 'dsh-memory'), { recursive: true })
    writeFileSync(join(dshHome, 'dsh-memory', 'shared-memory.json'), JSON.stringify({ entries: [entry({ content: '实例级已有' })] }), 'utf8')
    const legacyFile = join(home, '.dsh', 'im-channel', 'credentials', 'shared-memory.json')
    mkdirSync(join(legacyFile, '..'), { recursive: true })
    writeFileSync(legacyFile, JSON.stringify({ entries: [entry({ content: '旧库' })] }), 'utf8')

    const entries = loadSharedMemory()
    expect(entries.map(e => e.content)).toEqual(['实例级已有'])
  })
})

describe('filterMemoriesByUser 可见性（宪章 #03 数据面）', () => {
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'dsh-mem-home-'))
    dshHome = mkdtempSync(join(tmpdir(), 'dsh-mem-state-'))
    process.env.DSH_HOME = dshHome
  })
  afterEach(() => {
    delete process.env.DSH_HOME
    for (const dir of tempDirs.splice(0).reverse()) {
      try { rmSync(dir, { recursive: true, force: true }) } catch { /* 忽略 */ }
    }
  })

  it('主人可见一切；访客仅公开/当事人/自写', async () => {
    // addMemoryEntry 走异步文件锁：夹具必须逐条 await 落盘后再断言
    const { addMemoryEntry, loadSharedMemory, filterMemoriesByUser } = await import('../src/memory-store.ts')
    await addMemoryEntry({ content: '主人私密', type: 'note', scope: 'master', author: 'master', authorRole: 'master' })
    await addMemoryEntry({ content: '公开事实', type: 'note', scope: 'public', author: 'master', authorRole: 'master' })
    await addMemoryEntry({ content: '当事人事项', type: 'note', scope: 'self', author: 'master', authorRole: 'master', participants: ['guest-1'] })

    expect(filterMemoriesByUser(loadSharedMemory(), 'master', true)).toHaveLength(3)
    const guestSees = filterMemoriesByUser(loadSharedMemory(), 'guest-1', false)
    expect([...guestSees.map(e => e.content)].sort()).toEqual(['公开事实', '当事人事项'])
    expect(filterMemoriesByUser(loadSharedMemory(), 'guest-other', false).map(e => e.content)).toEqual(['公开事实'])
  })
})

describe('assembleMemoryPack（按回合装配，宪章第三阶段）', () => {
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'dsh-mem-home-'))
    dshHome = mkdtempSync(join(tmpdir(), 'dsh-mem-state-'))
    process.env.DSH_HOME = dshHome
  })
  afterEach(() => {
    delete process.env.DSH_HOME
    for (const dir of tempDirs.splice(0).reverse()) {
      try { rmSync(dir, { recursive: true, force: true }) } catch { /* 忽略 */ }
    }
  })

  it('按可见性装配记忆包并把审计回执落到 $DSH_HOME/dsh-memory/receipts', async () => {
    const { addMemoryEntry } = await import('../src/memory-store.ts')
    const { assembleMemoryPack } = await import('../src/memory-assemble.ts')
    await addMemoryEntry({ content: '项目周会安排在周五', type: 'note', scope: 'master', author: 'master', authorRole: 'master', statementType: '事实' })

    const result = assembleMemoryPack({ userId: 'master', isMaster: true }, { keywords: ['周会'], limit: 8 })
    expect(result.pack.length).toBeGreaterThan(0)
    expect(existsSync(join(dshHome, 'dsh-memory', 'receipts'))).toBe(true)
  })
})
