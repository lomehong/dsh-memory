/**
 * 记忆自动驾驶（v2.2）：让记忆在必要环节自动进场，不依赖模型自觉。
 *
 * 三个能力，全部只挂宿主接缝，零套件包依赖（宪章 §1）：
 *
 * 1. 读侧·按轮自动装配：`agent/inbox/claimed` 捕获每轮用户消息 → 切词检索
 *    → systemPrompt `memory-pack` 段注入相关记忆（段回调每个模型步前重新
 *    求值，天然按轮刷新；同轮多步经 messageId+mtime 缓存去重，回执每轮一份）。
 * 2. 写侧·对话复盘沉淀：`agent/status` 转 idle 去抖触发（对话告一段落），
 *    周期 timer 兜底扫尾；读回合窗口文本 → 经宿主 llm 服务做一次小预算提取
 *    → 去重后落库（主人=事实、访客=候选，与工具写入同一套治理默认值）。
 * 3. 审批留痕：`approval/request` 观察者（await next() 后记录、原样透传，
 *    不改变裁决），批准/拒绝自动落「授权」记忆（auth 四元组）。
 *
 * 身份沿「驱动器挂载时带身份」既定模式（registerMemoryTools 登记，
 * memory-tools.ts viewerByCtx）；身份未登记的会话一律 fail-closed 跳过——
 * 不注入、不捕获、不沉淀（LESSONS 8 模式）。所有宿主回调全部 try/catch
 * 防御（LESSONS 2：宿主接缝的同步抛错会击穿宿主）。
 *
 * 配置：$DSH_HOME/dsh-memory/autopilot.json（缺省全默认，30s TTL 缓存），
 * 结构见 AutopilotConfig；不注册 settings 命名空间，保持本插件零新依赖。
 *
 * @module dsh-memory/memory-autopilot
 */
import { appendFileSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { assembleMemoryPack, type AssembleViewer } from './memory-assemble.ts'
import { memoryViewerOf, noteMemoryViewer } from './memory-viewer.ts'
import {
  addMemoryEntry,
  effectiveStatementType,
  filterMemoriesForRead,
  loadSharedMemory,
  splitKeywords,
} from './memory-store.ts'

/** 文件级追踪（与 tools.ts 的 mount-trace.log 同文件；logger 缺席时唯一可见通道）。 */
export function trace(line: string): void {
  try {
    const base = process.env.DSH_HOME ?? ''
    if (base === '') return
    appendFileSync(`${base}/dsh-memory/mount-trace.log`, `${new Date().toISOString()} ${line}\n`, 'utf8')
  } catch { /* 追踪绝不击穿宿主 */ }
}

/* ─────────────────── 配置 ─────────────────── */

export interface AutopilotConfig {
  /** 读侧：按轮自动装配注入（默认开） */
  injectPerTurn: boolean
  /** 读侧：每轮最多注入条数（1..20，默认 5） */
  injectLimit: number
  /** 读侧：注入文本字节预算（默认 1600） */
  injectBudgetBytes: number
  /** 写侧：复盘器总开关（默认开） */
  reviewerEnabled: boolean
  /** 写侧：会话空闲去抖复盘（默认开） */
  reviewOnIdle: boolean
  /** 写侧：空闲去抖秒数（10..3600，默认 90） */
  idleDebounceSec: number
  /** 写侧：周期兜底复盘间隔小时数（0=关，默认 6） */
  reviewPeriodicHours: number
  /** 写侧：是否复盘访客会话（默认 false，保守侧） */
  reviewGuests: boolean
  /** 写侧：单次复盘最多落库条数（默认 5） */
  reviewMaxEntries: number
  /** 写侧：送提取的回合窗口文本上限字符（默认 4000） */
  reviewTranscriptChars: number
  /** 审批留痕（默认开） */
  approvalMemory: boolean
}

const CONFIG_DEFAULTS: AutopilotConfig = {
  injectPerTurn: true,
  injectLimit: 5,
  injectBudgetBytes: 1600,
  reviewerEnabled: true,
  reviewOnIdle: true,
  idleDebounceSec: 90,
  reviewPeriodicHours: 6,
  reviewGuests: false,
  reviewMaxEntries: 5,
  reviewTranscriptChars: 4000,
  approvalMemory: true,
}

const toBool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)
const toNum = (v: unknown, fallback: number, min: number, max: number): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, Math.round(v)))
}

