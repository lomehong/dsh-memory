import { registerMemoryTools, getMemorySummaryForUser } from "./memory-tools.js";
export const name = 'tool-memory';
export const inject = ['tools', 'systemPrompt'];
export function apply(ctx) {
    // preset 组合中注册记忆工具。web GUI 用户是主人，isMaster=true。
    // IM 通道 agent 的 setup 回调会再次注册（shadow 这里的），带正确 userId/isMaster。
    registerMemoryTools(ctx, 'master', true);
    // 注入记忆摘要到系统提示词（让 agent 知道有记忆可读）
    const summary = getMemorySummaryForUser('master', true);
    if (summary) {
        const sp = ctx;
        sp.systemPrompt?.section({
            name: 'tool:memory',
            order: 106,
            text: summary,
        });
    }
}
