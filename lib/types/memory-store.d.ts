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
/** 加载所有记忆 */
export declare function loadSharedMemory(): MemoryEntry[];
/** 保存记忆（带文件锁） */
export declare function saveSharedMemory(entries: MemoryEntry[]): boolean;
/** 添加一条记忆（带文件锁） */
export declare function addMemoryEntry(entry: Omit<MemoryEntry, 'id' | 'timestamp'>): MemoryEntry | null;
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
export declare function filterMemoriesByUser(entries: MemoryEntry[], userId: string, isMaster: boolean): MemoryEntry[];
/** 获取记忆摘要文本（用于注入系统提示词） */
export declare function getMemorySummary(entries: MemoryEntry[]): string;
/** 按关键词搜索 */
export declare function searchMemories(entries: MemoryEntry[], keyword: string): MemoryEntry[];
/** 清除所有记忆 */
export declare function clearSharedMemory(): boolean;
/** 更新一条记忆的部分字段（按 id 查找） */
export declare function updateMemoryEntry(id: string, updates: {
    content?: string;
    scope?: MemoryEntry['scope'];
    participants?: string[];
    expireAt?: string;
}): MemoryEntry | null;
/** 删除一条记忆（按 id 查找） */
export declare function deleteMemoryEntry(id: string): boolean;
/** 清除过期的记忆，返回清理数量 */
export declare function pruneExpiredMemories(): number;
