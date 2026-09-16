import { registerMemoryApi } from "./memory-api.js";
import { registerAssembleApi } from "./memory-assemble.js";
import { registerMemoryTools, getMemorySummaryForUser } from "./memory-tools.js";
import { registerMemoryAutopilot, reviewAllWindows } from "./memory-autopilot.js";
import { loadSharedMemory, loadArchivedMemories, filterMemoriesByUser, filterMemoriesForRead, addMemoryEntry, clearSharedMemory, updateMemoryEntry, supersedeMemoryEntry, markMemorySuperseded, archiveMemoryEntry, deleteMemoryEntry, pruneExpiredMemories, effectiveStatementType, effectiveLifecycle, splitKeywords, } from "./memory-store.js";
import { assembleMemoryPack } from "./memory-assemble.js";
export const name = 'dsh-memory';
// webServer 不是硬依赖：核心功能（provide 服务 + 工具注册）不需要 webServer，
// 只有 HTTP API 路由需要（apply 里用 ctx.inject 可选注入）。
// 去掉硬依赖声明，让插件尽早加载并 provide 'dsh-memory' 服务，
// 避免 im-channel 等 consumer 在 agent 创建时 ctx.get('dsh-memory') 返回 undefined。
export const provide = ['dsh-memory'];
export function apply(ctx) {
    ctx.logger?.info?.('[dsh-memory] 共享记忆插件已加载');
    // v2.2 记忆自动驾驶：读侧按轮自动装配 + 写侧对话复盘沉淀 + 审批留痕。
    // 全部宿主接缝、内部逐回调防御；失败只降级自动化能力，不影响下方核心服务。
    try {
        registerMemoryAutopilot(ctx);
    }
    catch (error) {
        ctx.logger?.warn?.('[dsh-memory] 自动驾驶注册失败（仅失去自动化，工具路径不受影响）:', error instanceof Error ? error.message : String(error));
    }
    // 注册为服务，供其他插件（如 im-channel）通过 ctx.get('dsh-memory') 访问
    const memoryService = {
        registerMemoryTools,
        getMemorySummaryForUser,
        loadSharedMemory,
        loadArchivedMemories,
        filterMemoriesByUser,
        filterMemoriesForRead,
        addMemoryEntry,
        clearSharedMemory,
        updateMemoryEntry,
        supersedeMemoryEntry,
        markMemorySuperseded,
        archiveMemoryEntry,
        deleteMemoryEntry,
        pruneExpiredMemories,
        effectiveStatementType,
        effectiveLifecycle,
        // 按回合记忆装配（v2.2 起检索升级）：把消息切词后多关键词评分检索，
        // 生成带审计回执的记忆包文本。im-channel 开关开启时逐回合调用；
        // 装配失败返回空文本，绝不阻断消息派发。
        // （v2.2 注：web/IM 会话的按轮注入已由 memory-autopilot 的 systemPrompt
        // 段自动完成，本方法保留给 im-channel 旧开关路径与进程内消费方。）
        assemblePack: (userId, isMaster, query) => {
            try {
                const keywords = splitKeywords(query, 8);
                const result = assembleMemoryPack({ userId, isMaster }, { keywords, limit: 8 });
                if (result.pack.length === 0)
                    return { text: '' };
                const lines = result.pack.map(e => `• [${effectiveStatementType(e)}] ${e.content}`);
                return { text: `【相关共享记忆（自动装配，仅供参考）】\n${lines.join('\n')}` };
            }
            catch {
                return { text: '' };
            }
        },
        // v2.2 自动驾驶：手动触发一轮复盘（管理/调试用），返回沉淀条数
        autopilotReviewNow: () => reviewAllWindows(ctx),
    };
    ctx.provide('dsh-memory', memoryService);
    // 过期记忆自动清理：插件加载时清理一次，之后定期清理，
    // 避免过期条目长期占用 MAX_ENTRIES 配额并计入摘要。
    void pruneExpiredMemories().catch((error) => {
        ctx.logger?.warn?.('[dsh-memory] 过期记忆清理失败（下个周期重试）:', error instanceof Error ? error.message : String(error));
    });
    const pruneTimer = setInterval(() => {
        void pruneExpiredMemories().catch((error) => {
            ctx.logger?.warn?.('[dsh-memory] 过期记忆清理失败（下个周期重试）:', error instanceof Error ? error.message : String(error));
        });
    }, 10 * 60 * 1000);
    pruneTimer.unref?.();
    const maybeLifecycle = ctx;
    maybeLifecycle.on?.('dispose', () => clearInterval(pruneTimer));
    // 注册 HTTP API 路由（供管理页面查看记忆）
    ctx.inject(['webServer'], (wctx) => {
        const web = wctx.get('webServer');
        const { token } = registerMemoryApi(web);
        registerAssembleApi(web, token);
        ctx.logger?.info?.('[dsh-memory] API 路由已注册（含 v2.1 assemble/回执）');
    });
}
export { registerMemoryTools, getMemorySummaryForUser } from "./memory-tools.js";
export { loadSharedMemory, loadArchivedMemories, filterMemoriesByUser, filterMemoriesForRead, addMemoryEntry, clearSharedMemory, updateMemoryEntry, supersedeMemoryEntry, markMemorySuperseded, archiveMemoryEntry, deleteMemoryEntry, pruneExpiredMemories, effectiveStatementType, effectiveLifecycle, MAX_ENTRIES, MAX_ARCHIVE_ENTRIES, } from "./memory-store.js";
