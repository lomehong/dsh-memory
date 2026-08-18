/**
 * dsh-memory 共享记忆插件入口
 *
 * 提供跨会话共享记忆能力，所有 agent 实例（主人和访客）可以读写同一份记忆。
 * 记忆访问权限由 scope + participants 控制。
 *
 * 使用方式：
 * 1. 在 agent 创建时，调用 registerMemoryTools(agentCtx, userId, isMaster) 注册工具
 * 2. 调用 getMemorySummaryForUser(userId, isMaster) 获取记忆摘要注入系统提示词
 * 3. 注册 HTTP API 路由供管理页面使用
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "dsh-memory";
export declare const inject: string[];
export declare const provide: string[];
export declare function apply(ctx: Context): void;
export { registerMemoryTools, getMemorySummaryForUser } from './memory-tools.ts';
export { loadSharedMemory, filterMemoriesByUser, addMemoryEntry, clearSharedMemory, updateMemoryEntry, deleteMemoryEntry, pruneExpiredMemories } from './memory-store.ts';
export type { MemoryEntry } from './memory-store.ts';
