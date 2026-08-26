import { randomBytes } from 'node:crypto';
import { loadSharedMemory, clearSharedMemory, addMemoryEntry, updateMemoryEntry, deleteMemoryEntry, pruneExpiredMemories } from "./memory-store.js";
import { serveAdminPage } from "./memory-admin-page.js";
/** 读取请求体 JSON */
function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            try {
                const all = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
                let offset = 0;
                for (const c of chunks) {
                    all.set(c, offset);
                    offset += c.length;
                }
                resolve(JSON.parse(new TextDecoder().decode(all)));
            }
            catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}
/** 返回 JSON 响应 */
function respondJson(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}
/** 校验写操作的自定义请求头 token（跨域表单/脚本无法携带自定义头，因此同时起到 CSRF 防护作用） */
function hasAdminToken(req, token) {
    return req.headers['x-memory-token'] === token;
}
/** 拒绝未通过 token 校验的写请求 */
function unauthorized(res) {
    respondJson(res, 401, { ok: false, error: '缺少或无效的校验 token（x-memory-token）' });
}
/** 获取错误信息 */
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
/** 注册共享记忆 API 路由 */
export function registerMemoryApi(web) {
    // 写操作统一由启动时随机生成的 token 门禁：外部扫描器/跨站请求无法携带该自定义头。
    // 待 DSH webServer 未来在请求上携带会话身份后，应升级为真正的用户级鉴权。
    const adminToken = randomBytes(16).toString('hex');
    // GET /dsh-memory - 管理页面
    web.register({
        kind: 'exact',
        path: '/dsh-memory',
        handler: (_req, res) => {
            serveAdminPage(res, adminToken);
        },
    });
    // GET /dsh-memory/token - 下发写操作校验 token（供对话 Tab 等内置客户端使用）
    web.register({
        kind: 'exact',
        path: '/dsh-memory/token',
        handler: (_req, res) => {
            respondJson(res, 200, { ok: true, token: adminToken });
        },
    });
    // /dsh-memory/entries - 单一路由按方法分发（GET 列表 / POST 新增）。
    // 修复：同 path 用 kind:'exact' 注册两次会让 webServer 冲突、导致清除/更新/删除/清理等后续路由全部注册失败。
    // 注意：当前 DSH webServer 未在请求上附带用户身份，此处返回全部条目；待身份可用后应做按身份的权限过滤。
    web.register({
        kind: 'exact',
        path: '/dsh-memory/entries',
        handler: async (req, res) => {
            if (req.method === 'POST') {
                if (!hasAdminToken(req, adminToken)) {
                    unauthorized(res);
                    return;
                }
                try {
                    const body = await readJsonBody(req);
                    if (typeof body.content !== 'string' || !body.content.trim()) {
                        respondJson(res, 400, { ok: false, error: '需要 content' });
                        return;
                    }
                    const participants = Array.isArray(body.participants) ? body.participants.filter((p) => typeof p === 'string') : undefined;
                    const entry = await addMemoryEntry({
                        content: body.content.trim(),
                        type: typeof body.type === 'string' ? body.type : 'note',
                        scope: (body.scope === 'master' || body.scope === 'self' || body.scope === 'public') ? body.scope : 'master',
                        author: 'admin',
                        authorRole: 'master',
                        ...(participants !== undefined ? { participants } : {}),
                    });
                    if (entry === null) {
                        respondJson(res, 500, { ok: false, error: '写入失败（并发冲突）' });
                    }
                    else {
                        respondJson(res, 200, { ok: true, entry });
                    }
                }
                catch (error) {
                    respondJson(res, 500, { ok: false, error: messageOf(error) });
                }
                return;
            }
            try {
                const entries = loadSharedMemory();
                respondJson(res, 200, { ok: true, entries, total: entries.length });
            }
            catch (error) {
                respondJson(res, 500, { ok: false, error: messageOf(error) });
            }
        },
    });
    // POST /dsh-memory/clear - 清除所有记忆
    web.register({
        kind: 'exact',
        path: '/dsh-memory/clear',
        handler: async (_req, res) => {
            if (!hasAdminToken(_req, adminToken)) {
                unauthorized(res);
                return;
            }
            try {
                const ok = await clearSharedMemory();
                respondJson(res, 200, { ok });
            }
            catch (error) {
                respondJson(res, 500, { ok: false, error: messageOf(error) });
            }
        },
    });
    // POST /dsh-memory/entries/update - 更新一条记忆
    web.register({
        kind: 'exact',
        path: '/dsh-memory/entries/update',
        handler: async (req, res) => {
            if (!hasAdminToken(req, adminToken)) {
                unauthorized(res);
                return;
            }
            try {
                const body = await readJsonBody(req);
                if (typeof body.id !== 'string' || !body.id) {
                    respondJson(res, 400, { ok: false, error: '需要 id' });
                    return;
                }
                const updates = {};
                if (typeof body.content === 'string')
                    updates.content = body.content;
                if (typeof body.scope === 'string' && ['master', 'self', 'public'].includes(body.scope)) {
                    updates.scope = body.scope;
                }
                if (Array.isArray(body.participants)) {
                    updates.participants = body.participants.filter((p) => typeof p === 'string');
                }
                const result = await updateMemoryEntry(body.id, updates);
                if (result === null) {
                    respondJson(res, 404, { ok: false, error: '未找到该记忆' });
                }
                else {
                    respondJson(res, 200, { ok: true, entry: result });
                }
            }
            catch (error) {
                respondJson(res, 500, { ok: false, error: messageOf(error) });
            }
        },
    });
    // POST /dsh-memory/entries/delete - 删除一条记忆
    web.register({
        kind: 'exact',
        path: '/dsh-memory/entries/delete',
        handler: async (req, res) => {
            if (!hasAdminToken(req, adminToken)) {
                unauthorized(res);
                return;
            }
            try {
                const body = await readJsonBody(req);
                if (typeof body.id !== 'string' || !body.id) {
                    respondJson(res, 400, { ok: false, error: '需要 id' });
                    return;
                }
                const ok = await deleteMemoryEntry(body.id);
                respondJson(res, ok ? 200 : 404, { ok });
            }
            catch (error) {
                respondJson(res, 500, { ok: false, error: messageOf(error) });
            }
        },
    });
    // POST /dsh-memory/prune - 清除过期记忆
    web.register({
        kind: 'exact',
        path: '/dsh-memory/prune',
        handler: async (_req, res) => {
            if (!hasAdminToken(_req, adminToken)) {
                unauthorized(res);
                return;
            }
            try {
                const count = await pruneExpiredMemories();
                respondJson(res, 200, { ok: true, pruned: count });
            }
            catch (error) {
                respondJson(res, 500, { ok: false, error: messageOf(error) });
            }
        },
    });
}