/** 配置合并（纯函数，测试用）：类型不合法的键回落默认值并夹紧边界。 */
export function mergeAutopilotConfig(raw: unknown): AutopilotConfig {
  const merged: AutopilotConfig = { ...CONFIG_DEFAULTS }
  if (raw === null || typeof raw !== 'object') return merged
  const r = raw as Record<string, unknown>
  merged.injectPerTurn = toBool(r.injectPerTurn, merged.injectPerTurn)
  merged.injectLimit = toNum(r.injectLimit, merged.injectLimit, 1, 20)
  merged.injectBudgetBytes = toNum(r.injectBudgetBytes, merged.injectBudgetBytes, 200, 8192)
  merged.reviewerEnabled = toBool(r.reviewerEnabled, merged.reviewerEnabled)
  merged.reviewOnIdle = toBool(r.reviewOnIdle, merged.reviewOnIdle)
  merged.idleDebounceSec = toNum(r.idleDebounceSec, merged.idleDebounceSec, 10, 3600)
  merged.reviewPeriodicHours = toNum(r.reviewPeriodicHours, merged.reviewPeriodicHours, 0, 168)
  merged.reviewGuests = toBool(r.reviewGuests, merged.reviewGuests)
  merged.reviewMaxEntries = toNum(r.reviewMaxEntries, merged.reviewMaxEntries, 1, 20)
  merged.reviewTranscriptChars = toNum(r.reviewTranscriptChars, merged.reviewTranscriptChars, 200, 20000)
  merged.approvalMemory = toBool(r.approvalMemory, merged.approvalMemory)
  return merged
}

function autopilotConfigPath(): string {
  const base = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(base, 'dsh-memory', 'autopilot.json')
}

let configCache: { at: number; value: AutopilotConfig } | undefined

/** 读取自动驾驶配置（30s TTL 缓存；缺文件/解析失败 → 全默认）。 */
export function loadAutopilotConfig(now = Date.now()): AutopilotConfig {
  if (configCache !== undefined && now - configCache.at < 30_000) return configCache.value
  let merged = CONFIG_DEFAULTS
  try {
    merged = mergeAutopilotConfig(JSON.parse(readFileSync(autopilotConfigPath(), 'utf8')))
  } catch {
    merged = { ...CONFIG_DEFAULTS }
  }
  configCache = { at: now, value: merged }
  return merged
}

/** 保存自动驾驶配置：现有值合并补丁 → mergeAutopilotConfig 夹紧校验 → 原子写 → 失效缓存。返回保存后的完整配置。 */
export function saveAutopilotConfig(patch: unknown, now = Date.now()): AutopilotConfig {
  let currentRaw: unknown = {}
  try {
    currentRaw = JSON.parse(readFileSync(autopilotConfigPath(), 'utf8'))
  } catch { /* 缺文件/坏文件 → 从默认值起步 */ }
  const merged = (currentRaw !== null && typeof currentRaw === 'object' && patch !== null && typeof patch === 'object')
    ? { ...(currentRaw as Record<string, unknown>), ...(patch as Record<string, unknown>) }
    : patch
  const value = mergeAutopilotConfig(merged)
  // 原子写（tmp + rename，0600），与记忆库同一写纪律
  const path = autopilotConfigPath()
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  renameSync(tmp, path)
  configCache = { at: now, value }
  return value
}

/* ─────────────────── 回合窗口捕获 ─────────────────── */

export interface TurnWindow {
  sessionId: string
  agentCtx: unknown
  viewer: { userId: string; isMaster: boolean }
  /** 按认领顺序排列的回合（user=用户消息文本，assistant=该回合各步最终回复） */
  turns: Array<{ user: string; assistant: string[] }>
  /** 已复盘消费过的回合数（cursor，只向前推进） */
  reviewedTurnCount: number
  lastActivityAt: number
  reviewing: boolean
}

/** 读侧：每个 agent 上下文最近一次认领的用户消息（装配段取词用） */
interface LastClaim { id: unknown; text: string }

const windows = new Map<string, TurnWindow>()
const lastClaimByCtx = new WeakMap<object, LastClaim>()
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()
const sectionCache = new WeakMap<object, { key: string; text: string }>()

let warnedNoViewer = false
let reviewing = false
let lastPeriodicSweepAt = Date.now()
let logger: { info?: (...args: unknown[]) => void; warn?: (...args: unknown[]) => void } | undefined

const MAX_WINDOW_TURNS = 60
const WINDOW_STALE_MS = 48 * 60 * 60 * 1000

