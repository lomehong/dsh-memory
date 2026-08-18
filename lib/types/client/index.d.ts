/**
 * 共享记忆客户端插件
 *
 * 在对话区域注册「记忆」Tab，位于轨迹之后。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
