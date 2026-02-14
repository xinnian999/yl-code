# 牛码 架构文档

## 总览

```
core = 全部功能逻辑（Agent 持有一切：消息、确认、配置、进程、工具）
cli  = 纯视图交互（React 组件 + hooks 订阅 Agent 内部事件）
```

外部只需 `new Agent()`，一个对象包含全部能力。

## 目录结构

```
src/
├── core/                          ← 功能核心，零 UI 依赖
│   ├── types.ts                   ← 端口接口 + 共享类型
│   ├── agent.ts                   ← Agent 类：持有所有子系统，驱动对话循环
│   ├── agent-helpers.ts           ← 纯辅助函数（格式化、解析等）
│   ├── tools.ts                   ← createTools 工厂：读/写/执行/列目录
│   ├── config.ts                  ← ConfigManager：模型配置 CRUD + 持久化 + 事件
│   ├── message-bus.ts             ← MessageBus：消息列表管理 + 事件
│   ├── confirm-bus.ts             ← ConfirmBus：确认流程（Promise + skip + 计时）
│   ├── process-manager.ts         ← ProcessManager：后台进程注册 + 清理
│   └── system.md                  ← AI System Prompt 模板
│
├── cli/                           ← CLI 前端（Ink/React TUI），纯视图交互
│   ├── index.ts                   ← 入口：new Agent() → render(App)
│   ├── App.tsx                    ← 主组件：从 agent 解构子系统，路由视图
│   ├── commands.ts                ← 斜杠命令定义
│   │
│   ├── hooks/                     ← 薄订阅层：core 事件 → React state
│   │   ├── useMessages.ts         ← 订阅 MessageBus → messages + thinkingStatus
│   │   ├── useDiffConfirm.ts      ← 订阅 ConfirmBus → 确认弹窗状态
│   │   └── useHistory.ts          ← 命令历史导航
│   │
│   ├── features/                  ← 按功能聚合（组件 + 工具在一起）
│   │   ├── diff/                  ← diff 确认功能
│   │   ├── model/                 ← 模型管理功能
│   │   ├── file-picker/           ← @文件引用功能
│   │   └── history/               ← 历史记录
│   │
│   └── components/                ← 通用 UI 组件
│       ├── MessageList.tsx
│       ├── InputBox.tsx
│       ├── StatusBar.tsx
│       ├── CommandSuggestions.tsx
│       └── ConfirmDialog.tsx
```

## Agent 内部结构

```
Agent
  ├── messageBus: MessageBus      (readonly，UI 订阅消息事件)
  ├── confirmBus: ConfirmBus      (readonly，UI 订阅确认事件)
  ├── config: ConfigManager       (readonly，UI 读写模型配置)
  ├── processManager              (private，内部管理后台进程)
  ├── tools                       (private，LLM 可调用的工具集)
  │
  ├── run(query, fileContext?)     → 发起对话，返回 AI 回复
  ├── clearMemory()               → 清空对话历史
  ├── cleanup()                   → 清理后台进程并退出
  └── dispose()                   → 取消事件监听
```

## 数据流

### 用户发送消息 → AI 回复

```
用户输入
  │
  ▼
App.tsx handleSubmit()
  │
  ├─ agent.messageBus.user(text)         ← 消息入列 + 事件通知
  │
  ▼
agent.run(query, fileContext)             ← 进入 core
  │
  ├─ messageBus.setThinkingStatus(THINKING)
  ▼
LLM 流式请求
  │
  ├─ 有 tool_calls? ──是──→ executeToolCalls() ──→ 继续循环
  │                                │
  │                                ├─ 写文件 → confirmBus.requestConfirm()
  │                                │              ↕ 用户确认/拒绝
  │                                │
  │                                └─ 执行命令 → confirmBus.requestCommandConfirm()
  │                                               ↕ 用户确认/拒绝
  │
  └─ 无 tool_calls ──→ messageBus.ai(最终回复) ──→ 结束
```

### 文件写入确认流

```
tools.ts writeFileTool
  │
  ▼
confirmBus.requestConfirm(path, old, new)   ← 返回 Promise
  │
  ├─ emit("pending-change")
  ▼
useDiffConfirm hook 监听                     ← React 更新状态
  ▼
DiffConfirm.tsx 渲染 diff                    ← 用户看到变更，按 y/n/a
  ▼
confirmBus.resolveChange(id, result)         ← Promise resolve → tool 继续
```

## 使用方式

### CLI（当前实现）

```typescript
// cli/index.ts — 就这么简单
const agent = new Agent();
render(React.createElement(App, { agent }));
```

```typescript
// App.tsx — 从 agent 解构所需子系统
const App = ({ agent }) => {
  const { messageBus, confirmBus, config } = agent;
  const { messages } = useMessages(messageBus, welcomeMessage);
  const { showDiffConfirm, ... } = useDiffConfirm(confirmBus);
  // ...
};
```

### 接入新前端（如 Web）

```typescript
const agent = new Agent();

// 订阅事件，用你的框架渲染
agent.messageBus.on("message", (msg) => renderMessage(msg));
agent.confirmBus.on("pending-change", (change) => showConfirmDialog(change));

await agent.run(userInput);
```

一个 `new Agent()`，全部能力到手。

## 依赖方向

```
core/types.ts           ← 被所有 core 模块引用
core/*.ts               ← 互相独立，只引用 types
core/agent.ts           ← 组合所有 core 模块

cli/hooks/*             ← 引用 core（订阅事件）
cli/features/*          ← 引用 core（类型）
cli/App.tsx             ← 引用 hooks + components + features
cli/index.ts            ← 引用 Agent + App
```

关键约束：**core 永远不 import cli 的任何内容**。