function dropStaleWindows(now = Date.now()): void {
  for (const [id, window] of windows) {
    if (now - window.lastActivityAt > WINDOW_STALE_MS) {
      const timer = pendingTimers.get(id)
      if (timer !== undefined) clearTimeout(timer)
      pendingTimers.delete(id)
      windows.delete(id)
    }
  }
}

/** 从 content 块数组提取文本（消息投影的 text 块；防御一切形状）。 */
function textOfBlocks(content: unknown): string {
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (block !== null && typeof block === 'object' && (block as { type?: unknown }).type === 'text') {
      const t = (block as { text?: unknown }).text
      if (typeof t === 'string') parts.push(t)
    }
  }
  return parts.join('\n').trim()
}

function sessionIdOfAgent(agent: unknown): string | undefined {
  if (agent === null || typeof agent !== 'object') return undefined
  const a = agent as { id?: unknown; session?: { header?: { id?: unknown } } }
  if (typeof a.id === 'string' && a.id !== '') return a.id
  const sid = a.session?.header?.id
  return typeof sid === 'string' && sid !== '' ? sid : undefined
}

/** 用户消息进入回合：仅记忆已挂载的会话建窗/追加（身份未登记 → 忽略）。
 *  同消息 id 幂等（app 层与 per-agent 双监听并存时防双捕）。 */
export function captureClaim(payload: unknown): void {
  const p = payload as { agent?: { ctx?: unknown; id?: unknown }; message?: { content?: unknown; id?: unknown } } | undefined
  const agent = p?.agent
  const agentCtx = (agent as { ctx?: unknown } | undefined)?.ctx
  const viewer = memoryViewerOf(agentCtx)
  if (viewer === undefined) { trace('capture: viewer 未登记 → 忽略'); return }
  const sessionId = sessionIdOfAgent(agent)
  if (sessionId === undefined) { trace('capture: sessionId 缺失 → 忽略'); return }
  const text = textOfBlocks(p?.message?.content)
  const msgId = p?.message?.id
  const prev = agentCtx !== null && typeof agentCtx === 'object' ? lastClaimByCtx.get(agentCtx as object) : undefined
  if (prev !== undefined && msgId !== undefined && prev.id === msgId) return
  trace(`capture: 命中 "${text.slice(0, 24)}…"`)

  let window = windows.get(sessionId)
  if (window === undefined) {
    window = { sessionId, agentCtx, viewer, turns: [], reviewedTurnCount: 0, lastActivityAt: Date.now(), reviewing: false }
    windows.set(sessionId, window)
  }
  window.agentCtx = agentCtx
  window.viewer = viewer
  window.turns.push({ user: text, assistant: [] })
  if (window.turns.length > MAX_WINDOW_TURNS) {
    const dropped = window.turns.length - MAX_WINDOW_TURNS
    window.turns.splice(0, dropped)
    window.reviewedTurnCount = Math.max(0, window.reviewedTurnCount - dropped)
  }
  window.lastActivityAt = Date.now()

  if (agentCtx !== null && typeof agentCtx === 'object') {
    lastClaimByCtx.set(agentCtx as object, { id: p?.message?.id, text })
  }
}

/** 助手最终消息（assistant/message，每步一条）追加进当前回合。 */
function captureSessionEvent(session: unknown, event: unknown): void {
  const sid = (session as { header?: { id?: unknown } } | undefined)?.header?.id
  if (typeof sid !== 'string') return
  const window = windows.get(sid)
  if (window === undefined) return
  const type = (event as { type?: unknown } | undefined)?.type
  if (type !== 'assistant/message') return
  const content = (event as { data?: { message?: { content?: unknown } } } | undefined)?.data?.message?.content
  const text = textOfBlocks(content)
  if (text === '') return
  const turn = window.turns[window.turns.length - 1]
  if (turn === undefined) window.turns.push({ user: '', assistant: [text] })
  else turn.assistant.push(text)
  window.lastActivityAt = Date.now()
}

/* ─────────────────── 读侧：systemPrompt 装配段 ─────────────────── */

export const SECTION_NAME = 'memory-pack'
/** dsh-twin 人格/守卫/活动段占用 25/26/27，记忆装配段紧随其后 */
export const SECTION_ORDER = 28

function memoryStoreMtime(): number {
  const base = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  try {
    return statSync(join(base, 'dsh-memory', 'shared-memory.json')).mtimeMs
  } catch {
    return 0
  }
}

