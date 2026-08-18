/** 注册共享记忆 API 路由 */
export declare function registerMemoryApi(web: {
    register: (route: {
        kind: string;
        path: string;
        handler: (req: unknown, res: unknown) => void;
    }) => void;
}): void;
