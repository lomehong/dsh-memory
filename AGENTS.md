# dsh-memory（@dsh-extra/dsh-memory）
DSH（DeepSeek Harness）套件的跨会话共享记忆插件：JSON 文件记忆库，scope+participants 三级可见性，v2 起带认识论治理（六类陈述类型/来源归因/授权/验证/替代链/归档区）与按回合装配审计回执；经 cordis 服务、模型工具、HTTP 管理面与浏览器 Tab 四个面对套件其他仓提供能力。

## src/ 结构
- index.ts — 入口：provide 'dsh-memory' 服务、过期清理定时器、注入 webServer 注册 HTTP 路由
- memory-store.ts — 核心存储：文件锁+原子写、认识论字段、替代链/归档区/关系轨/开环、旧路径迁移
- memory-tools.ts — memory_write/read/update/delete 工具定义与注册、系统提示词记忆摘要
- memory-assemble.ts — assembleMemoryPack 装配+审计回执落盘、assemble/openloop 路由、回执 90 天清理
- memory-api.ts — HTTP 管理面路由（x-memory-token 门禁 + Origin 同源校验）
- memory-admin-page.ts — GET /dsh-memory 治理视图管理页（内联 HTML/JS）
- tools.ts — agent preset 入口（@dsh-extra/dsh-memory/tools），按主人身份注册工具
- time-format.ts — ISO(UTC)→本地时区展示文本
- types.d.ts — 宿主模块类型声明桩（独立编译用）
- client/ — 浏览器端「记忆」Tab/侧边栏面板（index.ts + MemoryView.tsx）
- tests/ — vitest 单测（store/api/time-format）+ 手动冒烟脚本（smoke-v2/v21.mjs）
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
