/**
 * 共享记忆核心存储（v2：认识论 schema + 替代链 + 归档区）
 *
 * 治理语义移植自 Decision Assistant 决策助手脚手架（见 docs/决策记忆治理-设计.md）：
 * - 六类陈述类型（事实/推断/偏好/候选/授权/已验证结果），读取侧缺省按「候选」解释
 * - 陈述类变更走「替代」而非覆盖，替代链双向链接，不删历史
 * - 活跃集超限时低优先级条目移入归档区而非删除，消除静默丢数据
 *
 * 所有读-改-写操作（新增/更新/删除/清除/归档/清理过期）都在文件锁内完成整个事务，
 * 避免并发写入覆盖或丢失更新；写入先写临时文件再原子重命名，防止中断损坏。
 * 存储位置：~/.dsh/im-channel/credentials/shared-memory.json（活跃）
 *           ~/.dsh/im-channel/credentials/shared-memory-archive.json（归档）
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, openSync, closeSync, unlinkSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
export const STATEMENT_TYPES = ['事实', '推断', '偏好', '候选', '授权', '已验证结果'];
/** 读取侧兼容：缺省陈述类型按「候选」解释 */
export function effectiveStatementType(e) {
    return e.statementType ?? '候选';
}
/** 读取侧兼容：缺省生命周期按「当前」解释 */
export function effectiveLifecycle(e) {
    return e.lifecycle?.state ?? '当前';
}
/** 最多保留的活跃记忆条数 */
export const MAX_ENTRIES = 500;
/** 归档区上限，超出按最旧 FIFO 裁剪 */
export const MAX_ARCHIVE_ENTRIES = 5000;
/** 获取锁的总超时 */
const LOCK_TIMEOUT_MS = 5000;
/** 自旋重试间隔（异步等待，不阻塞事件循环） */
const LOCK_RETRY_MS = 50;
/** 锁陈旧阈值：锁文件存在超过该时长视为持有者已崩溃，可接管 */
const LOCK_STALE_MS = 15000;
function memoryPath() {
    return join(homedir(), '.dsh', 'im-channel', 'credentials', 'shared-memory.json');
}
function archivePath() {
    return join(homedir(), '.dsh', 'im-channel', 'credentials', 'shared-memory-archive.json');
}
function lockPath() {
    return memoryPath() + '.lock';
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * 异步自旋文件锁：'wx' 原子创建锁文件。
 * - 等待期间 await 让出事件循环，不做同步忙等
 * - 锁文件超过 LOCK_STALE_MS 视为持有者崩溃残留，直接接管，避免永久死锁
 */
async function acquireLock(timeoutMs = LOCK_TIMEOUT_MS) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const fd = openSync(lockPath(), 'wx');
            closeSync(fd);
            return true;
        }
        catch (err) {
            const code = err.code;
            if (code !== 'EEXIST') {
                // 非锁竞争（如首次运行时父目录不存在）：修复环境后重试，
                // 不能当作“锁被占用”否则永远无法获锁
                try {
                    mkdirSync(dirname(lockPath()), { recursive: true });
                }
                catch {
                    // 忽略，下轮重试
                }
                await sleep(LOCK_RETRY_MS);
                continue;
            }
            // 文件已存在：尝试接管陈旧锁
            try {
                const st = statSync(lockPath());
                if (Date.now() - st.mtimeMs > LOCK_STALE_MS) {
                    unlinkSync(lockPath());
                    continue;
                }
            }
            catch {
                // 锁文件刚被其他进程释放，直接进入下一轮尝试
            }
            await sleep(LOCK_RETRY_MS);
        }
    }
    return false;
}
function releaseLock() {
    try {
        unlinkSync(lockPath());
    }
    catch {
        // 锁已不存在或释放失败，忽略
    }
}
async function withLock(fn) {
    if (!(await acquireLock()))
        return { locked: false };
    try {
        return { locked: true, value: fn() };
    }
    finally {
        releaseLock();
    }
}
/** 加载活跃记忆 */
export function loadSharedMemory() {
    const path = memoryPath();
    if (!existsSync(path))
        return [];
    try {
        const store = JSON.parse(readFileSync(path, 'utf8'));
        return Array.isArray(store.entries) ? store.entries : [];
    }
    catch {
        // 文件损坏：先重命名备份，历史保留在 .corrupt-* 文件中可人工恢复，
        // 避免下一次写入在空数组上覆盖全部历史。
        try {
            renameSync(path, `${path}.corrupt-${Date.now()}`);
        }
        catch {
            // 备份失败时只能返回空
        }
        return [];
    }
}
/** 加载归档记忆（不删除的「第二历史」） */
export function loadArchivedMemories() {
    const path = archivePath();
    if (!existsSync(path))
        return [];
    try {
        const store = JSON.parse(readFileSync(path, 'utf8'));
        return Array.isArray(store.entries) ? store.entries : [];
    }
    catch {
        try {
            renameSync(path, `${path}.corrupt-${Date.now()}`);
        }
        catch {
            // 备份失败时只能返回空
        }
        return [];
    }
}
/** 写入条目（调用方必须已持锁） */
function writeEntriesUnlocked(entries) {
    const path = memoryPath();
    mkdirSync(dirname(path), { recursive: true });
    // 先写临时文件，再原子重命名，避免写入中断导致文件损坏；
    // 临时文件名带 pid，避免并发进程互相覆盖临时文件
    const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(tmpPath, `${JSON.stringify({ entries }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    renameSync(tmpPath, path);
}
/** 写入归档区（调用方必须已持锁；超出上限按最旧 FIFO 裁剪） */
function writeArchiveUnlocked(entries) {
    const path = archivePath();
    mkdirSync(dirname(path), { recursive: true });
    const trimmed = entries.slice(-MAX_ARCHIVE_ENTRIES);
    const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(tmpPath, `${JSON.stringify({ entries: trimmed }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    renameSync(tmpPath, path);
}
/** 生成唯一 ID */
function generateId() {
    return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
/**
 * 写入侧认识论归一（移植自 Decision Assistant 约束）：
 * - 「已验证结果」必须附验证，否则回落为「候选」——检查通过不等于已验证；
 * - 「授权」缺授权信息时补「未授权」，授权状态由主人后续显式更新。
 */
function normalizeEntryEpistemics(entry) {
    if (entry.statementType === '已验证结果' && entry.verify?.status !== '已验证') {
        entry.statementType = '候选';
    }
    if (entry.statementType === '授权' && entry.auth === undefined) {
        entry.auth = { status: '未授权' };
    }
    return entry;
}
/**
 * 淘汰优先级（数值越小越先被移入归档）：
 * 0=已替代（修订史）→ 1=候选/推断/偏好（含旧条目缺省）→ 2=其余 → 3=授权（最后淘汰）
 */
function evictionOrder(e) {
    if (e.lifecycle?.state === '已替代')
        return 0;
    const st = effectiveStatementType(e);
    if (st === '授权')
        return 3;
    if (st === '候选' || st === '推断' || st === '偏好')
        return 1;
    return 2;
}
/**
 * 活跃集超限时把低优先级条目移入归档而非删除（v2：消除静默丢数据）。
 * 返回保留的活跃条目；归档区自身超限按最旧 FIFO 裁剪。调用方必须已持锁。
 */
function enforceActiveCapUnlocked(entries) {
    if (entries.length <= MAX_ENTRIES)
        return entries;
    const overflow = entries.length - MAX_ENTRIES;
    const ordered = entries
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => evictionOrder(a.entry) - evictionOrder(b.entry) || a.index - b.index);
    const evictIds = new Set(ordered.slice(0, overflow).map(x => x.entry.id));
    const kept = entries.filter(e => !evictIds.has(e.id));
    const evicted = entries.filter(e => evictIds.has(e.id));
    writeArchiveUnlocked([...loadArchivedMemories(), ...evicted]);
    return kept;
}
/** 添加一条记忆（整个读-改-写在锁内完成） */
export async function addMemoryEntry(entry) {
    const participants = entry.participants;
    // 陈述类型写入默认：主人=事实（作者即归因），访客=候选（来源登记 ≠ 事实晋升）
    const statementType = entry.statementType ?? (entry.authorRole === 'master' ? '事实' : '候选');
    const newEntry = normalizeEntryEpistemics({
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
        ...(entry.source !== undefined ? { source: entry.source } : {}),
        ...(entry.auth !== undefined ? { auth: entry.auth } : {}),
        ...(entry.verify !== undefined ? { verify: entry.verify } : {}),
        ...(entry.reviewBy !== undefined ? { reviewBy: entry.reviewBy } : {}),
        statementType,
    });
    const result = await withLock(() => {
        const entries = loadSharedMemory();
        entries.push(newEntry);
        // 最多保留 MAX_ENTRIES 条：超限者移入归档而非删除
        writeEntriesUnlocked(enforceActiveCapUnlocked(entries));
    });
    return result.locked ? newEntry : null;
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
export function filterMemoriesByUser(entries, userId, isMaster) {
    if (isMaster)
        return entries; // 主人能读一切
    return entries.filter(e => {
        if (e.scope === 'public')
            return true;
        if (e.participants?.includes(userId))
            return true;
        if (e.scope === 'self' && e.author === userId)
            return true;
        return false;
    });
}
/**
 * 读取过滤：默认仅返回「当前」条目（旧条目无 lifecycle 字段视为当前）；
 * 归档区条目由调用方单独加载后并入。
 */
export function filterMemoriesForRead(entries, options = {}) {
    const { statementType, includeSuperseded = false } = options;
    return entries.filter(e => {
        const state = effectiveLifecycle(e);
        if (state === '已归档')
            return false;
        if (state === '已替代' && !includeSuperseded)
            return false;
        if (statementType !== undefined && effectiveStatementType(e) !== statementType)
            return false;
        return true;
    });
}
/** 获取记忆摘要文本（用于注入系统提示词） */
export function getMemorySummary(entries) {
    if (entries.length === 0)
        return '';
    return `【共享记忆】你共有 ${entries.length} 条共享记忆。如果需要查看，请使用 memory_read 工具。`;
}
/** 按关键词搜索 */
export function searchMemories(entries, keyword) {
    const kw = keyword.toLowerCase();
    return entries.filter(e => e.content.toLowerCase().includes(kw) ||
        e.type.toLowerCase().includes(kw));
}
/** 清除所有活跃记忆（归档区保留，历史不物理删除） */
export async function clearSharedMemory() {
    const result = await withLock(() => writeEntriesUnlocked([]));
    return result.locked;
}
/**
 * 替代式修订：陈述类变更不覆盖历史，而是创建新条目并与旧条目双向链接。
 * 新条目继承 type/scope/participants/refId/source；expireAt 由修订人重新决定。
 */
export async function supersedeMemoryEntry(id, changes, actor = {}) {
    const result = await withLock(() => {
        const entries = loadSharedMemory();
        const index = entries.findIndex(e => e.id === id);
        if (index === -1)
            return null;
        const previous = entries[index];
        const statementType = changes.statementType ?? effectiveStatementType(previous);
        const current = normalizeEntryEpistemics({
            id: generateId(),
            timestamp: new Date().toISOString(),
            type: changes.type ?? previous.type,
            content: changes.content ?? previous.content,
            author: actor.author ?? previous.author,
            authorRole: actor.authorRole ?? previous.authorRole,
            scope: previous.scope,
            ...(previous.participants !== undefined ? { participants: previous.participants } : {}),
            ...(previous.refId !== undefined ? { refId: previous.refId } : {}),
            ...(previous.source !== undefined ? { source: previous.source } : {}),
            ...(statementType === '授权' && previous.auth !== undefined ? { auth: previous.auth } : {}),
            ...(previous.reviewBy !== undefined ? { reviewBy: previous.reviewBy } : {}),
            statementType,
            lifecycle: { state: '当前', supersedes: id, reason: '修订' },
        });
        const superseded = {
            ...previous,
            lifecycle: { state: '已替代', supersededBy: current.id, reason: '修订' },
        };
        const next = [...entries];
        next[index] = superseded;
        next.push(current);
        writeEntriesUnlocked(enforceActiveCapUnlocked(next));
        return { previous: superseded, current };
    });
    return result.locked ? result.value : null;
}
/**
 * 更新一条记忆（按 id 查找）：
 * - 陈述类变更（content / statementType / type）→ 替代语义，产生新条目并保留历史；
 * - 纯权限类变更（scope / participants / expireAt）→ 原地修改，不产生认识论历史。
 */
export async function updateMemoryEntry(id, updates, actor = {}) {
    if (updates.content !== undefined || updates.statementType !== undefined || updates.type !== undefined) {
        const changes = {};
        if (updates.content !== undefined)
            changes.content = updates.content;
        if (updates.statementType !== undefined)
            changes.statementType = updates.statementType;
        if (updates.type !== undefined)
            changes.type = updates.type;
        const superseded = await supersedeMemoryEntry(id, changes, actor);
        return superseded ? superseded.current : null;
    }
    const result = await withLock(() => {
        const entries = loadSharedMemory();
        const entry = entries.find(e => e.id === id);
        if (entry === undefined)
            return null;
        if (updates.scope !== undefined)
            entry.scope = updates.scope;
        if (updates.participants !== undefined) {
            if (updates.participants.length > 0) {
                entry.participants = updates.participants;
            }
            else {
                delete entry.participants;
            }
        }
        if (updates.expireAt !== undefined) {
            entry.expireAt = updates.expireAt;
        }
        writeEntriesUnlocked(entries);
        return entry;
    });
    return result.locked ? result.value : null;
}
/**
 * 手动归档：把活跃条目标记「已归档」并移入归档区文件。
 * 与删除不同：条目仍可经 memory_read(includeArchived) 查回。
 */
export async function archiveMemoryEntry(id) {
    const result = await withLock(() => {
        const entries = loadSharedMemory();
        const index = entries.findIndex(e => e.id === id);
        if (index === -1)
            return false;
        const removed = entries.splice(index, 1)[0];
        const archived = {
            ...removed,
            lifecycle: {
                ...(removed.lifecycle ?? { state: '当前' }),
                state: '已归档',
                reason: removed.lifecycle?.reason ?? '手动归档',
            },
        };
        writeEntriesUnlocked(entries);
        writeArchiveUnlocked([...loadArchivedMemories(), archived]);
        return true;
    });
    return result.locked ? result.value : false;
}
/**
 * 标记一条记忆为「已替代」（不删除、不新建）：去重与冲突保留场景使用。
 * 由记忆整理等治理流程调用；保留原内容，仅推进生命周期。
 */
export async function markMemorySuperseded(id, supersededBy, reason = '替代') {
    const result = await withLock(() => {
        const entries = loadSharedMemory();
        const entry = entries.find(e => e.id === id);
        if (entry === undefined)
            return false;
        entry.lifecycle = {
            ...(entry.lifecycle ?? { state: '当前' }),
            state: '已替代',
            supersededBy,
            reason,
        };
        writeEntriesUnlocked(entries);
        return true;
    });
    return result.locked ? result.value : false;
}
/** 删除一条记忆（按 id 查找；仅主人、显式操作） */
export async function deleteMemoryEntry(id) {
    const result = await withLock(() => {
        const entries = loadSharedMemory();
        const index = entries.findIndex(e => e.id === id);
        if (index === -1)
            return false;
        entries.splice(index, 1);
        writeEntriesUnlocked(entries);
        return true;
    });
    return result.locked ? result.value : false;
}
/** 清除过期的记忆，返回清理数量（TTL 本身即「自declared 短命」，语义不变） */
export async function pruneExpiredMemories() {
    const result = await withLock(() => {
        const entries = loadSharedMemory();
        const now = new Date().toISOString();
        const filtered = entries.filter(e => !e.expireAt || e.expireAt > now);
        if (filtered.length === entries.length)
            return 0;
        writeEntriesUnlocked(filtered);
        return entries.length - filtered.length;
    });
    return result.locked ? result.value : 0;
}
