import { type MemoryEntry, type StatementType, type SupportState } from './memory-store.ts';
export interface AssembleViewer {
    userId: string;
    isMaster: boolean;
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
/** 注册 HTTP 路由（POST /dsh-memory/assemble；写路由 sameOrigin）。路由随 webServer 存活，无需单独 disposer */
export declare function registerAssembleApi(web: {
    register: (route: {
        kind: string;
        path: string;
        handler: (req: unknown, res: unknown) => void;
    }) => void;
}): void;
