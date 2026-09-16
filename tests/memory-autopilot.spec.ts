/**
 * 记忆自动驾驶（v2.2）单元测试：
 * 切词检索、装配渲染预算、提取解析、判重、审批映射、配置合并，
 * 以及 reviewWindow 全链路（mock 宿主 llm，DSH_HOME 隔离临时目录）。
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let home = ''
let dshHome = ''
const tempDirs: string[] = []

vi.mock('node:os', async importOriginal => {
  const actual = await importOriginal<typeof import('node:os')>()
  return { ...actual, homedir: () => home }
})

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'dsh-ap-home-'))
  dshHome = mkdtempSync(join(tmpdir(), 'dsh-ap-state-'))
  process.env.DSH_HOME = dshHome
})

afterEach(() => {
  delete process.env.DSH_HOME
  for (const dir of tempDirs.splice(0).reverse()) {
    try { rmSync(dir, { recursive: true, force: true }) } catch { /* Windows 锁由系统清理 */ }
  }
})

describe('splitKeywords 切词', () => {
  it('拉丁词元整体保留、CJK 短段整段、长段切 2-gram、停用词过滤、去重截断', async () => {
    const { splitKeywords } = await import('../src/memory-store.ts')
    const kws = splitKeywords('帮我查一下 Q3 发布会安排，发布会定在 3月1日', 8)
    expect(kws).toContain('q3')
    // 长 CJK 段按 2-gram 切分：发布/布会 两个词元都应存在（检索靠多词命中计分）
    expect(kws).toContain('发布')
    expect(kws).toContain('布会')
    expect(kws).not.toContain('帮我')
    expect(kws.length).toBeLessThanOrEqual(8)
    // 长 CJK 段产出 2-gram
    const longRun = splitKeywords('信息安全事件复盘会议纪要', 32)
    expect(longRun).toContain('信息')
    expect(longRun).toContain('安全')
    // 空输入
    expect(splitKeywords('')).toEqual([])
    expect(splitKeywords('   ')).toEqual([])
  })

  it('全停用词输入切不出关键词', async () => {
    const { splitKeywords } = await import('../src/memory-store.ts')
    expect(splitKeywords('我们 就是 应该 the and')).toEqual([])
  })
})

describe('searchMemoriesByKeywords 评分检索', () => {
  it('OR 命中，命中数多的排前；零命中不返回', async () => {
    const { searchMemoriesByKeywords } = await import('../src/memory-store.ts')
    const base = { id: 'x', timestamp: '2026-09-05T00:00:00.000Z', type: 'note', author: 'm', authorRole: 'master' as const, scope: 'master' as const }
    const entries = [
      { ...base, id: '1', content: 'Q3 发布会定在 3月1日' },
      { ...base, id: '2', content: '发布会物料清单待整理' },
      { ...base, id: '3', content: '与记忆无关的内容', timestamp: '2026-09-06T00:00:00.000Z' },
    ]
    const out = searchMemoriesByKeywords(entries, ['发布会', 'q3'])
    expect(out.map(e => e.id)).toEqual(['1', '2'])
  })
})

describe('renderPackText 装配渲染', () => {
  it('条目截断 160 字；预算装不下整段返回空串；正常渲染带视角标注', async () => {
    const { renderPackText } = await import('../src/memory-autopilot.ts')
    const items = [{ statementType: '事实', content: '短记忆' }, { statementType: '候选', content: 'x'.repeat(300) }]
    const text = renderPackText(items, { isMaster: true, budgetBytes: 1600 })
    expect(text).toContain('【共享记忆自动装配】')
    expect(text).toContain('主人视角')
    expect(text).toContain('• [事实] 短记忆')
    expect(text).toContain('…')
    // 首条装入后超预算下限（CJK 300 字截断后约 500 字节 > 200）→ 空串
    expect(renderPackText([{ statementType: '事实', content: '记'.repeat(300) }], { isMaster: false, budgetBytes: 200 })).toBe('')
  })
})

