/**
 * 共享记忆核心存储
 *
 * 所有读-改-写操作（新增/更新/删除/清除/清理过期）都在文件锁内完成整个事务，
 * 避免并发写入覆盖或丢失更新；写入先写临时文件再原子重命名，防止中断损坏。
 * 存储位置：~/.dsh/im-channel/credentials/shared-memory.json
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, openSync, closeSync, unlinkSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** 记忆条目 */
export interface MemoryEntry {
  id: string
  timestamp: string
  type: string
  content: string
  author: string
  authorRole: 'master' | 'guest'
  scope: 'master' | 'self' | 'public'
  participants?: string[]
  refId?: string
  /** 过期时间（ISO 字符串），过期后自动清理；不设则永不过期 */
  expireAt?: string
}

/** 存储结构 */
export interface SharedMemoryStore {
  entries: MemoryEntry[]
}

/** 最多保留的记忆条数 */
export const MAX_ENTRIES = 500
/** 获取锁的总超时 */
const LOCK_TIMEOUT_MS = 5000
/** 自旋重试间隔（异步等待，不阻塞事件循环） */
const LOCK_RETRY_MS = 50
/** 锁陈旧阈值：锁文件存在超过该时长视为持有者已崩溃，可接管 */
const LOCK_STALE_MS = 15000

function memoryPath(): string {
  return join(homedir(), '.dsh', 'im-channel', 'credentials', 'shared-memory.json')
}

function lockPath(): string {
  return memoryPath() + '.lock'
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 异步自旋文件锁：'wx' 原子创建锁文件。
 * - 等待期间 await 让出事件循环，不做同步忙等
 * - 锁文件超过 LOCK_STALE_MS 视为持有者崩溃残留，直接接管，避免永久死锁
 */
async function acquireLock(timeoutMs: number = LOCK_TIMEOUT_MS): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const fd = openSync(lockPath(), 'wx')
      closeSync(fd)
      return true
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code !== 'EEXIST') {
        // 非锁竞争（如首次运行时父目录不存在）：修复环境后重试，
        // 不能当作“锁被占用”否则永远无法获锁
        try {
          mkdirSync(dirname(lockPath()), { recursive: true })
        } catch {
          // 忽略，下轮重试
        }
        await sleep(LOCK_RETRY_MS)
        continue
      }
      // 文件已存在：尝试接管陈旧锁
      try {
        const st = statSync(lockPath())
        if (Date.now() - st.mtimeMs > LOCK_STALE_MS) {
          unlinkSync(lockPath())
          continue
        }
      } catch {
        // 锁文件刚被其他进程释放，直接进入下一轮尝试
      }
      await sleep(LOCK_RETRY_MS)
    }
  }
  return false
}

function releaseLock(): void {
  try {
    unlinkSync(lockPath())
  } catch {
    // 锁已不存在或释放失败，忽略
  }
}

/** 持锁执行事务；获取锁失败返回 { locked: false } */
type LockedResult<T> = { locked: true; value: T } | { locked: false }

async function withLock<T>(fn: () => T): Promise<LockedResult<T>> {
  if (!(await acquireLock())) return { locked: false }
  try {
    return { locked: true, value: fn() }
  } finally {
    releaseLock()
  }
}

/** 加载所有记忆 */
export function loadSharedMemory(): MemoryEntry[] {
  const path = memoryPath()
  if (!existsSync(path)) return []
  try {
    const store = JSON.parse(readFileSync(path, 'utf8')) as SharedMemoryStore
    return Array.isArray(store.entries) ? store.entries : []
  } catch {
    // 文件损坏：先重命名备份，历史保留在 .corrupt-* 文件中可人工恢复，
    // 避免下一次写入在空数组上覆盖全部历史。
    try {
      renameSync(path, `${path}.corrupt-${Date.now()}`)
    } catch {
      // 备份失败时只能返回空
    }
    return []
  }
}

