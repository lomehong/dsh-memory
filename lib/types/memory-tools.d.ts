/**
 * 共享记忆 DSH 工具定义（v2：认识论参数 + 读取过滤 + 替代式更新）
 *
 * 注册工具到 DSH agent：
 *   - memory_write：写入记忆（含陈述类型 / 来源归因 / 授权 / 验证）
 *   - memory_read：读取记忆（自动按权限过滤，默认仅当前条目）
 *   - memory_update / memory_delete（仅主人；陈述类变更走替代链）
 *
 * 治理语义见 docs/决策记忆治理-设计.md：写入默认值即治理——
 * 主人亲述默认「事实」，访客与外部消息默认「候选」，来源登记 ≠ 事实晋升。
 */
import type { Context } from '@deepseek-ai/cordis';
/** 注册共享记忆工具到 agent 上下文 */
export declare function registerMemoryTools(agentCtx: Context, userId: string, isMaster: boolean): void;
/**
 * 获取记忆摘要（用于注入系统提示词）
 *
 * 只注入真实的元信息（当前条数、陈述类型分布、最近写入时间），不声称“相关”——
 * 是否相关由模型调用 memory_read 后自行判断。
 */
export declare function getMemorySummaryForUser(userId: string, isMaster: boolean): string;
