/** 陈述类型（移植自 Decision Assistant 六类陈述） */
export type StatementType = '事实' | '推断' | '偏好' | '候选' | '授权' | '已验证结果';
export declare const STATEMENT_TYPES: readonly StatementType[];
/** 生命周期状态 */
export type LifecycleState = '当前' | '已替代' | '已归档';
/** 来源归因：谁说的、凭什么（来源登记 ≠ 事实晋升） */
export interface MemorySource {
    origin: 'seed' | 'conversation' | 'yuyi_message' | 'tool_result' | 'human' | 'api';
    /** 归因引用：消息ID / 日程ID / 种子文件 / 对端 agentId */
    ref?: string;
    /** 御驿消息发送方是否经 Hub 背书（仅 yuyi_message） */
    hubEndorsed?: boolean;
}
/** 授权四元组（移植自 Decision Assistant 决策记录的授权章节） */
export interface MemoryAuth {
    status: '未授权' | '已授权' | '已拒绝';
    /** 授权人 userid */
    by?: string;
    /** 授权来源（消息ID / 会话引用） */
    via?: string;
    /** 授权范围 */
    range?: string;
}
/** 验证状态：PASS 不等于 Go，未验证的事实只是候选 */
export interface MemoryVerify {
    status: '未验证' | '已验证';
    method?: string;
    at?: string;
}
/** 生命周期与替代链（双向链接，不物理删除） */
export interface MemoryLifecycle {
    state: LifecycleState;
    /** 本条替代的旧条目 id */
    supersedes?: string;
    /** 替代本条的新条目 id */
    supersededBy?: string;
    reason?: string;
}
/** 记忆条目（v2：新增可选认识论字段，旧条目缺省按 候选/当前/未验证 解释） */
export interface MemoryEntry {
    id: string;
    timestamp: string;
    type: string;
    content: string;
    author: string;
    authorRole: 'master' | 'guest';
    scope: 'master' | 'self' | 'public';
    participants?: string[];
    refId?: string;
    /** 过期时间（ISO 字符串），过期后自动清理；不设则永不过期 */
    expireAt?: string;
    /** 陈述类型，缺省读取时按「候选」解释 */
    statementType?: StatementType;
    /** 来源归因 */
    source?: MemorySource;
    /** 授权信息（仅授权类条目） */
    auth?: MemoryAuth;
    /** 验证信息 */
    verify?: MemoryVerify;
    /** 生命周期与替代链 */
    lifecycle?: MemoryLifecycle;
    /** 复核提示日期（ISO 日期），到期提示复核 */
    reviewBy?: string;
}
/** 存储结构（活跃与归档文件同构） */
export interface SharedMemoryStore {
    entries: MemoryEntry[];
}
/** 读取侧兼容：缺省陈述类型按「候选」解释 */
export declare function effectiveStatementType(e: MemoryEntry): StatementType;
/** 读取侧兼容：缺省生命周期按「当前」解释 */
export declare function effectiveLifecycle(e: MemoryEntry): LifecycleState;
/** 最多保留的活跃记忆条数 */
export declare const MAX_ENTRIES = 500;
/** 归档区上限，超出按最旧 FIFO 裁剪 */
export declare const MAX_ARCHIVE_ENTRIES = 5000;
/** 加载活跃记忆 */
export declare function loadSharedMemory(): MemoryEntry[];
/** 加载归档记忆（不删除的「第二历史」） */
export declare function loadArchivedMemories(): MemoryEntry[];
/** 添加一条记忆（整个读-改-写在锁内完成） */
export declare function addMemoryEntry(entry: Omit<MemoryEntry, 'id' | 'timestamp'>): Promise<MemoryEntry | null>;
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
export declare function filterMemoriesByUser(entries: MemoryEntry[], userId: string, isMaster: boolean): MemoryEntry[];
export interface ReadFilterOptions {
    /** 按陈述类型精确过滤 */
    statementType?: StatementType;
    /** 是否包含「已替代」条目（默认只看当前） */
    includeSuperseded?: boolean;
}
/**
 * 读取过滤：默认仅返回「当前」条目（旧条目无 lifecycle 字段视为当前）；
 * 归档区条目由调用方单独加载后并入。
 */
export declare function filterMemoriesForRead(entries: MemoryEntry[], options?: ReadFilterOptions): MemoryEntry[];
/** 获取记忆摘要文本（用于注入系统提示词） */
export declare function getMemorySummary(entries: MemoryEntry[]): string;
/** 按关键词搜索 */
export declare function searchMemories(entries: MemoryEntry[], keyword: string): MemoryEntry[];
/** 清除所有活跃记忆（归档区保留，历史不物理删除） */
export declare function clearSharedMemory(): Promise<boolean>;
export interface MemoryActor {
    author?: string;
    authorRole?: 'master' | 'guest';
}
export interface SupersedeChanges {
    content?: string;
    statementType?: StatementType;
    type?: string;
}
/**
 * 替代式修订：陈述类变更不覆盖历史，而是创建新条目并与旧条目双向链接。
 * 新条目继承 type/scope/participants/refId/source；expireAt 由修订人重新决定。
 */
export declare function supersedeMemoryEntry(id: string, changes: SupersedeChanges, actor?: MemoryActor): Promise<{
    previous: MemoryEntry;
    current: MemoryEntry;
} | null>;
export interface MemoryUpdates {
    content?: string;
    scope?: MemoryEntry['scope'];
    participants?: string[];
    expireAt?: string;
    statementType?: StatementType;
    type?: string;
}
/**
 * 更新一条记忆（按 id 查找）：
 * - 陈述类变更（content / statementType / type）→ 替代语义，产生新条目并保留历史；
 * - 纯权限类变更（scope / participants / expireAt）→ 原地修改，不产生认识论历史。
 */
export declare function updateMemoryEntry(id: string, updates: MemoryUpdates, actor?: MemoryActor): Promise<MemoryEntry | null>;
/**
 * 手动归档：把活跃条目标记「已归档」并移入归档区文件。
 * 与删除不同：条目仍可经 memory_read(includeArchived) 查回。
 */
export declare function archiveMemoryEntry(id: string): Promise<boolean>;
/**
 * 标记一条记忆为「已替代」（不删除、不新建）：去重与冲突保留场景使用。
 * 由记忆整理等治理流程调用；保留原内容，仅推进生命周期。
 */
export declare function markMemorySuperseded(id: string, supersededBy: string, reason?: string): Promise<boolean>;
/** 删除一条记忆（按 id 查找；仅主人、显式操作） */
export declare function deleteMemoryEntry(id: string): Promise<boolean>;
/** 清除过期的记忆，返回清理数量（TTL 本身即「自declared 短命」，语义不变） */
export declare function pruneExpiredMemories(): Promise<number>;
