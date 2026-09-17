/**
 * 记忆工具的 agent preset 入口：preset 行（`name: '@dsh-extra/dsh-memory/tools'`）
 * 引用本模块，由该 preset 组合出的会话获得 memory_read / memory_write /
 * memory_update / memory_delete 工具 + **按轮记忆自动装配段**（memory-pack）。
 *
 * 自洽设计（2026-09-15 根治）：按轮装配段随本模块挂载、注册进**所在 agent 的
 * systemPrompt**——不依赖宿主接线或兄弟插件。此前注册挂在 bundle 的 app 层
 * ctx（ctx.inject(['systemPrompt'])），而 systemPrompt 服务是 per-agent 的，
 * 注入永不触发（装配回执 0 条实证），读侧自动驾驶整体哑火。
 *
 * 宿主平面服务（'dsh-memory' service + HTTP API）由 bundle 补丁另行挂载。
 * web GUI 用户是主人（isMaster=true），IM 通道 agent 会被 im-channel 的
 * mountSharedMemory 覆盖（带正确的 userId/isMaster）。
 *
 * @module @dsh-extra/dsh-memory/tools
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "tool-memory";
export declare const inject: string[];
export declare function apply(ctx: Context): void;
