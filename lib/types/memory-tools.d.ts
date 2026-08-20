/**
 * 共享记忆 DSH 工具定义
 *
 * 注册两个工具到 DSH agent：
 *   - memory_write：写入记忆
 *   - memory_read：读取记忆（自动按权限过滤）
 *   - memory_update / memory_delete（仅主人）
 */
import type { Context } from '@deepseek-ai/cordis';
/** 注册共享记忆工具到 agent 上下文 */
export declare function registerMemoryTools(agentCtx: Context, userId: string, isMaster: boolean): void;
/** 获取记忆摘要（用于注入系统提示词） */
export declare function getMemorySummaryForUser(userId: string, isMaster: boolean): string;