describe('parseExtraction 提取解析', () => {
  it('解析裸数组、围栏包裹、夹杂解释文本三种形态', async () => {
    const { parseExtraction } = await import('../src/memory-autopilot.ts')
    const bare = '[{"content":"发布会定在3月1日","type":"schedule"}]'
    expect(parseExtraction(bare)).toHaveLength(1)
    expect(parseExtraction(`好的，以下是提取结果：\n\`\`\`json\n${bare}\n\`\`\``)).toHaveLength(1)
    expect(parseExtraction(`结果如下 ${bare} 以上。`)).toHaveLength(1)
  })
  it('非法输出返回空数组；缺 content/超长条目被过滤；type 缺省 note', async () => {
    const { parseExtraction } = await import('../src/memory-autopilot.ts')
    expect(parseExtraction('模型胡言乱语')).toEqual([])
    expect(parseExtraction('{"content":"不是数组"}')).toEqual([])
    expect(parseExtraction('[{"type":"note"}]')).toEqual([])
    expect(parseExtraction(`[{"content":"${'x'.repeat(501)}"}]`)).toEqual([])
    const items = parseExtraction('[{"content":"一条记忆"}]')
    expect(items).toEqual([{ content: '一条记忆', type: 'note' }])
  })
})

describe('isDuplicateContent 判重', () => {
  it('完全相同/容差内包含判重；超出容差不算；过短不判', async () => {
    const { isDuplicateContent } = await import('../src/memory-autopilot.ts')
    const existing = [{ content: '发布会定在 3月1日' }]
    expect(isDuplicateContent('发布会定在3月1日', existing)).toBe(true)
    expect(isDuplicateContent('发布会定在 3月1日，地点待定', existing)).toBe(true) // 容差内
    expect(isDuplicateContent(`发布会定在 3月1日，${'另外还讨论了很多新事项'.repeat(3)}`, existing)).toBe(false)
    expect(isDuplicateContent('短', existing)).toBe(false)
  })
})

describe('renderTranscript 回合窗口', () => {
  it('无助手回复返回 null；超长保留尾部', async () => {
    const { renderTranscript } = await import('../src/memory-autopilot.ts')
    expect(renderTranscript([{ user: '你好', assistant: [] }], 4000)).toBeNull()
    const long = renderTranscript([{ user: 'u'.repeat(5000), assistant: ['a'.repeat(5000)] }], 1000)
    expect(long).not.toBeNull()
    expect(long!.length).toBeLessThan(2000)
    expect(long!).toContain('…（前文略）')
  })
})

describe('approvalMemoryItem 审批映射', () => {
  it('allowed-once/rejected 正确映射；cancelled/unavailable 不留痕', async () => {
    const { approvalMemoryItem } = await import('../src/memory-autopilot.ts')
    const ok = approvalMemoryItem({ toolName: 'pwsh', reason: '  需要执行  清理脚本  ' }, 'allowed-once')
    expect(ok).toEqual({ authStatus: '已授权', content: '批准工具调用 pwsh（原因：需要执行 清理脚本）' })
    const no = approvalMemoryItem({ toolName: 'pwsh' }, 'rejected')
    expect(no).toEqual({ authStatus: '已拒绝', content: '拒绝工具调用 pwsh' })
    expect(approvalMemoryItem({ toolName: 'pwsh' }, 'cancelled')).toBeUndefined()
    expect(approvalMemoryItem({ toolName: 'pwsh' }, 'unavailable')).toBeUndefined()
  })
})

describe('mergeAutopilotConfig 配置合并', () => {
  it('非法类型回落默认、边界夹紧、reviewPeriodicHours 允许 0 关闭', async () => {
    const { mergeAutopilotConfig } = await import('../src/memory-autopilot.ts')
    const merged = mergeAutopilotConfig({ injectLimit: 'many', idleDebounceSec: 1, reviewPeriodicHours: 0, injectBudgetBytes: 999999 })
    expect(merged.injectLimit).toBe(5)
    expect(merged.idleDebounceSec).toBe(10)
    expect(merged.reviewPeriodicHours).toBe(0)
    expect(merged.injectBudgetBytes).toBe(8192)
    expect(mergeAutopilotConfig(null).reviewerEnabled).toBe(true)
    expect(mergeAutopilotConfig({ reviewGuests: true }).reviewGuests).toBe(true)
  })
})

