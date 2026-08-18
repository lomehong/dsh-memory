# dsh-memory — 共享记忆插件

为 DSH (DeepSeek Harness) 提供跨会话共享记忆能力。所有 agent 实例（主人和访客）可以读写同一份记忆，实现会话隔离、记忆共享。

## 功能特性

- **跨会话共享记忆** — 主人和访客各有独立会话，但记忆互通
- **细粒度权限控制** — 三级 scope + 参与者机制，保护隐私
- **DSH 工具集成** — 提供 `memory_read` / `memory_write` / `memory_update` / `memory_delete` 四个工具
- **记忆过期机制** — 支持设置过期时间，自动清理过期记忆
- **Web 管理页面** — 浏览器访问 `/dsh-memory` 管理记忆
- **对话 Tab 集成** — 在 DSH 对话区域添加「记忆」Tab（第三个 Tab）

## 权限模型

### 三级 scope

| scope | 含义 | 谁可读 |
|-------|------|--------|
| `master` | 仅主人可见 | 仅主人 |
| `self` | 仅主人 + 当事人 | 主人 + 记录的作者（如果访客写入） |
| `public` | 所有人可见 | 任何人 |

### 扩展规则

当 `scope` 为 `master` 且 `participants` 非空时，当事人（participants 列表中的用户）也可读。

### 默认行为

- 主人写入 → 默认 `scope: master`（仅主人可见）
- 访客写入 → 默认 `scope: self`（主人 + 该访客可见）
- 写入时传 `participants` 参数可将当事人加入可见列表

### 实际场景示例

```
主人创建日程，拉了 sysadmin 和 hz23058321
  → memory_write({ content: "下午3点复盘会", participants: [sysadmin_ID, hz23058321_ID] })
  → sysadmin 问："今天下午有什么安排" → 可读（他是当事人）
  → hz23058321 问："今天下午有什么安排" → 可读（他也是当事人）
  → 其他人问 → 不可读
```

## 架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  主人会话    │     │ 访客A会话   │     │ 访客B会话   │
│  (独立)      │     │  (独立)     │     │  (独立)     │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │ 读写              │ 只读              │ 只读
       ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────┐
│              共享记忆 (shared-memory.json)           │
│  ~/.dsh/im-channel/credentials/shared-memory.json    │
└─────────────────────────────────────────────────────┘
```

## DSH 工具

### memory_write — 写入记忆

```typescript
memory_write({
  content: string,          // 记忆内容
  type?: string,            // 类型：schedule_created/todo_created/decision/note
  scope?: string,           // 可见范围：master/self/public
  participants?: string[],  // 关联当事人 userid 列表（重要：涉及其他人时务必传入）
})
```

### memory_read — 读取记忆

```typescript
memory_read({
  keywords?: string,  // 搜索关键词
  limit?: number,     // 返回条数上限（默认 20，最大 50）
})
```

### memory_update — 更新记忆（仅主人）

```typescript
memory_update({
  id: string,                // 要更新的记忆 ID
  content?: string,          // 新内容
  scope?: string,            // 新范围
  participants?: string[],   // 新参与者列表
})
```

### memory_delete — 删除记忆（仅主人）

```typescript
memory_delete({
  id: string,  // 要删除的记忆 ID
})
```

## API 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/dsh-memory` | 管理页面 |
| GET | `/dsh-memory/entries` | 获取所有记忆 |
| POST | `/dsh-memory/entries` | 添加记忆 |
| POST | `/dsh-memory/entries/update` | 更新记忆 |
| POST | `/dsh-memory/entries/delete` | 删除记忆 |
| POST | `/dsh-memory/clear` | 清除所有记忆 |
| POST | `/dsh-memory/prune` | 清除过期记忆 |

## 安装

### 前置条件

- DSH (DeepSeek Harness) 已安装
- Node.js >= 20

### 1. 构建

```bash
# 安装依赖
cd packages/dsh-memory
npm install --no-save typescript@5.9.3 @types/node@20.0.0 esbuild@0.25.0 react@18.2.0 @types/react@18.3.1

# 构建服务端代码
npx tsc -b tsconfig.json

# 构建客户端代码（对话 Tab）
node scripts/build-client.mjs
```

### 2. 同步到 DSH profile

```bash
# 复制到 DSH web profile
Copy-Item "lib\*" "C:\Users\hz0703021\.dsh\profiles\web\node_modules\@dsh-extra\dsh-memory\lib\" -Recurse -Force
Copy-Item "package.json" "C:\Users\hz0703021\.dsh\profiles\web\node_modules\@dsh-extra\dsh-memory\" -Force
```

### 3. 注册到 DSH

在 DSH profile 的 `package.json` 中添加：

```json
{
  "dependencies": {
    "@dsh-extra/dsh-memory": "file:path/to/dsh-memory"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@dsh-extra/dsh-memory"
      ]
    }
  }
}
```

### 4. 重启 DSH

```bash
dsh web
```

## 开发

```bash
# 构建服务端
cd packages/dsh-memory
npx tsc -b tsconfig.json

# 构建客户端
node scripts/build-client.mjs

# 同步到 profile
Copy-Item "lib\*" "C:\Users\hz0703021\.dsh\profiles\web\node_modules\@dsh-extra\dsh-memory\lib\" -Recurse -Force
Copy-Item "package.json" "C:\Users\hz0703021\.dsh\profiles\web\node_modules\@dsh-extra\dsh-memory\" -Force
```

## 与 im-channel 的集成

本插件与 `@dsh-extra/im-channel` 独立运行，通过 DSH 的 service 机制协作：

1. dsh-memory 注册服务 `dsh-memory` 到 Cordis 上下文
2. im-channel 的 driver 在创建 agent 时检查 `ctx.get('dsh-memory')` 是否存在
3. 如果存在，调用 `registerMemoryTools()` 注册工具，并注入记忆摘要到系统提示词

两个插件完全解耦：im-channel 不依赖 dsh-memory，dsh-memory 不依赖 im-channel。

## 数据存储

记忆存储在 JSON 文件中：

```
~/.dsh/im-channel/credentials/shared-memory.json
```

### 数据格式

```json
{
  "entries": [
    {
      "id": "mem_1744960000000_abc123",
      "timestamp": "2026-08-18T09:00:00.000Z",
      "type": "schedule_created",
      "content": "下午3点信息安全事件复盘会，参与人：sysadmin",
      "author": "wofFcnBwAA...",
      "authorRole": "master",
      "scope": "master",
      "participants": ["wofFcnBwAA1Pk2..."],
      "expireAt": "2026-08-19T09:00:00.000Z"
    }
  ]
}
```

### 并发控制

使用自旋文件锁（`shared-memory.json.lock`）避免并发写入覆盖。写入采用先写临时文件再原子重命名的方式，防止写入中断导致文件损坏。最多保留 500 条记忆。

## 许可

MIT