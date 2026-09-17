import { registerMemoryTools } from "./memory-tools.js";
import { captureClaim, SECTION_NAME, SECTION_ORDER, renderMemorySection, trace } from "./memory-autopilot.js";
import { memoryViewerOf, noteMemoryViewer } from "./memory-viewer.js";
export const name = 'tool-memory';
export const inject = ['tools', 'systemPrompt'];
export function apply(ctx) {
    trace('apply 进入（agent 上下文实例化 tool-memory）');
    // preset 组合中注册记忆工具。web GUI 用户是主人，isMaster=true。
    registerMemoryTools(ctx, 'master', true);
    trace('registerMemoryTools 完成（identity 已登记 viewerByCtx）');
    // per-agent 捕获兜底 + 身份自愈：app 层监听若收不到 agent 级事件，本会话自己的
    // ctx 上再挂一份（captureClaim 按消息 id 幂等，双监听不双捕）。claimed 事件的
    // payload 自带 agent.ctx——若其 viewer 未登记，用**挂载声明**（'master', true）
    // 补登：能挂本 preset 行的会话，身份声明就是主人（im-channel 会另行覆盖正确身份）。
    try {
        const events = ctx;
        if (typeof events.on === 'function') {
            events.on('agent/inbox/claimed', (payload) => {
                try {
                    // 自愈必须在 captureClaim **之前**：captureClaim 的 viewer 门会提前返回，
                    // 先补登身份，捕获才能落 lastClaim（段回调的门4 才有 claim 可取）。
                    const agentCtx = payload?.agent?.ctx;
                    if (agentCtx !== null && typeof agentCtx === 'object' && memoryViewerOf(agentCtx) === undefined) {
                        noteMemoryViewer(agentCtx, 'master', true);
                        trace('身份自愈：claimed 事件的 agentCtx 以挂载声明补登（master）');
                    }
                }
                catch { /* 防御 */ }
                try {
                    captureClaim(payload);
                }
                catch { /* 防御 */ }
            });
            trace('per-agent claimed 监听已注册（含身份自愈）');
        }
        else {
            trace('ctx.on 缺席——per-agent claimed 兜底不可用');
        }
    }
    catch { /* 防御 */ }
    // 按轮记忆装配段：随工具挂载注册进所在 agent 的 systemPrompt（每模型步重求值；
    // 身份未登记/injectPerTurn 关闭 → 空串 fail-closed）。注册失败只失去自动化，
    // 工具路径不受影响。
    try {
        const spViaProp = ctx.systemPrompt;
        const spViaGet = (() => { try {
            return ctx.get?.('systemPrompt');
        }
        catch {
            return undefined;
        } })();
        const systemPrompt = (spViaProp && typeof spViaProp.section === 'function' ? spViaProp
            : spViaGet && typeof spViaGet.section === 'function' ? spViaGet : undefined);
        trace(`systemPrompt 解析：prop=${spViaProp ? '有' : '无'} get=${spViaGet ? '有' : '无'}`);
        if (systemPrompt && typeof systemPrompt.section === 'function') {
            systemPrompt.section({ name: SECTION_NAME, order: SECTION_ORDER, text: renderMemorySection });
            trace(`memory-pack 段注册成功（order ${SECTION_ORDER}）`);
            ctx.logger?.info?.('[dsh-memory] 按轮记忆装配段已随工具挂载注册（memory-pack，随会话自洽）');
        }
        else {
            trace('✗ systemPrompt 服务缺席——按轮装配未注册（memory_read 工具路径不受影响）');
            ctx.logger?.warn?.('[dsh-memory] systemPrompt 服务缺席——按轮装配未注册（memory_read 工具路径不受影响）');
        }
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        trace(`✗ 装配段注册失败：${msg}`);
        ctx.logger?.warn?.('[dsh-memory] 装配段注册失败（工具路径不受影响）:', msg);
    }
}