describe('reviewWindow 复盘全链路（mock llm）', () => {
  function windowOf(sessionId: string, isMaster: boolean): import('../src/memory-autopilot.ts').TurnWindow {
    return {
      sessionId,
      agentCtx: null,
      viewer: { userId: isMaster ? 'master' : 'guest-1', isMaster },
      turns: [{ user: '把发布会定在 3月1日，记一下', assistant: ['好的，发布会已定为 3月1日。'] }],
      reviewedTurnCount: 0,
      lastActivityAt: Date.now(),
      reviewing: false,
    }
  }

  it('主人会话：提取成功落「事实」条目并推进 cursor；重复复盘 no-content', async () => {
    const { reviewWindow } = await import('../src/memory-autopilot.ts')
    const { loadSharedMemory } = await import('../src/memory-store.ts')
    const ctx = {
      get(name: string): unknown {
        if (name === 'llm') {
          return {
            stream: async function* () {
              yield { type: 'text-delta', text: '[{"content":"发布会定在 3月1日","type":"schedule"}]' }
            },
          }
        }
        if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'deepseek', model: 'test-model' }) }
        return undefined
      },
    }
    const window = windowOf(`master-${Math.random().toString(36).slice(2, 8)}`, true)
    const outcome = await reviewWindow(ctx, window)
    expect(outcome.reason).toBe('ok')
    expect(outcome.written).toBe(1)
    expect(window.reviewedTurnCount).toBe(1)
    const store = loadSharedMemory()
    const added = store.find(e => e.content.includes('发布会定在 3月1日'))
    expect(added).toBeDefined()
    expect(added!.statementType).toBe('事实')
    expect(added!.scope).toBe('master')
    expect(added!.source?.origin).toBe('conversation')
    expect(added!.source?.ref).toContain('autopilot:')
    // 已消费完毕：再复盘 → no-content
    const again = await reviewWindow(ctx, window)
    expect(again.reason).toBe('no-content')
    expect(again.written).toBe(0)
  })

  it('访客会话默认跳过（保守侧显式降级）', async () => {
    const { reviewWindow } = await import('../src/memory-autopilot.ts')
    const ctx = { get: () => undefined }
    const outcome = await reviewWindow(ctx, windowOf(`guest-${Math.random().toString(36).slice(2, 8)}`, false))
    expect(outcome.reason).toBe('guest-skipped')
    expect(outcome.written).toBe(0)
  })

  it('llm/默认模型缺席 → extract-failed 且不推进 cursor', async () => {
    const { reviewWindow } = await import('../src/memory-autopilot.ts')
    const ctx = { get: () => undefined }
    const window = windowOf(`fail-${Math.random().toString(36).slice(2, 8)}`, true)
    const outcome = await reviewWindow(ctx, window)
    expect(outcome.reason).toBe('extract-failed')
    expect(window.reviewedTurnCount).toBe(0)
  })

  it('判重：既有相同内容不重复落库', async () => {
    const { reviewWindow } = await import('../src/memory-autopilot.ts')
    const { addMemoryEntry, loadSharedMemory } = await import('../src/memory-store.ts')
    await addMemoryEntry({
      content: '发布会定在 3月1日',
      type: 'schedule',
      scope: 'master',
      author: 'master',
      authorRole: 'master',
      statementType: '事实',
      source: { origin: 'human' },
    })
    const ctx = {
      get(name: string): unknown {
        if (name === 'llm') {
          return { stream: async function* () { yield { type: 'text-delta', text: '[{"content":"发布会定在 3月1日","type":"schedule"}]' } } }
        }
        if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'deepseek', model: 'test-model' }) }
        return undefined
      },
    }
    const window = windowOf(`dedup-${Math.random().toString(36).slice(2, 8)}`, true)
    const outcome = await reviewWindow(ctx, window)
    expect(outcome.reason).toBe('ok')
    expect(outcome.written).toBe(0)
    expect(loadSharedMemory().filter(e => e.content.includes('发布会定在 3月1日'))).toHaveLength(1)
  })
})

describe('loadAutopilotConfig 缺省回退', () => {
  it('无配置文件时返回全默认（可用 now 绕过 TTL 缓存）', async () => {
    const { loadAutopilotConfig } = await import('../src/memory-autopilot.ts')
    const config = loadAutopilotConfig(Date.now() + 61_000)
    expect(config.injectPerTurn).toBe(true)
    expect(config.reviewGuests).toBe(false)
    expect(config.approvalMemory).toBe(true)
  })
})

describe('CI 依赖卫生（Release #7 事故回归守卫）', () => {
  it('memory-viewer / memory-autopilot 不得出现 @deepseek-ai/* 值导入（peerDep 在 CI npm ci 后缺席）', async () => {
    const { readFileSync } = await import('node:fs')
    // viewer 是零依赖叶子：整文件不得出现 scoped 宿主包引用（含注释，防止误导）
    const viewerSrc = readFileSync(new URL('../src/memory-viewer.ts', import.meta.url), 'utf8')
    expect(viewerSrc).not.toMatch(/@deepseek-ai\//)
    // autopilot 允许 import type（构建期擦除）；禁止值导入
    const autopilotSrc = readFileSync(new URL('../src/memory-autopilot.ts', import.meta.url), 'utf8')
    expect(autopilotSrc).not.toMatch(/^import (?!type\b).*from '@deepseek-ai\//m)
  })
})