/**
 * 渲染装配段文本（纯函数，测试用）：条目截断 160 字、逐条装入预算，
 * 一条都装不下时返回空串（零 token）。
 */
export function renderPackText(
  items: ReadonlyArray<{ statementType: string; content: string }>,
  opts: { isMaster: boolean; budgetBytes: number },
): string {
  const lines: string[] = []
  let used = 0
  for (const item of items) {
    const content = item.content.length > 160 ? `${item.content.slice(0, 157)}…` : item.content
    const line = `• [${item.statementType}] ${content}`
    const bytes = Buffer.byteLength(line, 'utf8') + 1
    if (used + bytes > Math.max(200, opts.budgetBytes)) break
    lines.push(line)
    used += bytes
  }
  if (lines.length === 0) return ''
  const perspective = opts.isMaster ? '主人' : '受限'
  const header = `【共享记忆自动装配】系统按本轮消息检索到以下历史记忆（${perspective}视角，仅供参考；更多可用 memory_read 查询）：`
  return `${header}\n${lines.join('\n')}`
}

/** 装配段正文：切词 → 检索 → 渲染；无命中/无关键词返回空串。 */
function buildPackText(viewer: AssembleViewer, messageText: string, config: AutopilotConfig): string {
  const keywords = splitKeywords(messageText, 8)
  if (keywords.length === 0) return ''
  // 检索、可见性过滤与回执审计都走 assembleMemoryPack 同一条路（回执每轮一份）
  const result = assembleMemoryPack(viewer, { keywords, limit: Math.min(20, Math.max(1, config.injectLimit)) })
  if (result.pack.length === 0) return ''
  return renderPackText(
    result.pack.map(e => ({ statementType: effectiveStatementType(e), content: e.content })),
    { isMaster: viewer.isMaster, budgetBytes: config.injectBudgetBytes },
  )
}

/**
 * systemPrompt `memory-pack` 段回调（同步，每个模型步前求值）。
 * 身份未登记 → 空串（fail-closed）；同轮多步经 messageId+mtime 缓存，
 * 只在「新消息或记忆库变化」时重新装配（回执因此每轮最多一份）。
 */
export function renderMemorySection(context: unknown): string {
  try {
    const config = loadAutopilotConfig()
    if (config.injectPerTurn !== true) { trace('render: 门1 injectPerTurn=false → 空串'); return '' }
    const agent = (context as { agent?: { ctx?: unknown } } | undefined)?.agent
    const agentCtx = agent?.ctx
    if (agentCtx === null || typeof agentCtx !== 'object') { trace('render: 门2 agentCtx 缺失 → 空串'); return '' }
    const viewer = memoryViewerOf(agentCtx)
    if (viewer === undefined) { trace('render: 门3 viewer 未登记（工具未挂载本会话？）→ 空串'); return '' }
    const claim = lastClaimByCtx.get(agentCtx as object)
    if (claim === undefined || claim.text.trim() === '') { trace(`render: 门4 claim 缺失（agent/inbox/claimed 事件未达?）→ 空串`); return '' }
    const key = `${String(claim.id)}:${memoryStoreMtime()}`
    const cached = sectionCache.get(agentCtx as object)
    if (cached !== undefined && cached.key === key) { trace('render: 缓存命中（同轮同库）'); return cached.text }
    const text = buildPackText(viewer, claim.text, config)
    trace(`render: 装配完成 claim="${claim.text.slice(0, 24)}…" 产出 ${text.length} 字`)
    sectionCache.set(agentCtx as object, { key, text })
    return text
  } catch (error) {
    trace(`render: 异常 ${error instanceof Error ? error.message : String(error)}`)
    return ''
  }
}

/* ─────────────────── 写侧：对话复盘沉淀 ─────────────────── */

const EXTRACT_SYSTEM = [
  '你是数字分身的记忆整理器。从对话片段中提取值得跨会话长期保留的记忆：',
  '日程与约定、明确的决定、主人表达的偏好、承诺或待办、重要的事实。',
  '忽略寒暄、过程性工具输出与一次性细节。只输出一个 JSON 数组',
  '（不要 markdown 代码块、不要解释），每项形如',
  '{"content":"一句话记忆","type":"schedule|todo|decision|preference|note"}；',
  '没有可提取内容时输出 []。',
].join('')

interface ExtractedItem {
  content: string
  type: string
}

/**
 * 解析提取输出（纯函数，测试用）：剥代码围栏、截取首尾中括号、JSON.parse、
 * 逐项校验。任何失败返回空数组——复盘宁缺毋滥。
 */
