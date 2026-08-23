/** 记忆条目 */
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
}
/** 存储结构 */
export interface SharedMemoryStore {
    entries: MemoryEntry[];
}
/** 最多保留的记忆条数 */
export declare const MAX_ENTRIES = 500;
/** 加载所有记忆 */
export declare function loadSharedMemory(): MemoryEntry[];
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
/** 获取记忆摘要文本（用于注入系统提示词） */
export declare function getMemorySummary(entries: MemoryEntry[]): string;
/** 按关键词搜索 */
export declare function searchMemories(entries: MemoryEntry[], keyword: string): MemoryEntry[];
/** 清除所有记忆 */
export declare function clearSharedMemory(): Promise<boolean>;
/** 更新一条记忆的部分字段（按 id 查找） */
export declare function updateMemoryEntry(id: string, updates: {
    content?: string;
    scope?: MemoryEntry['scope'];
    participants?: string[];
    expireAt?: string;
}): Promise<MemoryEntry | null>;
/** 删除一条记忆（按 id 查找） */
export declare function deleteMemoryEntry(id: string): Promise<boolean>;
/** 清除过期的记忆，返回清理数量 */
export declare function pruneExpiredMemories(): Promise<number>;
