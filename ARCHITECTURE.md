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
│   ├── agent-helpers.ts           ← 纯辅助函数（格式化、解析、状态文案等）
│   ├── tools.ts                   ← createTools 工厂：读/写/执行/列目录
│   ├── config.ts                  ← ConfigManager：模型配置 CRUD + 持久化 + 事件
│   ├── message-bus.ts             ← MessageBus：消息列表管理 + 事件
│   ├── confirm-bus.ts             ← ConfirmBus：确认流程（Promise + skip + 计时）
│   ├── process-manager.ts         ← ProcessManager：后台进程注册 + 清理
│   ├── commands.ts                ← 斜杠命令注册表
│   ├── history.ts                 ← 命令历史持久化（读/写/添加）
│   ├── file-scanner.ts            ← 文件扫描 + @引用解析
│   ├── diff-generator.ts          ← diff 算法（LCS 行级对比）
│   ├── editor-detector.ts         ← 编辑器检测 + diff 视图启动
│   └── system.md                  ← AI System Prompt 模板
│
├── cli/                           ← CLI 前端（Ink/React TUI），纯视图交互
│   ├── index.ts                   ← 入口：new Agent() → render(App)
│   ├── App.tsx                    ← 主组件：从 agent 解构子系统，路由视图
│   │
│   ├── hooks/                     ← 薄订阅层：core 事件 → React state
│   │   ├── useMessages.ts         ← 订阅 MessageBus → messages + thinkingStatus
│   │   ├── useDiffConfirm.ts      ← 订阅 ConfirmBus → 确认弹窗状态
│   │   └── useHistory.ts          ← 命令历史导航
│   │
│   └── components/                ← 所有 UI 组件
│       ├── MessageList.tsx        ← 消息列表
│       ├── InputBox.tsx           ← 输入框
│       ├── StatusBar.tsx          ← 状态栏（思考中/工具调用）
│       ├── CommandSuggestions.tsx  ← 斜杠命令补全列表
│       ├── ConfirmDialog.tsx      ← 通用确认对话框
│       ├── DiffConfirm.tsx        ← 文件变更 diff 确认
│       ├── FileSuggestions.tsx     ← @文件引用补全列表
│       ├── ModelSelector.tsx      ← 模型管理主界面
│       └── ModelForm.tsx          ← 模型配置表单
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
  ├── executeCommand(cmd)         → 执行斜杠命令，返回 CommandAction
  ├── switchModel(model)          → 切换模型并发送提示消息
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
  const { messages } = useMessages(messageBus);
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

## 多端接入指南

`core/` 是完全平台无关的，接入新端只需实现视图层。

### 新端需要实现的内容

| 职责 | 说明 | CLI 参考 |
|---|---|---|
| **入口** | 创建 `new Agent()`，启动渲染 | `cli/index.ts` |
| **消息渲染** | 订阅 `messageBus` 的 `message`、`message:update`、`thinking`、`clear` 事件 | `hooks/useMessages.ts` |
| **确认交互** | 订阅 `confirmBus` 的 `pending-change` 事件，展示 diff，调用 `resolveChange()` | `hooks/useDiffConfirm.ts` |
| **配置管理 UI** | 调用 `agent.config` 的 CRUD 方法展示模型列表 | `components/ModelSelector.tsx` |
| **命令输入** | 获取 `core/commands.ts` 的命令列表，实现输入和补全 | `components/CommandSuggestions.tsx` |
| **文件引用** | 调用 `core/file-scanner.ts` 的扫描/解析函数 | `components/FileSuggestions.tsx` |
| **历史记录** | 调用 `core/history.ts` 的读写函数 | `hooks/useHistory.ts` |
| **进程清理** | 监听退出信号，调用 `agent.cleanup()` | `cli/index.ts` |

### 新端不需要实现的内容

以下由 `core/` 自动处理，新端无需关心：

- 对话循环与工具调用 (`agent.run()`)
- 流式模型调用 (`streamResponse`)
- 文件读写 / 命令执行工具 (`tools.ts`)
- 确认流程的 Promise 阻塞与超时 (`confirmBus`)
- 后台进程管理 (`processManager`)
- 欢迎消息 (Agent 构造函数自动发送)

### 示例：VSCode 插件接入

```typescript
import { Agent } from "niu-code/core/agent";
import * as vscode from "vscode";

const agent = new Agent();

// 消息 → Webview
agent.messageBus.on("message", (msg) => {
  panel.webview.postMessage({ type: "message", data: msg });
});

// 确认 → 弹窗
agent.confirmBus.on("pending-change", (change) => {
  const choice = await vscode.window.showWarningMessage(
    `确认写入 ${change.filePath}？`, "确认", "拒绝"
  );
  agent.confirmBus.resolveChange(change.id, {
    confirmed: choice === "确认"
  });
});

// 用户输入 → agent
panel.webview.onDidReceiveMessage((msg) => {
  if (msg.type === "query") agent.run(msg.text);
});
```

## 依赖方向

```
core/types.ts           ← 被所有 core 模块引用
core/*.ts               ← 互相独立，只引用 types
core/agent.ts           ← 组合所有 core 模块

cli/hooks/*             ← 引用 core（订阅事件）
cli/components/*        ← 引用 core（类型） + hooks
cli/App.tsx             ← 引用 hooks + components
cli/index.ts            ← 引用 Agent + App
```

关键约束：**core 永远不 import cli 的任何内容**。
