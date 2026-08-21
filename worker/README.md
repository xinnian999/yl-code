# YL CODE 模型代理

Cloudflare Worker 负责保存上游模型密钥，并为 YL CODE 提供受限的
OpenAI 兼容聊天补全接口。

生产入口为 `https://elin521.cn/api/yl-code/v1`；独立子域名
`https://api.elin521.cn/v1` 作为备用入口保留。

## 开发与验证

```bash
pnpm dev
pnpm typecheck
pnpm test
```

## 部署

首次部署前，以交互方式写入上游密钥：

```bash
pnpm exec wrangler secret put BUILTIN_API_KEY
pnpm deploy
```

不要把真实密钥写入 `wrangler.jsonc`、源码或提交到 Git。
