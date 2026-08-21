# yl-code

终端内 AI 助手 CLI，输入 `yl` 即可召唤使用。

## 安装

```bash
pnpm add --global yl-code
```

## 使用

```bash
yl
```

## 功能

- 🤖 终端内的 AI 对话助手
- 💬 支持 Markdown 渲染
- 🔧 支持 MCP (Model Context Protocol) 扩展
- 📝 内置代码差异对比与确认
- 📜 会话历史记录
- ✅ 任务列表管理

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 类型检查
pnpm typecheck
```

## 免费模型代理

内置免费模型通过 `https://elin521.cn/api/yl-code/v1` 的 Cloudflare Worker 调用，
上游 API Key 仅保存在 Cloudflare Secret 中，不会被打进 CLI 或 npm 包。

```bash
# 校验代理
pnpm worker:typecheck
pnpm worker:test

# 本地开发
pnpm worker:dev

# 部署代理（需提前配置 BUILTIN_API_KEY Secret）
pnpm worker:deploy
```

## 要求

- Node.js >= 20.0.0

## License

ISC
