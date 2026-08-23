/**
 * 共享记忆管理页面（HTML）
 *
 * 简单的 Web 管理界面，直接在浏览器中查看和管理共享记忆。
 * 通过 GET /dsh-memory 访问。
 */
import type { ServerResponse } from 'node:http';
export declare function serveAdminPage(res: ServerResponse, adminToken: string): void;
