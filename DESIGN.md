# dsh-memory 共享记忆插件设计文档

## 一、核心原则

1. **主人能知一切**：所有访客的对话记录，主人都能读到
2. **访客互相隔离**：访客之间不能读到对方的记录
3. **当事人可知**：如果一条记录涉及某些人（被拉入日程的参与者），这些人也能读到
4. **默认不公开**：无论主人还是访客，写入的内容默认不公开，除非明确说"公开"

## 二、权限模型

### scope 定义

| scope | 含义 | 谁可读 |
|-------|------|--------|
| `master` | 仅主人可见 | 主人 + participants |
| `self` | 当事人范围（访客写入默认） | 主人 + 记录的作者 + participants |
| `public` | 所有人可见 | 任何人 |

### 扩展规则

`participants` 在 `master` 和 `self` 两种 scope 下均生效：当事人（participants 列表中的用户）可读。

身份约束：访客写入不允许使用 `master` scope，传入时统一回落为 `self`；`memory_update` / `memory_delete` 工具仅注册给主人。

### 实际场景

```
主人创建日程，拉了 sysadmin 和 hz23058321
  → memory_write({ scope: "master", participants: [sysadmin_ID, hz23058321_ID] })
  → sysadmin 问 → 可读（他是当事人）
  → hz23058321 问 → 可读（他是当事人）
  → 其他人问 → 不可读

访客A 跟分身聊天
  → memory_write({ scope: "self", author: "访客A_ID" })
  → 主人问 → 可读（主人能知一切）
  → 访客A 问 → 可读（当事人）
  → 访客B 问 → 不可读
```

## 三、数据存储

### 存储位置

```
~/.dsh/im-channel/credentials/shared-memory.json
```

### 数据结构

```typescript
interface MemoryEntry {
  id: string
  timestamp: string
  type: string           // schedule_created | todo_created | decision | note | conversation_summary
  content: string        // 记忆内容
  author: string         // 写入者的 userid
  authorRole: 'master' | 'guest'  // 写入者身份
  scope: 'master' | 'self' | 'public'
  participants?: string[]  // 关联当事人 userid 列表
  refId?: string          // 关联外部 ID（如日程 ID）
}
```

### 并发控制

所有读-改-写操作（新增/更新/删除/清除/过期清理）都在文件锁（`shared-memory.json.lock`）内完成整个事务，避免并发写入覆盖或丢失更新；写入采用先写临时文件再原子重命名的方式，防止写入中断导致文件损坏。锁细节：

- 异步自旋重试（50ms 间隔、总超时 5s），不阻塞事件循环
- 锁文件超过 15s 视为持有者崩溃残留，直接接管，避免永久死锁
- 损坏的 JSON 文件会被重命名备份为 `.corrupt-<时间戳>`，历史可人工恢复，避免下一次写入静默覆盖
- 最多保留 500 条记忆（超出时淘汰最旧）

## 四、DSH 工具

### memory_write（写入记忆）

```typescript
memory_write({
  content: string,       // 记忆内容
  type?: string,         // 类型，默认 "note"
  scope?: string,        // 默认：主人→"master"，访客→"self"
  participants?: string[], // 关联当事人 userid 列表
})
```

### memory_read（读取记忆）

```typescript
memory_read({
  keywords?: string,      // 搜索关键词
  limit?: number,         // 返回条数上限，默认 20
})
// 后端自动按当前用户身份过滤权限
```

## 五、系统提示词注入

每次对话开始时，不注入具体记忆内容，只注入真实的元信息（条数、类型分布、最近写入时间，不声称“相关”）：

```
【共享记忆】你共有 3 条共享记忆（note×2、schedule_created×1；最近一条写入于 2026-08-23 09:00:00）。请使用 memory_read 工具查看。
```

实际记忆检索通过 `memory_read` 工具触发，后端做权限过滤。

## 六、与访客权限系统的集成

在 GuestPermissionsPanel 中增加两条控制项：

| 工具 | 默认 | 说明 |
|------|------|------|
| `memory_read` | ✅ 允许 | 访客可以读取自己有权限的记忆 |
| `memory_write` | ❌ 禁止 | 访客默认不能写入记忆，主人可开启 |

## 七、实现路线图

### Phase 1（当前）

- 独立插件 `dsh-memory`
- 基本存储（事务性文件锁 + 原子写入）
- `memory_write` / `memory_read` / `memory_update` / `memory_delete` 工具
- 权限过滤（按 scope + participants + author）
- 系统提示词元信息注入
- HTTP API 路由（写操作由随机 token 门禁，兼具 CSRF 防护）
- 过期记忆自动清理（插件加载时 + 定期）

### Phase 2（后续）

- 访客权限面板集成
- API 层用户级鉴权与读端点权限过滤（依赖 DSH webServer 提供会话身份）
- 记忆去重/整合、检索质量升级

## 八、目录结构

```
dsh-memory/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts           # 插件入口
│   ├── memory-store.ts    # 核心存储
│   ├── memory-tools.ts    # DSH ToolDefinition
│   └── memory-api.ts      # HTTP API
```