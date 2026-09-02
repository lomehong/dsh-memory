/**
 * 共享记忆管理页面（HTML）— 治理视图
 *
 * 简单的 Web 管理界面，直接在浏览器中查看和管理共享记忆。
 * 通过 GET /dsh-memory 访问。
 *
 * 治理视图（移植自 Decision Assistant 的认识论纪律）：
 * - 每条记忆显示陈述类型徽章（事实/推断/偏好/候选/授权/已验证结果）
 * - 生命周期标记（已替代半透明展示，替代链可见）
 * - 来源归因（human/conversation/yuyi_message/seed/api）
 * - 陈述类型分布统计与按陈述过滤
 * - 归档区只读面板（不删除的历史）
 */
import type { ServerResponse } from 'node:http';
export declare function serveAdminPage(res: ServerResponse, adminToken: string): void;
