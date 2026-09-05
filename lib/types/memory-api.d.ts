/** 注册共享记忆 API 路由；返回写门禁 token（供同插件其他 HTTP 面复用同一门禁）。 */
export declare function registerMemoryApi(web: {
    register: (route: {
        kind: string;
        path: string;
        handler: (req: unknown, res: unknown) => void;
    }) => void;
}): {
    token: string;
};