export function parseExtraction(raw: string): ExtractedItem[] {
  if (typeof raw !== 'string' || raw.trim() === '') return []
  let text = raw.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence !== null && fence[1] !== undefined) text = fence[1].trim()
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const items: ExtractedItem[] = []
  for (const item of parsed) {
    if (item === null || typeof item !== 'object') continue
    const content = (item as { content?: unknown }).content
    if (typeof content !== 'string') continue
    const trimmed = content.replace(/\s+/g, ' ').trim()
    if (trimmed === '' || trimmed.length > 500) continue
    const type = (item as { type?: unknown }).type
    items.push({ content: trimmed, type: typeof type === 'string' && type.trim() !== '' ? type.trim().slice(0, 40) : 'note' })
  }
  return items
}

/** 判重归一化：去空白、小写（纯函数，测试用）。 */
export function normalizeForDedup(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase()
}

/**
 * 内容判重（纯函数，测试用）：与既有条目完全相同，或互相包含且长度差在
 * 容忍带内 → 重复。长度差约束避免「泛化旧条目」无限吞掉有新细节的抽取。
 */
export function isDuplicateContent(content: string, entries: ReadonlyArray<{ content: string }>): boolean {
  const a = normalizeForDedup(content)
  if (a.length < 8) return false
  for (const entry of entries) {
    const b = normalizeForDedup(entry?.content ?? '')
    if (b === '') continue
    if (a === b) return true
    const [long, short] = a.length >= b.length ? [a, b] : [b, a]
    if (long.includes(short) && long.length - short.length <= Math.max(12, Math.floor(short.length * 0.5))) {
      return true
    }
  }
  return false
}

/** 回合窗口 → 提取输入文本；无可复盘内容返回 null（纯函数，测试用）。 */
export function renderTranscript(
  turns: ReadonlyArray<{ user: string; assistant: string[] }>,
  capChars: number,
): string | null {
  const parts: string[] = []
  let hasAssistant = false
  for (const turn of turns) {
    const assistant = turn.assistant.join('\n').trim()
    if (assistant !== '') hasAssistant = true
    const user = turn.user.trim()
    parts.push(`用户：${user === '' ? '（系统/后台触发）' : user}\n分身：${assistant === '' ? '（无文本回复）' : assistant}`)
  }
  if (!hasAssistant) return null
  let transcript = parts.join('\n\n')
  const cap = Math.max(200, capChars)
  if (transcript.length > cap) transcript = `…（前文略）\n\n${transcript.slice(transcript.length - cap)}`
  return transcript
}

/** 宿主 llm / 默认模型选择的最小结构视图（缺席 → 复盘显式降级跳过）。 */
interface AutopilotHostCtx {
  get(name: string): unknown
}

interface StreamChunkText { type?: unknown; text?: unknown }

/** 调宿主 llm 服务做一次小预算提取；服务/默认模型缺席返回 undefined。 */
async function extractMemories(ctx: AutopilotHostCtx, transcript: string): Promise<ExtractedItem[] | undefined> {
  const llm = ctx.get('llm') as { stream?: (options: Record<string, unknown>) => AsyncIterable<unknown> } | undefined
  if (llm?.stream === undefined) return undefined
  const selection = ctx.get('agentDefaultModel') as { currentSelection?: () => unknown } | undefined
  const sel = (selection?.currentSelection?.() ?? {}) as { provider?: unknown; model?: unknown }
  const provider = typeof sel.provider === 'string' ? sel.provider : ''
  const model = typeof sel.model === 'string' ? sel.model : ''
  if (provider === '' || model === '') return undefined
  const stream = llm.stream({
    provider,
    model,
    system: EXTRACT_SYSTEM,
    messages: [{ role: 'user', content: [{ type: 'text', text: transcript }] }],
  })
  let out = ''
  for await (const chunk of stream) {
    if (chunk !== null && typeof chunk === 'object') {
      const c = chunk as StreamChunkText
      if (c.type === 'text-delta' && typeof c.text === 'string') out += c.text
    }
  }
  return parseExtraction(out)
}

