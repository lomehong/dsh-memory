import { registerMemoryApi } from "./memory-api.js";
import { registerMemoryTools, getMemorySummaryForUser } from "./memory-tools.js";
import { loadSharedMemory, filterMemoriesByUser, addMemoryEntry, clearSharedMemory, updateMemoryEntry, deleteMemoryEntry, pruneExpiredMemories } from "./memory-store.js";
export const name = 'dsh-memory';
export const inject = ['webServer'];
export const provide = ['dsh-memory'];
export function apply(ctx) {
    ctx.logger?.info?.('[dsh-memory] 共享记忆插件已加载');
    // 注册为服务，供其他插件（如 im-channel）通过 ctx.get('dsh-memory') 访问
    const memoryService = {
        registerMemoryTools,
        getMemorySummaryForUser,
        loadSharedMemory,
        filterMemoriesByUser,
        addMemoryEntry,
        clearSharedMemory,
        updateMemoryEntry,
        deleteMemoryEntry,
        pruneExpiredMemories,
    };
    ctx.provide('dsh-memory', memoryService);
    // 注册 HTTP API 路由（供管理页面查看记忆）
    ctx.inject(['webServer'], (wctx) => {
        const web = wctx.get('webServer');
        registerMemoryApi(web);
        ctx.logger?.info?.('[dsh-memory] API 路由已注册');
    });
}
export { registerMemoryTools, getMemorySummaryForUser } from "./memory-tools.js";
export { loadSharedMemory, filterMemoriesByUser, addMemoryEntry, clearSharedMemory, updateMemoryEntry, deleteMemoryEntry, pruneExpiredMemories } from "./memory-store.js";
