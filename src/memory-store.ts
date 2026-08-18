/**
 * 共享记忆核心存储
 *
 * 采用 append-only 写入 + 文件锁，避免并发写入覆盖。
 * 存储位置：~/.dsh/im-channel/credentials/shared-memory.json
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, openSync, closeSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

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

function memoryPath(): string {
  return join(homedir(), '.dsh', 'im-channel', 'credentials', 'shared-memory.json')
}

function lockPath(): string {
  return memoryPath() + '.lock'
}

/** 简单的自旋文件锁 */
function acquireLock(timeoutMs = 2000): boolean {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const fd = openSync(lockPath(), 'wx')
      closeSync(fd)
      return true
    } catch {
      // 文件已存在，重试
    }
  }
  return false
}

function releaseLock(): void {
  try {
    if (existsSync(lockPath())) {
      unlinkSync(lockPath())
    }
  } catch {
    // 忽略释放失败
  }
}

/** 加载所有记忆 */
export function loadSharedMemory(): MemoryEntry[] {
  const path = memoryPath()
  if (!existsSync(path)) return []
  try {
    const store = JSON.parse(readFileSync(path, 'utf8')) as SharedMemoryStore
    return store.entries ?? []
  } catch {
    return []
  }
}

/** 保存记忆（带文件锁） */
export function saveSharedMemory(entries: MemoryEntry[]): boolean {
  const locked = acquireLock()
  if (!locked) return false

  try {
    const path = memoryPath()
    mkdirSync(join(path, '..'), { recursive: true })
    // 先写临时文件，再原子重命名，避免写入中断导致文件损坏
    const tmpPath = path + '.tmp'
    writeFileSync(tmpPath, `${JSON.stringify({ entries }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    renameSync(tmpPath, path)
    return true
  } finally {
    releaseLock()
  }
}

/** 生成唯一 ID */
function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** 添加一条记忆（带文件锁） */
export function addMemoryEntry(
  entry: Omit<MemoryEntry, 'id' | 'timestamp'>,
): MemoryEntry | null {
  const entries = loadSharedMemory()
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
  entries.push(newEntry)
  // 最多保留 500 条
  const trimmed = entries.slice(-500)

  if (!saveSharedMemory(trimmed)) return null
  return newEntry
}

/**
 * 根据当前用户身份过滤有权限读取的记忆
 *
 * 权限规则：
 * 1. 主人：可以读所有记忆
 * 2. 普通用户：可以读以下记忆
 *    - scope = public 的记忆
 *    - scope = self 且 author = 当前用户（自己写的）
 *    - scope = master 且 participants 包含当前用户（当事人）
 */
export function filterMemoriesByUser(
  entries: MemoryEntry[],
  userId: string,
  isMaster: boolean,
): MemoryEntry[] {
  if (isMaster) return entries // 主人能读一切

  return entries.filter(e => {
    if (e.scope === 'public') return true
    if (e.scope === 'self' && e.author === userId) return true
    if (e.scope === 'master' && e.participants?.includes(userId)) return true
    return false
  })
}

/** 获取记忆摘要文本（用于注入系统提示词） */
export function getMemorySummary(entries: MemoryEntry[]): string {
  if (entries.length === 0) return ''
  return `【共享记忆】你有 ${entries.length} 条相关记忆。如果需要查看，请使用 memory_read 工具。`
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
export function clearSharedMemory(): boolean {
  return saveSharedMemory([])
}

/** 更新一条记忆的部分字段（按 id 查找） */
export function updateMemoryEntry(
  id: string,
  updates: { content?: string; scope?: MemoryEntry['scope']; participants?: string[]; expireAt?: string },
): MemoryEntry | null {
  const entries = loadSharedMemory()
  const index = entries.findIndex(e => e.id === id)
  if (index === -1) return null

  const entry = entries[index]
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

  if (!saveSharedMemory(entries)) return null
  return entry
}

/** 删除一条记忆（按 id 查找） */
export function deleteMemoryEntry(id: string): boolean {
  const entries = loadSharedMemory()
  const index = entries.findIndex(e => e.id === id)
  if (index === -1) return false

  entries.splice(index, 1)
  return saveSharedMemory(entries)
}

/** 清除过期的记忆，返回清理数量 */
export function pruneExpiredMemories(): number {
  const entries = loadSharedMemory()
  const now = new Date().toISOString()
  const before = entries.length
  const filtered = entries.filter(e => !e.expireAt || e.expireAt > now)
  if (filtered.length === before) return 0
  saveSharedMemory(filtered)
  return before - filtered.length
}