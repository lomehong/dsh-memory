import { type MemoryEntry, type StatementType, type SupportState } from './memory-store.ts';
export interface AssembleViewer {
    userId: string;
    isMaster: boolean;
    /** v2 增：当前对话者注册表 id（用于关系摘要回注；缺省 = 不回注关系段） */
    actorId?: string;
}
export interface AssembleQuery {
    keywords?: string[];
    statementType?: StatementType;
    /** 最多注入条数（默认 20，上限 50） */
    limit?: number;
    /** 回合标识（缺省自动生成） */
    turnId?: string;
}
export interface ReceiptItem {
    id: string;
    bytes: number;
    statementType: StatementType;
    support: SupportState;
    visibilityRule: 'master' | 'public' | 'participant' | 'self-author';
}
export interface RelationDigestItem {
    memoryId: string;
    content: string;
    kind: '观察' | '推断';
    /** 「推断」标记；观察项此字段为空字符串 */
    inferred: string;
    /** 未闭环时间戳（仅开环项） */
    openLoopAt?: string;
    ts: string;
}
export interface RelationDigest {
    actorId: string;
    openLoops: RelationDigestItem[];
    observations: RelationDigestItem[];
    bytes: number;
    sha256: string;
    truncated: boolean;
}
export interface AssemblyReceipt {
    turnId: string;
    at: string;
    viewer: {
        userId: string;
        isMaster: boolean;
    };
    items: ReceiptItem[];
    totalBytes: number;
    packSha256: string;
    /** v2 增：actorId 命中时随 pack 一起装配的关系摘要段 */
    relationDigest?: RelationDigest;
}
export interface AssembleResult {
    pack: MemoryEntry[];
    receipt: AssemblyReceipt;
}
/**
 * 装配：可见性过滤 → 生命周期过滤 → 关键词检索 → 截断，并生成回执。
 * fail-closed：viewer 字段缺失直接抛错（不发布部分上下文）。
 */
export declare function assembleMemoryPack(viewer: AssembleViewer, query?: AssembleQuery): AssembleResult;
/** 回执落盘（<dir>/<日期>/<turnId>.json，0600），并滚动清理 90 天前的目录 */
export declare function saveReceipt(receipt: AssemblyReceipt): void;
/** 清理超过 keepDays 的回执目录 */
export declare function cleanupReceipts(keepDays: number): number;
/** 读取一份回执（审计/调查用） */
export declare function loadReceipt(turnId: string): AssemblyReceipt | null;
/** 注册 HTTP 路由（POST /dsh-memory/assemble；安全审计 H2：本端点按 token 门禁——
 *  它返回主人可见的记忆包，绝不能信任请求体自报的 isMaster；进程内消费方走服务面
 *  assemblePack，不经此路由）。路由随 webServer 存活，无需单独 disposer */
export declare function registerAssembleApi(web: {
    register: (route: {
        kind: string;
        path: string;
        handler: (req: unknown, res: unknown) => void;
    }) => void;
}, adminToken: string): void;
