import { registerMemoryTools } from "./memory-tools.js";
import { SECTION_NAME, SECTION_ORDER, renderMemorySection } from "./memory-autopilot.js";
export const name = 'tool-memory';
export const inject = ['tools', 'systemPrompt'];
export function apply(ctx) {
    // preset 组合中注册记忆工具。web GUI 用户是主人，isMaster=true。
    registerMemoryTools(ctx, 'master', true);
    // 按轮记忆装配段：随工具挂载注册进所在 agent 的 systemPrompt（每模型步重求值；
    // 身份未登记/injectPerTurn 关闭 → 空串 fail-closed）。注册失败只失去自动化，
    // 工具路径不受影响。
    try {
        const systemPrompt = ctx.systemPrompt;
        if (systemPrompt && typeof systemPrompt.section === 'function') {
            systemPrompt.section({ name: SECTION_NAME, order: SECTION_ORDER, text: renderMemorySection });
            ctx.logger?.info?.('[dsh-memory] 按轮记忆装配段已随工具挂载注册（memory-pack，随会话自洽）');
        }
        else {
            ctx.logger?.warn?.('[dsh-memory] systemPrompt 服务缺席——按轮装配未注册（memory_read 工具路径不受影响）');
        }
    }
    catch (error) {
        ctx.logger?.warn?.('[dsh-memory] 装配段注册失败（工具路径不受影响）:', error instanceof Error ? error.message : String(error));
    }
}
