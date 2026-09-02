/**
 * 装配与回执（v2.1，实施计划 T5 / 设计文档 v0.2 决策七）
 *
 * 视野回执：每轮对外会话的记忆装配生成轻量回执（取了哪些记忆、可见性
 * 依据、支持度、字节量、摘要），落入审计日志——泄露调查能精确回答
 * "分身当时看见了什么"；对外陈述可归因到具体记忆条目。
 *
 * 回执是事后审计件而非事前门禁：不做逐请求授权与原子发布（对话流
 * 承受不起），仅落盘 + 滚动清理（默认 90 天）。
 */
import { mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { loadSharedMemory, filterMemoriesByUser, filterMemoriesForRead, searchMemories, effectiveStatementType, effectiveSupport, } from "./memory-store.js";
function visibilityRuleOf(e, userId, isMaster) {
    if (isMaster)
        return 'master';
    if (e.scope === 'public')
        return 'public';
    if (e.participants?.includes(userId))
        return 'participant';
    return 'self-author';
}
function receiptDir() {
    const base = process.env.DSH_HOME ?? join(homedir(), '.dsh');
    return join(base, 'dsh-memory', 'receipts');
}
/**
 * 装配：可见性过滤 → 生命周期过滤 → 关键词检索 → 截断，并生成回执。
 * fail-closed：viewer 字段缺失直接抛错（不发布部分上下文）。
 */
export function assembleMemoryPack(viewer, query = {}) {
    if (typeof viewer?.userId !== 'string' || viewer.userId === '') {
        throw new Error('assemble: viewer.userId 不能为空');
    }
    const limit = Math.max(1, Math.min(50, query.limit ?? 20));
    let visible = filterMemoriesByUser(loadSharedMemory(), viewer.userId, viewer.isMaster);
    visible =
        query.statementType !== undefined
            ? filterMemoriesForRead(visible, { statementType: query.statementType })
            : filterMemoriesForRead(visible);
    if (query.keywords !== undefined && query.keywords.length > 0) {
        for (const kw of query.keywords) {
            visible = searchMemories(visible, kw);
        }
    }
    const pack = visible.slice(-limit);
    const items = pack.map(e => ({
        id: e.id,
        bytes: Buffer.byteLength(e.content, 'utf8'),
        statementType: effectiveStatementType(e),
        support: effectiveSupport(e),
        visibilityRule: visibilityRuleOf(e, viewer.userId, viewer.isMaster),
    }));
    const packJson = JSON.stringify(pack);
    const receipt = {
        turnId: query.turnId ?? `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: new Date().toISOString(),
        viewer: { userId: viewer.userId, isMaster: viewer.isMaster },
        items,
        totalBytes: Buffer.byteLength(packJson, 'utf8'),
        packSha256: createHash('sha256').update(packJson).digest('hex'),
    };
    saveReceipt(receipt);
    return { pack, receipt };
}
/** 回执落盘（<dir>/<日期>/<turnId>.json，0600），并滚动清理 90 天前的目录 */
export function saveReceipt(receipt) {
    const dir = join(receiptDir(), receipt.at.slice(0, 10));
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${receipt.turnId}.json`);
    const tmp = `${path}.tmp-${process.pid}`;
    writeFileSync(tmp, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    renameSync(tmp, path);
    cleanupReceipts(90);
}
/** 清理超过 keepDays 的回执目录 */
export function cleanupReceipts(keepDays) {
    const root = receiptDir();
    if (!existsSync(root))
        return 0;
    const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
    let removed = 0;
    for (const name of readdirSync(root)) {
        const dir = join(root, name);
        try {
            if (!existsSync(dir))
                continue;
            const statOk = /^\d{4}-\d{2}-\d{2}$/.test(name);
            if (!statOk)
                continue;
            const dirTime = new Date(name + 'T00:00:00Z').getTime();
            if (dirTime < cutoff) {
                rmSync(dir, { recursive: true, force: true });
                removed += 1;
            }
        }
        catch {
            // 单目录失败跳过
        }
    }
    return removed;
}
/** 读取一份回执（审计/调查用） */
export function loadReceipt(turnId) {
    const root = receiptDir();
    if (!existsSync(root))
        return null;
    for (const day of readdirSync(root)) {
        const path = join(root, day, `${turnId}.json`);
        if (existsSync(path)) {
            try {
                return JSON.parse(readFileSync(path, 'utf8'));
            }
            catch {
                return null;
            }
        }
    }
    return null;
}
/** 注册 HTTP 路由（POST /dsh-memory/assemble；写路由 sameOrigin）。路由随 webServer 存活，无需单独 disposer */
export function registerAssembleApi(web) {
    web.register({
        kind: 'exact',
        path: '/dsh-memory/assemble',
        handler: (req, res) => {
            const r = req;
            const resLike = res;
            if (r.method !== 'POST') {
                resLike.writeHead(405, { 'Content-Type': 'application/json' });
                resLike.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
                return;
            }
            const chunks = [];
            let size = 0;
            r.on('data', c => {
                size += c.length;
                if (size > 64 * 1024)
                    r.destroy();
                else
                    chunks.push(c);
            });
            r.on('end', () => {
                try {
                    const origin = r.headers.origin;
                    if (origin !== undefined) {
                        const host = r.headers.host;
                        if (typeof host !== 'string' || new URL(String(origin)).host !== host) {
                            resLike.writeHead(403, { 'Content-Type': 'application/json' });
                            resLike.end(JSON.stringify({ ok: false, error: 'cross-origin denied' }));
                            return;
                        }
                    }
                    const body = JSON.parse(chunks.map(c => c.toString('utf8')).join('') || '{}');
                    const result = assembleMemoryPack({ userId: String(body.userId ?? ''), isMaster: body.isMaster === true }, {
                        ...(Array.isArray(body.keywords) ? { keywords: body.keywords.map(k => String(k)).slice(0, 5) } : {}),
                        ...(body.statementType !== undefined ? { statementType: body.statementType } : {}),
                        ...(body.limit !== undefined ? { limit: Number(body.limit) } : {}),
                        ...(body.turnId !== undefined ? { turnId: String(body.turnId).slice(0, 80) } : {}),
                    });
                    resLike.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    resLike.end(JSON.stringify({ ok: true, pack: result.pack, receipt: result.receipt }));
                }
                catch (e) {
                    resLike.writeHead(400, { 'Content-Type': 'application/json' });
                    resLike.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
                }
            });
        },
    });
}
