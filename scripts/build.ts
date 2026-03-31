import { build } from "bun";
import { join } from "path";
import { copyFileSync, cpSync, mkdirSync, readFileSync, writeFileSync } from "fs";

const root = join(import.meta.dir, "..");
const stubPath = join(root, "scripts", "stub-devtools.js");

// 构建时将内置变量内联到 bundle，避免发布后找不到 .env
const BUILTIN_API_KEY = process.env.BUILTIN_API_KEY ?? "";
const BUILTIN_BASE_URL = process.env.BUILTIN_BASE_URL ?? "";

if (!BUILTIN_API_KEY || !BUILTIN_BASE_URL) {
  console.warn("⚠️  BUILTIN_API_KEY 或 BUILTIN_BASE_URL 未设置，内置模型将不可用");
}

const result = await build({
  entrypoints: [join(root, "src", "cli", "index.ts")],
  outdir: join(root, "dist"),
  target: "node",
  // 构建时将 process.env.BUILTIN_* 替换为字面量，发布后无需 .env 文件
  define: {
    "process.env.BUILTIN_API_KEY": JSON.stringify(BUILTIN_API_KEY),
    "process.env.BUILTIN_BASE_URL": JSON.stringify(BUILTIN_BASE_URL),
  },
  plugins: [
    {
      name: "stub-devtools",
      setup(builder) {
        builder.onResolve({ filter: /^react-devtools-core$/ }, () => ({
          path: stubPath,
        }));
      },
    },
  ],
});

if (!result.success) {
  console.error(result.logs);
  process.exit(1);
}

// fix shebang for Node
const distPath = join(root, "dist", "index.js");
let s = readFileSync(distPath, "utf8");
s = s.replace(/^#!\/usr\/bin\/env bun/, "#!/usr/bin/env node");
writeFileSync(distPath, s);

// 运行时需要 system.md（agent/helpers.ts 会相对 bundle 位置读取）
copyFileSync(
  join(root, "src", "core", "agent", "system.md"),
  join(root, "dist", "system.md")
);

// 运行时需要内置 skills 资源与锁文件
cpSync(
  join(root, ".agents", "skills"),
  join(root, "dist", "builtin-skills"),
  { recursive: true },
);
copyFileSync(
  join(root, "skills-lock.json"),
  join(root, "dist", "skills-lock.json"),
);

// cfonts 在打包后会通过 require('../fonts/*.json') 查找字体文件（相对 dist/index.js 解析为项目根目录 fonts/）
const cfontsDir = join(root, "node_modules", "cfonts", "fonts");
const fontsDestDir = join(root, "fonts");
mkdirSync(fontsDestDir, { recursive: true });
cpSync(cfontsDir, fontsDestDir, { recursive: true });

console.log("Build done. Shebang set to node, system.md copied.");
