/**
 * 装配与回执（v2.1，实施计划 T5 / 设计文档 v0.2 决策七；v2 增 关系摘要段）
 *
 * 视野回执：每轮对外会话的记忆装配生成轻量回执（取了哪些记忆、可见性
 * 依据、支持度、字节量、摘要），落入审计日志——泄露调查能精确回答
 * "对话者当时看见了什么"；对外陈述可归因到具体记忆条目。
 *
 * 回执是事后审计件而非事前门禁：不做逐请求授权与原子发布（对话流
 * 承受不起），仅落盘 + 滚动清理（默认 90 天）。
 *
 * v2：自动回注关系摘要段。当 viewer.actorId 命中既有关系轨条目时，按
 * 「未闭环开环（按时间倒序，最多 5 条）→ 近期观察/推断（最多 5 条，
 * 标注「推断」）→ 字节预算」确定性选取。回执同时记录关系摘要段字节数
 * 与 sha256——同 pack 一样可回查。仍受 v1 可见性规则约束（master/当事人可见）。
 */
import { mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import {
  loadSharedMemory,
  filterMemoriesByUser,
  filterMemoriesForRead,
  searchMemories,
  effectiveStatementType,
  effectiveSupport,
  effectiveLifecycle,
  type MemoryEntry,
  type StatementType,
  type SupportState,
} from './memory-store.ts'

export interface AssembleViewer {
  userId: string
  isMaster: boolean
  /** v2 增：当前对话者注册表 id（用于关系摘要回注；缺省 = 不回注关系段） */
  actorId?: string
}

export interface AssembleQuery {
  keywords?: string[]
  statementType?: StatementType
  /** 最多注入条数（默认 20，上限 50） */
  limit?: number
  /** 回合标识（缺省自动生成） */
  turnId?: string
}

export interface ReceiptItem {
  id: string
  bytes: number
  statementType: StatementType
  support: SupportState
  visibilityRule: 'master' | 'public' | 'participant' | 'self-author'
}

export interface RelationDigestItem {
  memoryId: string
  content: string
  kind: '观察' | '推断'
  /** 「推断」标记；观察项此字段为空字符串 */
  inferred: string
  /** 未闭环时间戳（仅开环项） */
  openLoopAt?: string
  ts: string
}

export interface RelationDigest {
  actorId: string
  openLoops: RelationDigestItem[]
  observations: RelationDigestItem[]
  bytes: number
  sha256: string
  truncated: boolean
}

export interface AssemblyReceipt {
  turnId: string
  at: string
  viewer: { userId: string; isMaster: boolean }
  items: ReceiptItem[]
  totalBytes: number
  packSha256: string
  /** v2 增：actorId 命中时随 pack 一起装配的关系摘要段 */
  relationDigest?: RelationDigest
}

export interface AssembleResult {
  pack: MemoryEntry[]
  receipt: AssemblyReceipt
}

function visibilityRuleOf(e: MemoryEntry, userId: string, isMaster: boolean): ReceiptItem['visibilityRule'] {
  if (isMaster) return 'master'
  if (e.scope === 'public') return 'public'
  if (e.participants?.includes(userId)) return 'participant'
  return 'self-author'
}

function receiptDir(): string {
  const base = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(base, 'dsh-memory', 'receipts')
}

/**
 * 装配：可见性过滤 → 生命周期过滤 → 关键词检索 → 截断，并生成回执。
 * fail-closed：viewer 字段缺失直接抛错（不发布部分上下文）。
 */
export function assembleMemoryPack(viewer: AssembleViewer, query: AssembleQuery = {}): AssembleResult {
  if (typeof viewer?.userId !== 'string' || viewer.userId === '') {
    throw new Error('assemble: viewer.userId 不能为空')
  }
  const limit = Math.max(1, Math.min(50, query.limit ?? 20))
  let visible = filterMemoriesByUser(loadSharedMemory(), viewer.userId, viewer.isMaster)
  visible =
    query.statementType !== undefined
      ? filterMemoriesForRead(visible, { statementType: query.statementType })
      : filterMemoriesForRead(visible)
  if (query.keywords !== undefined && query.keywords.length > 0) {
    for (const kw of query.keywords) {
      visible = searchMemories(visible, kw)
    }
  }
  const pack = visible.slice(-limit)

  const items: ReceiptItem[] = pack.map(e => ({
    id: e.id,
    bytes: Buffer.byteLength(e.content, 'utf8'),
    statementType: effectiveStatementType(e),
    support: effectiveSupport(e),
    visibilityRule: visibilityRuleOf(e, viewer.userId, viewer.isMaster),
  }))

  // v2 关系摘要段：viewer.actorId 命中时确定性选取（开环优先 → 字节预算 → 标记 truncated）
  const relationDigest = buildRelationDigest(viewer, pack.length)

  const packJson = JSON.stringify(pack)
  const receipt: AssemblyReceipt = {
    turnId: query.turnId ?? `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    viewer: { userId: viewer.userId, isMaster: viewer.isMaster },
    items,
    totalBytes: Buffer.byteLength(packJson, 'utf8'),
    packSha256: createHash('sha256').update(packJson).digest('hex'),
    ...(relationDigest !== undefined ? { relationDigest } : {}),
  }
  saveReceipt(receipt)
  return { pack, receipt }
}

/** v2 关系摘要段：硬预算 + 确定性选取。返回 undefined 表示未命中或无关系条目。 */
function buildRelationDigest(viewer: AssembleViewer, packSize: number): RelationDigest | undefined {
  if (typeof viewer.actorId !== 'string' || viewer.actorId === '') return undefined
  const actorId = viewer.actorId
  const entries = loadSharedMemory().filter(
    e =>
      e.relation !== undefined &&
      e.relation?.actorId === actorId &&
      effectiveLifecycle(e) === '当前',
  )
  if (entries.length === 0) return undefined
  // 可见性过滤（复用既有语义——他人不可见本对话者的关系条目）
  const visible = filterMemoriesByUser(entries, viewer.userId, viewer.isMaster)
  if (visible.length === 0) return undefined

  // 开环优先：按时间倒序（openLoopAt 缺省 = entry.timestamp）
  const openLoopEntries = visible
    .filter(e => e.relation?.openLoop !== undefined && e.relation.openLoop.closedAt === undefined)
    .sort((a, b) => String(b.relation?.openLoop?.openedAt ?? b.timestamp).localeCompare(String(a.relation?.openLoop?.openedAt ?? a.timestamp)))

  // 近期观察/推断：全部关系条目（按 timestamp 倒序）
  const recentEntries = [...visible].sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  // 选取策略：开环全收（最多 5） + 近期补足（推断在前，最多 5），
  // 按时间倒序排序、按预算截断——开环优先保证
  const picked: RelationDigestItem[] = []
  const seen = new Set<string>()
  for (const e of openLoopEntries) {
    if (picked.length >= 5) break
    if (seen.has(e.id)) continue
    seen.add(e.id)
    picked.push(toDigestItem(e))
  }
  for (const e of recentEntries) {
    if (picked.length >= 10) break
    if (seen.has(e.id)) continue
    seen.add(e.id)
    picked.push(toDigestItem(e))
  }
  if (picked.length === 0) return undefined

  // 按时间倒序排列，开环在前（同时间按 picked 索引稳定排序）
  picked.sort((a, b) => b.ts.localeCompare(a.ts))

  // 字节预算（默认 1200 字节，超限截断并标 truncated）
  const budget = 1200
  const packedJson = JSON.stringify({ actorId, items: picked })
  const baseBytes = Buffer.byteLength(`{"actorId":${JSON.stringify(actorId)},"items":[]}`, 'utf8')
  if (baseBytes >= budget) {
    // actorId 自身就超预算的极端情况：返回最简骨架（理论几乎不可能）
    return { actorId, openLoops: [], observations: [], bytes: baseBytes, sha256: createHash('sha256').update('').digest('hex'), truncated: true }
  }
  const fitted = fitToBudget(picked, budget - baseBytes)
  const body = JSON.stringify({ actorId, items: fitted })
  const sha256 = createHash('sha256').update(body).digest('hex')
  const openLoops = fitted.filter(i => i.openLoopAt !== undefined)
  const observations = fitted.filter(i => i.openLoopAt === undefined)
  return {
    actorId,
    openLoops,
    observations,
    bytes: Buffer.byteLength(body, 'utf8'),
    sha256,
    truncated: fitted.length < picked.length,
  }
}

function toDigestItem(e: MemoryEntry): RelationDigestItem {
  const rel = e.relation!
  return {
    memoryId: e.id,
    content: e.content,
    kind: rel.kind,
    inferred: rel.kind === '推断' ? '「推断」' : '',
    ...(rel.openLoop !== undefined && rel.openLoop.closedAt === undefined
      ? { openLoopAt: rel.openLoop.openedAt }
      : {}),
    ts: rel.openLoop?.openedAt ?? e.timestamp,
  }
}

/** 贪心按预算装填：超预算则丢弃低优先项（前面的优先）。 */
function fitToBudget(items: RelationDigestItem[], remainingBytes: number): RelationDigestItem[] {
  const out: RelationDigestItem[] = []
  let used = 0
  for (const it of items) {
    const inc = Buffer.byteLength(JSON.stringify(it), 'utf8') + (out.length === 0 ? 0 : 1)
    if (used + inc > remainingBytes) break
    out.push(it)
    used += inc
  }
  return out
}

/** 回执落盘（<dir>/<日期>/<turnId>.json，0600），并滚动清理 90 天前的目录 */
export function saveReceipt(receipt: AssemblyReceipt): void {
  const dir = join(receiptDir(), receipt.at.slice(0, 10))
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `${receipt.turnId}.json`)
  const tmp = `${path}.tmp-${process.pid}`
  writeFileSync(tmp, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  renameSync(tmp, path)
  cleanupReceipts(90)
}

/** 清理超过 keepDays 的回执目录 */
export function cleanupReceipts(keepDays: number): number {
  const root = receiptDir()
  if (!existsSync(root)) return 0
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000
  let removed = 0
  for (const name of readdirSync(root)) {
    const dir = join(root, name)
    try {
      if (!existsSync(dir)) continue
      const statOk = /^\d{4}-\d{2}-\d{2}$/.test(name)
      if (!statOk) continue
      const dirTime = new Date(name + 'T00:00:00Z').getTime()
      if (dirTime < cutoff) {
        rmSync(dir, { recursive: true, force: true })
        removed += 1
      }
    } catch {
      // 单目录失败跳过
    }
  }
  return removed
}

/** 读取一份回执（审计/调查用） */
export function loadReceipt(turnId: string): AssemblyReceipt | null {
  const root = receiptDir()
  if (!existsSync(root)) return null
  for (const day of readdirSync(root)) {
    const path = join(root, day, `${turnId}.json`)
    if (existsSync(path)) {
      try {
        return JSON.parse(readFileSync(path, 'utf8')) as AssemblyReceipt
      } catch {
        return null
      }
    }
  }
  return null
}

/** 注册 HTTP 路由（POST /dsh-memory/assemble；写路由 sameOrigin）。路由随 webServer 存活，无需单独 disposer */
export function registerAssembleApi(web: {
  register: (route: { kind: string; path: string; handler: (req: unknown, res: unknown) => void }) => void
}): void {
  web.register({
      kind: 'exact',
      path: '/dsh-memory/assemble',
      handler: (req, res) => {
        const r = req as { method?: string; headers: Record<string, string | string[] | undefined>; on: (ev: string, cb: (c: Buffer) => void) => void; resume: () => void; destroy: () => void }
        const resLike = res as { writeHead: (s: number, h: Record<string, string>) => void; end: (b: string) => void }
        if (r.method !== 'POST') {
          resLike.writeHead(405, { 'Content-Type': 'application/json' })
          resLike.end(JSON.stringify({ ok: false, error: 'method not allowed' }))
          return
        }
        const chunks: Buffer[] = []
        let size = 0
        r.on('data', c => {
          size += c.length
          if (size > 64 * 1024) r.destroy()
          else chunks.push(c)
        })
        r.on('end', () => {
          try {
            const origin = r.headers.origin
            if (origin !== undefined) {
              const host = r.headers.host
              if (typeof host !== 'string' || new URL(String(origin)).host !== host) {
                resLike.writeHead(403, { 'Content-Type': 'application/json' })
                resLike.end(JSON.stringify({ ok: false, error: 'cross-origin denied' }))
                return
              }
            }
            const body = JSON.parse(chunks.map(c => c.toString('utf8')).join('') || '{}') as {
              userId?: string
              isMaster?: boolean
              keywords?: string[]
              statementType?: StatementType
              limit?: number
              turnId?: string
              actorId?: string
            }
            const viewer: { userId: string; isMaster: boolean; actorId?: string } = {
              userId: String(body.userId ?? ''),
              isMaster: body.isMaster === true,
              ...(typeof body.actorId === 'string' && body.actorId !== '' ? { actorId: body.actorId } : {}),
            }
            const result = assembleMemoryPack(
              viewer,
              {
                ...(Array.isArray(body.keywords) ? { keywords: body.keywords.map(k => String(k)).slice(0, 5) } : {}),
                ...(body.statementType !== undefined ? { statementType: body.statementType } : {}),
                ...(body.limit !== undefined ? { limit: Number(body.limit) } : {}),
                ...(body.turnId !== undefined ? { turnId: String(body.turnId).slice(0, 80) } : {}),
              },
            )
            resLike.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
            resLike.end(JSON.stringify({ ok: true, pack: result.pack, receipt: result.receipt }))
          } catch (e) {
            resLike.writeHead(400, { 'Content-Type': 'application/json' })
            resLike.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }))
          }
        })
    },
  })
  // v2 关系开环闭环：POST /dsh-memory/openloop/close {memoryId, via}
  web.register({
    kind: 'exact',
    path: '/dsh-memory/openloop/close',
    handler: (req, res) => {
      const r = req as { method?: string; headers: Record<string, string | string[] | undefined>; on: (ev: string, cb: (c: Buffer) => void) => void; resume: () => void; destroy: () => void }
      const resLike = res as { writeHead: (s: number, h: Record<string, string>) => void; end: (b: string) => void }
      if (r.method !== 'POST') {
        resLike.writeHead(405, { 'Content-Type': 'application/json' })
        resLike.end(JSON.stringify({ ok: false, error: 'method not allowed' }))
        return
      }
      const chunks: Buffer[] = []
      let size = 0
      r.on('data', c => {
        size += c.length
        if (size > 16 * 1024) r.destroy()
        else chunks.push(c)
      })
      r.on('end', () => {
        void (async () => {
          try {
            const origin = r.headers.origin
            if (origin !== undefined) {
              const host = r.headers.host
              if (typeof host !== 'string' || new URL(String(origin)).host !== host) {
                resLike.writeHead(403, { 'Content-Type': 'application/json' })
                resLike.end(JSON.stringify({ ok: false, error: 'cross-origin denied' }))
                return
              }
            }
            const body = JSON.parse(chunks.map(c => c.toString('utf8')).join('') || '{}') as { memoryId?: string; via?: string }
            const m = await import('./memory-store.ts')
            const ok = await m.closeOpenLoop(String(body.memoryId ?? ''), String(body.via ?? '主人确认')) !== null
            resLike.writeHead(ok ? 200 : 404, { 'Content-Type': 'application/json; charset=utf-8' })
            resLike.end(JSON.stringify({ ok }))
          } catch (e) {
            resLike.writeHead(400, { 'Content-Type': 'application/json' })
            resLike.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }))
          }
        })()
      })
    },
  })
}