/** 写入条目（调用方必须已持锁） */
function writeEntriesUnlocked(entries: MemoryEntry[]): void {
  const path = memoryPath()
  mkdirSync(dirname(path), { recursive: true })
  // 先写临时文件，再原子重命名，避免写入中断导致文件损坏；
  // 临时文件名带 pid，避免并发进程互相覆盖临时文件
  const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(tmpPath, `${JSON.stringify({ entries }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  renameSync(tmpPath, path)
}

/** 生成唯一 ID */
function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** 添加一条记忆（整个读-改-写在锁内完成） */
export async function addMemoryEntry(
  entry: Omit<MemoryEntry, 'id' | 'timestamp'>,
): Promise<MemoryEntry | null> {
  const participants = entry.participants
  const newEntry: MemoryEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    content: entry.content,
    type: entry.type,
    scope: entry.scope,
    author: entry.author,
    authorRole: entry.authorRole,
    ...(participants !== undefined ? { participants } : {}),
    ...(entry.refId !== undefined ? { refId: entry.refId } : {}),
    ...(entry.expireAt !== undefined ? { expireAt: entry.expireAt } : {}),
  }

  const result = await withLock(() => {
    const entries = loadSharedMemory()
    entries.push(newEntry)
    // 最多保留 MAX_ENTRIES 条（淘汰最旧）
    writeEntriesUnlocked(entries.slice(-MAX_ENTRIES))
  })
  return result.locked ? newEntry : null
}

/**
 * 根据当前用户身份过滤有权限读取的记忆
 *
 * 权限规则：
 * 1. 主人：可以读所有记忆
 * 2. 普通用户：可以读以下记忆
 *    - scope = public 的记忆
 *    - participants 包含当前用户的记忆（任意 scope，当事人可知）
 *    - scope = self 且 author = 当前用户（自己写的）
 */
export function filterMemoriesByUser(
  entries: MemoryEntry[],
  userId: string,
  isMaster: boolean,
): MemoryEntry[] {
  if (isMaster) return entries // 主人能读一切

  return entries.filter(e => {
    if (e.scope === 'public') return true
    if (e.participants?.includes(userId)) return true
    if (e.scope === 'self' && e.author === userId) return true
    return false
  })
}

/** 获取记忆摘要文本（用于注入系统提示词） */
export function getMemorySummary(entries: MemoryEntry[]): string {
  if (entries.length === 0) return ''
  return `【共享记忆】你共有 ${entries.length} 条共享记忆。如果需要查看，请使用 memory_read 工具。`
}

/** 按关键词搜索 */
export function searchMemories(entries: MemoryEntry[], keyword: string): MemoryEntry[] {
  const kw = keyword.toLowerCase()
  return entries.filter(e =>
    e.content.toLowerCase().includes(kw) ||
    e.type.toLowerCase().includes(kw)
  )
}

/** 清除所有记忆 */
export async function clearSharedMemory(): Promise<boolean> {
  const result = await withLock(() => writeEntriesUnlocked([]))
  return result.locked
}

/** 更新一条记忆的部分字段（按 id 查找） */
export async function updateMemoryEntry(
  id: string,
  updates: { content?: string; scope?: MemoryEntry['scope']; participants?: string[]; expireAt?: string },
): Promise<MemoryEntry | null> {
  const result = await withLock((): MemoryEntry | null => {
    const entries = loadSharedMemory()
    const entry = entries.find(e => e.id === id)
    if (entry === undefined) return null

    if (updates.content !== undefined) entry.content = updates.content
    if (updates.scope !== undefined) entry.scope = updates.scope
    if (updates.participants !== undefined) {
      if (updates.participants.length > 0) {
        entry.participants = updates.participants
      } else {
        delete entry.participants
      }
    }
    if (updates.expireAt !== undefined) {
      entry.expireAt = updates.expireAt
    }

    writeEntriesUnlocked(entries)
    return entry
  })
  return result.locked ? result.value : null
}

/** 删除一条记忆（按 id 查找） */
export async function deleteMemoryEntry(id: string): Promise<boolean> {
  const result = await withLock((): boolean => {
    const entries = loadSharedMemory()
    const index = entries.findIndex(e => e.id === id)
    if (index === -1) return false
    entries.splice(index, 1)
    writeEntriesUnlocked(entries)
    return true
  })
  return result.locked ? result.value : false
}

/** 清除过期的记忆，返回清理数量 */
export async function pruneExpiredMemories(): Promise<number> {
  const result = await withLock((): number => {
    const entries = loadSharedMemory()
    const now = new Date().toISOString()
    const filtered = entries.filter(e => !e.expireAt || e.expireAt > now)
    if (filtered.length === entries.length) return 0
    writeEntriesUnlocked(filtered)
    return entries.length - filtered.length
  })
  return result.locked ? result.value : 0
}
