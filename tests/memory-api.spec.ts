/**
 * 记忆 API 路由注册冒烟测试（自递归事故回归测试）：
 * 同源加固曾把包装器命名为 register 并在内部调用自身——首条路由注册即
 * 无限递归栈溢出（被上层吞掉），/dsh-memory/* 全部 404。本测试锁死：
 * registerMemoryApi 必须把全部预期路由真实注册到宿主 web 上。
 */
import { describe, expect, it, vi } from 'vitest'
import { registerMemoryApi } from '../src/memory-api.ts'

describe('registerMemoryApi 路由注册', () => {
  it('把全部预期路由注册到宿主（不得自递归吞掉）', () => {
    const registered: Array<{ kind: string; path: string }> = []
    const web = { register: vi.fn((route: { kind: string; path: string; handler: (req: unknown, res: unknown) => void }) => { registered.push({ kind: route.kind, path: route.path }) }) }
    expect(() => registerMemoryApi(web)).not.toThrow()
    const paths = registered.map(r => r.path)
    expect(registered.length).toBeGreaterThanOrEqual(6)
    for (const p of ['/dsh-memory', '/dsh-memory/token', '/dsh-memory/entries', '/dsh-memory/clear', '/dsh-memory/entries/update', '/dsh-memory/entries/delete']) {
      expect(paths, `缺少路由 ${p}`).toContain(p)
    }
    expect(registered.every(r => r.kind === 'exact')).toBe(true)
  })

  it('包装器对带跨域 Origin 的请求返回 403，同源/无 Origin 放行', async () => {
    const handlerCalls: Array<unknown> = []
    let captured: { path: string; handler: (req: unknown, res: unknown) => void | Promise<void> } | undefined
    const web = { register: vi.fn((route: { kind: string; path: string; handler: (req: unknown, res: unknown) => void | Promise<void> }) => { if (route.path === '/dsh-memory/entries') captured = route }) }
    registerMemoryApi(web)
    expect(captured).toBeDefined()
    const json = (body: unknown) => JSON.stringify(body)
    const mkRes = () => { const chunks: string[] = []; let status = 0; return { res: { writeHead: (s: number) => { status = s }, end: (b?: string) => { chunks.push(b ?? '') } } as unknown, text: () => chunks.join(''), status: () => status, json } }
    // 跨域 Origin → 403，handler 不执行
    const cross = mkRes()
    await captured!.handler({ headers: { origin: 'http://evil.example', host: '127.0.0.1:63306' }, method: 'GET' }, cross.res)
    expect(cross.status()).toBe(403)
    // 无 Origin（宿主内调用）→ 放行进 handler
    const same = mkRes()
    await captured!.handler({ headers: {}, method: 'GET' }, same.res)
    expect(String(same.text())).toContain('"ok":true')
    expect(handlerCalls.length).toBe(0)
  })
})
