import { registerMemoryTools } from "./memory-tools.js";
export const name = 'tool-memory';
export const inject = ['tools'];
export function apply(ctx) {
    // preset 组合中注册记忆工具。web GUI 用户是主人，isMaster=true。
    registerMemoryTools(ctx, 'master', true);
}