/** 抽取项落库：判重 → addMemoryEntry（治理默认值与工具写入一致）。 */
async function writeExtracted(
  window: TurnWindow,
  items: ReadonlyArray<ExtractedItem>,
  config: AutopilotConfig,
): Promise<number> {
  const existing = filterMemoriesForRead(loadSharedMemory())
  let written = 0
  for (const item of items.slice(0, Math.max(1, config.reviewMaxEntries))) {
    if (isDuplicateContent(item.content, existing)) continue
    const isMaster = window.viewer.isMaster
    const entry = await addMemoryEntry({
      content: item.content,
      type: item.type,
      scope: isMaster ? 'master' : 'self',
      author: window.viewer.userId,
      authorRole: isMaster ? 'master' : 'guest',
      statementType: isMaster ? '事实' : '候选',
      source: { origin: 'conversation', ref: `autopilot:${window.sessionId}` },
    })
    if (entry !== null) {
      written += 1
      existing.push(entry)
    }
  }
  return written
}

export interface ReviewOutcome {
  written: number
  reason: 'ok' | 'reviewer-disabled' | 'guest-skipped' | 'no-content' | 'extract-failed' | 'busy'
}

/**
 * 复盘一个会话窗口：提取 → 落库 → 推进 cursor。
 * 提取失败不推进 cursor（下个触发点重试）；重复进入置 busy 跳过。
 */
export async function reviewWindow(ctx: AutopilotHostCtx, window: TurnWindow): Promise<ReviewOutcome> {
  const config = loadAutopilotConfig()
  if (config.reviewerEnabled !== true) return { written: 0, reason: 'reviewer-disabled' }
  if (config.reviewGuests !== true && window.viewer.isMaster !== true) return { written: 0, reason: 'guest-skipped' }
  if (window.reviewing) return { written: 0, reason: 'busy' }
  window.reviewing = true
  try {
    const pending = window.turns.slice(window.reviewedTurnCount)
    const transcript = renderTranscript(pending, config.reviewTranscriptChars)
    if (transcript === null) {
      window.reviewedTurnCount = window.turns.length
      return { written: 0, reason: 'no-content' }
    }
    const items = await extractMemories(ctx, transcript)
    if (items === undefined) return { written: 0, reason: 'extract-failed' }
    const written = await writeExtracted(window, items, config)
    window.reviewedTurnCount = window.turns.length
    return { written, reason: 'ok' }
  } finally {
    window.reviewing = false
  }
}

/** 立即复盘所有有未消费回合的窗口（服务面 reviewNow / 周期兜底共用）。 */
export async function reviewAllWindows(ctx: AutopilotHostCtx): Promise<number> {
  if (reviewing) return 0
  reviewing = true
  let total = 0
  try {
    for (const window of [...windows.values()]) {
      try {
        if (window.turns.length <= window.reviewedTurnCount) continue
        const outcome = await reviewWindow(ctx, window)
        total += outcome.written
      } catch {
        /* 单窗口失败不影响其余窗口 */
      }
    }
  } finally {
    reviewing = false
    lastPeriodicSweepAt = Date.now()
  }
  return total
}

function cancelPendingReview(sessionId: string): void {
  const timer = pendingTimers.get(sessionId)
  if (timer !== undefined) {
    clearTimeout(timer)
    pendingTimers.delete(sessionId)
  }
}

/** agent/status → idle：去抖调度该会话的复盘；转 running 取消待触发。 */
function scheduleIdleReview(ctx: AutopilotHostCtx, payload: unknown): void {
  const config = loadAutopilotConfig()
  if (config.reviewerEnabled !== true || config.reviewOnIdle !== true) return
  const p = payload as { agent?: unknown; status?: unknown } | undefined
  const sessionId = sessionIdOfAgent(p?.agent)
  if (sessionId === undefined) return
  cancelPendingReview(sessionId)
  if (p?.status !== 'idle') return
  const window = windows.get(sessionId)
  if (window === undefined || window.turns.length <= window.reviewedTurnCount) return
  const delayMs = config.idleDebounceSec * 1000
  const timer = setTimeout(() => {
    pendingTimers.delete(sessionId)
    void reviewWindow(ctx, window)
      .then(outcome => {
        if (outcome.written > 0) {
          logger?.info?.(`[dsh-memory] 复盘沉淀 ${outcome.written} 条记忆 (session=${sessionId.slice(0, 8)}…)`)
        }
      })
      .catch(() => { /* 复盘失败留给周期兜底 */ })
  }, delayMs)
  timer.unref?.()
  pendingTimers.set(sessionId, timer)
}

/* ─────────────────── 审批留痕 ─────────────────── */

export type ApprovalOutcomeLike = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable' | unknown

export interface ApprovalMemoryItem {
  authStatus: '已授权' | '已拒绝'
  content: string
}

