# dsh-memory（@dsh-extra/dsh-memory）
DSH（DeepSeek Harness）套件的跨会话共享记忆插件：JSON 文件记忆库，scope+participants 三级可见性，v2 起带认识论治理（六类陈述类型/来源归因/授权/验证/替代链/归档区）与按回合装配审计回执，v2.2 起带记忆自动驾驶（读侧按轮自动装配注入/写侧对话复盘沉淀/审批留痕，不依赖模型自觉）；经 cordis 服务、模型工具、HTTP 管理面与浏览器 Tab 四个面对套件其他仓提供能力。

## src/ 结构
- index.ts — 入口：provide 'dsh-memory' 服务（含 autopilotReviewNow）、过期清理定时器、注入 webServer 注册 HTTP 路由
- memory-store.ts — 核心存储：文件锁+原子写、认识论字段、替代链/归档区/关系轨/开环、旧路径迁移、检索切词（splitKeywords/searchMemoriesByKeywords）
- memory-tools.ts — memory_write/read/update/delete 工具定义与注册、系统提示词记忆摘要、挂载即登记会话视角（实现在 memory-viewer.ts，此处再导出）
- memory-viewer.ts — 会话视角登记叶子模块（viewerByCtx WeakMap，自动驾驶身份来源；零依赖——CI 依赖卫生守卫锁定，不得引入 @deepseek-ai/* 值导入）
- memory-autopilot.ts — 记忆自动驾驶（v2.2）：写侧对话复盘沉淀（agent/status idle 去抖 + 周期兜底 + 宿主 llm 提取 + 判重落库）+ 审批留痕（approval/request 观察者，透传不改裁决）+ autopilot.json 配置 + 读侧装配段回调 renderMemorySection 与全门链追踪（mount-trace.log）；段注册在 tools.ts 挂载点（自洽）；身份未登记 fail-closed 跳过
- memory-assemble.ts — assembleMemoryPack 装配+审计回执落盘、assemble/openloop 路由、回执 90 天清理（多关键词评分检索路径；关键词路径取「命中数降序头部」，禁改尾部切片）
- memory-api.ts — HTTP 管理面路由（x-memory-token 门禁 + Origin 同源校验）
- memory-admin-page.ts — GET /dsh-memory 治理视图管理页（内联 HTML/JS）
- tools.ts — agent preset 入口（@dsh-extra/dsh-memory/tools），按主人身份注册工具 + **挂载点注册 memory-pack 按轮装配段**（inject=['tools','systemPrompt']，自洽——禁止 app 层注入 per-agent 服务）+ claimed 捕获兜底与身份自愈（master）+ mount-trace.log 落盘
- time-format.ts — ISO(UTC)→本地时区展示文本
- types.d.ts — 宿主模块类型声明桩（独立编译用）
- client/ — 浏览器端「记忆」Tab/侧边栏面板（index.ts + MemoryView.tsx）+ 插件页配置区（AutopilotConfigForm.tsx，plugins.bundle.config：记忆自动驾驶 11 项开关与预算）
- tests/ — vitest 单测（store/api/time-format/autopilot）+ 手动冒烟脚本（smoke-v2/v21.mjs）
- docs/决策记忆治理-设计.md — v2 认识论治理设计（移植自 Decision Assistant）
- cordis.patch.yml — bundle 补丁：无硬注入、声明 provide 提早加载

## .knowledge/ 索引
- role.yaml — 本服务在套件中的角色与能力清单（带回源）
- interfaces.yaml — cordis 服务/模型工具/HTTP 路由/客户端面板对外接口
- dependencies.yaml — 消费的宿主服务与包，及消费方兄弟仓调用点
- constraints.yaml — 生命周期状态机、红线、测试入口与兼容性注记

## 状态语义
status: 待审核 = 未经主人确认，引用前请自行回源 sources。

## 红线
改动前先读 E:\Development\Code\nodejs\digital-twin\docs\suite-charter.md（套件宪章）。

## 构建与测试（package.json scripts）
- npm run build — tsc -b tsconfig.json
- npm run build:client — node scripts/build-client.mjs
- npm test — vitest run
