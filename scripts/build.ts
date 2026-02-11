import { build } from "bun";
import { join } from "path";
import { copyFileSync, readFileSync, writeFileSync } from "fs";

const root = join(import.meta.dir, "..");
const stubPath = join(root, "scripts", "stub-devtools.js");

const result = await build({
  entrypoints: [join(root, "src", "cli", "index.ts")],
  outdir: join(root, "dist"),
  target: "node",
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

// 运行时需要 system.md（run.ts 里用 __dirname 读）
copyFileSync(
  join(root, "src", "core", "system.md"),
  join(root, "dist", "system.md")
);
console.log("Build done. Shebang set to node, system.md copied.");