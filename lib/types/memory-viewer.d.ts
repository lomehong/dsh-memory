/**
 * 会话视角登记表（v2.2 记忆自动驾驶的身份来源）——零依赖叶子模块。
 *
 * 独立成模块的动机：viewer WeakMap 原本放在 memory-tools.ts，而那个模块
 * 顶部有 dsh-tools 的 defineTool 值导入——该包只是 peerDependency
 * （.npmrc legacy-peer-deps 下 npm ci 不安装），测试图一旦经
 * memory-autopilot 拉进 memory-tools 就会在 CI 上 ERR_MODULE_NOT_FOUND
 * （本地因历史手装残留而绿，2026-09-16 Release #7 实证）。
 * 叶子化后 autopilot/测试只依赖本模块，与工具定义彻底解耦。
 *
 * 键取 agentCtx（= systemPrompt 段 context.agent.ctx，与 dsh-twin
 * noteActor 的 WeakMap 取法一致）；模块级单例：web 预设行与 bundle 共享
 * 同一份包实例。身份未登记的会话一律 fail-closed 跳过注入/沉淀
 * （LESSONS 8 模式：宁可少注入，不可泄露给无法证明身份的对话者）。
 */
export interface MemoryViewer {
    userId: string;
    isMaster: boolean;
}
/** 挂载点登记会话视角（registerMemoryTools 自动调用；一般无需手工调用）。 */
export declare function noteMemoryViewer(agentCtx: unknown, userId: string, isMaster: boolean): void;
/** 查询会话视角；未登记返回 undefined（调用方应 fail-closed 跳过）。 */
export declare function memoryViewerOf(agentCtx: unknown): MemoryViewer | undefined;
