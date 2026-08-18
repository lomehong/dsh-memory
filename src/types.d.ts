/**
 * 类型声明桩 — 供 dsh-memory 插件独立编译使用
 * 运行时这些类型由 DSH 宿主提供，编译时无需真实类型。
 */
declare module '@deepseek-ai/cordis' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface Context {
    get<T = unknown>(key: string): T | undefined
    set(key: string, value: unknown): void
    inject(deps: string[], callback: (ctx: Context) => void): void
    logger?: { info?: (...args: unknown[]) => void; warn?: (...args: unknown[]) => void; error?: (...args: unknown[]) => void }
  }
}

declare module '@deepseek-ai/dsh-session' {
  export type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[]
}