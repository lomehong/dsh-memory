import type { Context } from '@deepseek-ai/cordis';
/** 文件级追踪（与 tools.ts 的 mount-trace.log 同文件；logger 缺席时唯一可见通道）。 */
export declare function trace(line: string): void;
export interface AutopilotConfig {
    /** 读侧：按轮自动装配注入（默认开） */
    injectPerTurn: boolean;
    /** 读侧：每轮最多注入条数（1..20，默认 5） */
    injectLimit: number;
    /** 读侧：注入文本字节预算（默认 1600） */
    injectBudgetBytes: number;
    /** 写侧：复盘器总开关（默认开） */
    reviewerEnabled: boolean;
    /** 写侧：会话空闲去抖复盘（默认开） */
    reviewOnIdle: boolean;
    /** 写侧：空闲去抖秒数（10..3600，默认 90） */
    idleDebounceSec: number;
    /** 写侧：周期兜底复盘间隔小时数（0=关，默认 6） */
    reviewPeriodicHours: number;
    /** 写侧：是否复盘访客会话（默认 false，保守侧） */
    reviewGuests: boolean;
    /** 写侧：单次复盘最多落库条数（默认 5） */
    reviewMaxEntries: number;
    /** 写侧：送提取的回合窗口文本上限字符（默认 4000） */
    reviewTranscriptChars: number;
    /** 审批留痕（默认开） */
    approvalMemory: boolean;
}
/** 配置合并（纯函数，测试用）：类型不合法的键回落默认值并夹紧边界。 */
export declare function mergeAutopilotConfig(raw: unknown): AutopilotConfig;
/** 读取自动驾驶配置（30s TTL 缓存；缺文件/解析失败 → 全默认）。 */
export declare function loadAutopilotConfig(now?: number): AutopilotConfig;
/** 保存自动驾驶配置：现有值合并补丁 → mergeAutopilotConfig 夹紧校验 → 原子写 → 失效缓存。返回保存后的完整配置。 */
export declare function saveAutopilotConfig(patch: unknown, now?: number): AutopilotConfig;
export interface TurnWindow {
    sessionId: string;
    agentCtx: unknown;
    viewer: {
        userId: string;
        isMaster: boolean;
    };
    /** 按认领顺序排列的回合（user=用户消息文本，assistant=该回合各步最终回复） */
    turns: Array<{
        user: string;
        assistant: string[];
    }>;
    /** 已复盘消费过的回合数（cursor，只向前推进） */
    reviewedTurnCount: number;
    lastActivityAt: number;
    reviewing: boolean;
}
/** 用户消息进入回合：仅记忆已挂载的会话建窗/追加（身份未登记 → 忽略）。
 *  同消息 id 幂等（app 层与 per-agent 双监听并存时防双捕）。 */
export declare function captureClaim(payload: unknown): void;
export declare const SECTION_NAME = "memory-pack";
/** dsh-twin 人格/守卫/活动段占用 25/26/27，记忆装配段紧随其后 */
export declare const SECTION_ORDER = 28;
/**
 * 渲染装配段文本（纯函数，测试用）：条目截断 160 字、逐条装入预算，
 * 一条都装不下时返回空串（零 token）。
 */
export declare function renderPackText(items: ReadonlyArray<{
    statementType: string;
    content: string;
}>, opts: {
    isMaster: boolean;
    budgetBytes: number;
}): string;
/**
 * systemPrompt `memory-pack` 段回调（同步，每个模型步前求值）。
 * 身份未登记 → 空串（fail-closed）；同轮多步经 messageId+mtime 缓存，
 * 只在「新消息或记忆库变化」时重新装配（回执因此每轮最多一份）。
 */
export declare function renderMemorySection(context: unknown): string;
interface ExtractedItem {
    content: string;
    type: string;
}
/**
 * 解析提取输出（纯函数，测试用）：剥代码围栏、截取首尾中括号、JSON.parse、
 * 逐项校验。任何失败返回空数组——复盘宁缺毋滥。
 */
export declare function parseExtraction(raw: string): ExtractedItem[];
/** 判重归一化：去空白、小写（纯函数，测试用）。 */
export declare function normalizeForDedup(s: string): string;
/**
 * 内容判重（纯函数，测试用）：与既有条目完全相同，或互相包含且长度差在
 * 容忍带内 → 重复。长度差约束避免「泛化旧条目」无限吞掉有新细节的抽取。
 */
export declare function isDuplicateContent(content: string, entries: ReadonlyArray<{
    content: string;
}>): boolean;
/** 回合窗口 → 提取输入文本；无可复盘内容返回 null（纯函数，测试用）。 */
export declare function renderTranscript(turns: ReadonlyArray<{
    user: string;
    assistant: string[];
}>, capChars: number): string | null;
/** 宿主 llm / 默认模型选择的最小结构视图（缺席 → 复盘显式降级跳过）。 */
interface AutopilotHostCtx {
    get(name: string): unknown;
}
export interface ReviewOutcome {
    written: number;
    reason: 'ok' | 'reviewer-disabled' | 'guest-skipped' | 'no-content' | 'extract-failed' | 'busy';
}
/**
 * 复盘一个会话窗口：提取 → 落库 → 推进 cursor。
 * 提取失败不推进 cursor（下个触发点重试）；重复进入置 busy 跳过。
 */
export declare function reviewWindow(ctx: AutopilotHostCtx, window: TurnWindow): Promise<ReviewOutcome>;
/** 立即复盘所有有未消费回合的窗口（服务面 reviewNow / 周期兜底共用）。 */
export declare function reviewAllWindows(ctx: AutopilotHostCtx): Promise<number>;
export type ApprovalOutcomeLike = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable' | unknown;
export interface ApprovalMemoryItem {
    authStatus: '已授权' | '已拒绝';
    content: string;
}
/**
 * 审批结果 → 授权记忆条目（纯函数，测试用）。
 * 只消费 allowed-once / rejected；cancelled/unavailable 不留痕。
 */
export declare function approvalMemoryItem(req: unknown, outcome: ApprovalOutcomeLike): ApprovalMemoryItem | undefined;
/**
 * 注册记忆自动驾驶（index.ts apply 内 try/catch 调用）。
 * 所有宿主回调独立防御；systemPrompt 段经 ctx.inject 惰性注册（服务晚到也
 * 能挂上，缺席则只失去自动注入，核心工具路径不受影响）。
 */
export declare function registerMemoryAutopilot(ctx: Context): void;
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
export declare function registerPackSection(systemPrompt: {
    section?: (s: unknown) => void;
}): void;
export {};