/**
 * 审批结果 → 授权记忆条目（纯函数，测试用）。
 * 只消费 allowed-once / rejected；cancelled/unavailable 不留痕。
 */
export function approvalMemoryItem(req: unknown, outcome: ApprovalOutcomeLike): ApprovalMemoryItem | undefined {
  if (outcome !== 'allowed-once' && outcome !== 'rejected') return undefined
  const toolName = typeof (req as { toolName?: unknown } | undefined)?.toolName === 'string'
    ? (req as { toolName: string }).toolName
    : 'unknown'
  const rawReason = (req as { reason?: unknown } | undefined)?.reason
  const reason = typeof rawReason === 'string' ? rawReason.replace(/\s+/g, ' ').trim().slice(0, 120) : ''
  const verb = outcome === 'allowed-once' ? '批准' : '拒绝'
  return {
    authStatus: outcome === 'allowed-once' ? '已授权' : '已拒绝',
    content: `${verb}工具调用 ${toolName}${reason !== '' ? `（原因：${reason}）` : ''}`,
  }
}

/** 审批观察者：留痕失败/身份缺失绝不影响审批链路（警告一次，显式降级）。 */
async function recordApprovalOutcome(req: unknown, outcome: unknown): Promise<void> {
  const config = loadAutopilotConfig()
  if (config.approvalMemory !== true) return
  const item = approvalMemoryItem(req, outcome)
  if (item === undefined) return
  const agentCtx = (req as { agent?: { ctx?: unknown } } | undefined)?.agent?.ctx
  const viewer = memoryViewerOf(agentCtx)
  if (viewer === undefined) {
    if (!warnedNoViewer) {
      warnedNoViewer = true
      logger?.warn?.('[dsh-memory] 审批会话未登记记忆视角，跳过授权留痕（显式降级，仅警告一次）')
    }
    return
  }
  const existing = filterMemoriesForRead(loadSharedMemory())
  if (isDuplicateContent(item.content, existing.slice(-20))) return
  await addMemoryEntry({
    content: item.content,
    type: 'approval',
    scope: 'master',
    author: viewer.userId,
    authorRole: viewer.isMaster ? 'master' : 'guest',
    statementType: '授权',
    auth: {
      status: item.authStatus,
      by: viewer.userId,
      via: 'approval/request',
      range: item.content.slice(0, 200),
    },
    source: { origin: 'conversation' },
  })
}

/* ─────────────────── 入口 ─────────────────── */

/**
 * 注册记忆自动驾驶（index.ts apply 内 try/catch 调用）。
 * 所有宿主回调独立防御；systemPrompt 段经 ctx.inject 惰性注册（服务晚到也
 * 能挂上，缺席则只失去自动注入，核心工具路径不受影响）。
 */
export function registerMemoryAutopilot(ctx: Context): void {
  logger = (ctx as unknown as { logger?: { info?: (...args: unknown[]) => void; warn?: (...args: unknown[]) => void } }).logger
  const events = ctx as unknown as {
    on?: (event: string, handler: (...args: never[]) => unknown) => void
    inject?: (deps: string[], cb: (sctx: unknown) => void) => void
  }

  // 1) 捕获：用户消息进入回合（未登记身份的会话在 captureClaim 内忽略）。
  //    运行时级身份自愈（2026-09-15，与 twin resolveGuestView 同款判别）：
  //    未装 im-channel → 运行时无访客入口，网页会话一律主人（补登）；
  //    已装 im-channel → 身份由其 mountSharedMemory 在 agent setup 标注，
  //    未标注的会话 fail-closed 不自愈（宁可不注入，不可泄露给无法证明身份者）。
  events.on?.('agent/inbox/claimed', (payload: unknown): void => {
    try {
      const agentCtx = (payload as { agent?: { ctx?: unknown } } | undefined)?.agent?.ctx
      if (agentCtx !== null && typeof agentCtx === 'object' && memoryViewerOf(agentCtx) === undefined) {
        let imInstalled = false
        try { imInstalled = Boolean((ctx as unknown as { get?: (n: string) => unknown }).get?.('im-channel')) } catch { imInstalled = false }
        if (!imInstalled) {
          noteMemoryViewer(agentCtx, 'master', true)
          trace('身份自愈（运行时级）：无 im-channel，网页会话按主人补登')
        }
      }
    } catch {
      /* 自愈失败不影响捕获 */
    }
    try {
      captureClaim(payload)
    } catch {
      /* 捕获失败不影响回合 */
    }
  })

  // 2) 捕获：助手最终消息（仅已建窗会话）
  events.on?.('session/event', (session: unknown, event: unknown): void => {
    try {
      captureSessionEvent(session, event)
    } catch {
      /* 捕获失败不影响会话 */
    }
  })

  // 3) 会话销毁：清窗 + 取消待触发定时器
  events.on?.('session/disposed', (session: unknown): void => {
    try {
      const sid = (session as { header?: { id?: unknown } } | undefined)?.header?.id
      if (typeof sid === 'string') {
        cancelPendingReview(sid)
        windows.delete(sid)
      }
    } catch {
      /* 清理失败可容忍（stale 扫描兜底） */
    }
  })

  // 4) 空闲复盘：running→idle 去抖触发
  events.on?.('agent/status', (payload: unknown): void => {
    try {
      scheduleIdleReview(ctx as unknown as AutopilotHostCtx, payload)
    } catch {
      /* 调度失败不影响 agent 状态机 */
    }
  })

  // 5) 审批留痕：观察者——await next() 后记录、原样透传，不改变任何裁决
  events.on?.('approval/request', async (req: unknown, next: () => Promise<unknown>): Promise<unknown> => {
    const outcome = await next()
    try {
      void recordApprovalOutcome(req, outcome).catch(() => { /* 留痕失败不影响审批 */ })
    } catch {
      /* 同上 */
    }
    return outcome
  })

  // 6) 读侧：memory-pack 段注册已迁移至 index.ts apply（bundle 层 registerPackSection，
  //    运行时级一次注册覆盖全部会话）——此前 app 层 ctx.inject(['systemPrompt']) 在
  //    per-agent 服务拓扑下永不触发（2026-09-15 根治，装配回执 0 条实证）。
  //    本函数保留写侧与捕获观察者（事件沿 cordis 总线冒泡，app 层可收）。

  // 7) 周期兜底复盘 + 过期窗口清扫（tick 10min，到点才真正扫）
  const periodic = setInterval(() => {
    try {
      dropStaleWindows()
      const hours = loadAutopilotConfig().reviewPeriodicHours
      if (hours <= 0) return
      if (Date.now() - lastPeriodicSweepAt < hours * 60 * 60 * 1000) return
      void reviewAllWindows(ctx as unknown as AutopilotHostCtx)
        .then(written => {
          if (written > 0) logger?.info?.(`[dsh-memory] 周期复盘沉淀 ${written} 条记忆`)
        })
        .catch(() => { /* 兜底失败等下个周期 */ })
    } catch {
      /* tick 任何异常不得击穿宿主 */
    }
  }, 10 * 60 * 1000)
  periodic.unref?.()
  const lifecycle = ctx as unknown as { on?: (event: 'dispose', fn: () => void) => void }
  lifecycle.on?.('dispose', () => {
    clearInterval(periodic)
    for (const timer of pendingTimers.values()) clearTimeout(timer)
    pendingTimers.clear()
    windows.clear()
  })
}

/* ─────────────────── 读侧：运行时级段注册（bundle 层，自洽） ─────────────────── */

let packSectionRegistered = false

/**
 * 把 memory-pack 段注册到宿主 systemPrompt 服务（index.ts apply 在 bundle 层调用一次）。
 * 一次注册覆盖运行时全部会话——段回调按 agent 判别身份（context.agent.ctx），
 * 未登记 fail-closed 空串；身份由 claimed 自愈（无 im-channel=主人）与
 * im-channel mountSharedMemory（per-actor）供给。
 *
 * 幂等：重复调用直接返回（宿主对同名段重复注册会抛错）。
 * 运行时解析（alpha.2 起）下 apply 可能晚于段消费方就绪——调用方负责重试
 * （index.ts 的 250ms×40 兜底）。
 */
export function registerPackSection(systemPrompt: { section?: (s: unknown) => void }): void {
  if (packSectionRegistered) return
  if (!systemPrompt || typeof systemPrompt.section !== 'function') {
    trace('registerPackSection: systemPrompt.section 缺席——未注册')
    return
  }
  systemPrompt.section({ name: SECTION_NAME, order: SECTION_ORDER, text: renderMemorySection })
  packSectionRegistered = true
  trace('memory-pack 段注册成功（bundle 层一次，覆盖运行时全部会话）')
  logger?.info?.('[dsh-memory] 按轮记忆装配段已注册（bundle 层，运行时全部会话覆盖）')
}
