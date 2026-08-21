import { build } from "esbuild";
import { copyFileSync, cpSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const rootDirectory = join(fileURLToPath(new URL(".", import.meta.url)), "..");

/** 构建可由 Node 直接执行的 CLI 发布产物 */
export async function buildProject() {
  const stubPath = join(rootDirectory, "scripts", "stub-devtools.js");
  const distPath = join(rootDirectory, "dist");

  rmSync(distPath, { recursive: true, force: true });

  await build({
    entryPoints: [join(rootDirectory, "src", "cli", "index.ts")],
    outfile: join(distPath, "index.js"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    banner: {
      js: 'import { createRequire as __nodeCreateRequire } from "node:module"; const require = __nodeCreateRequire(import.meta.url);',
    },
    plugins: [
      {
        name: "stub-devtools",
        setup(buildContext) {
          buildContext.onResolve({ filter: /^react-devtools-core$/ }, () => ({
            path: stubPath,
          }));
        },
      },
    ],
  });

  copyFileSync(
    join(rootDirectory, "src", "core", "agent", "system.md"),
    join(distPath, "system.md"),
  );
  cpSync(
    join(rootDirectory, ".agents", "skills"),
    join(distPath, "builtin-skills"),
    { recursive: true },
  );
  copyFileSync(
    join(rootDirectory, "skills-lock.json"),
    join(distPath, "skills-lock.json"),
  );

  const cfontsDir = join(rootDirectory, "node_modules", "cfonts", "fonts");
  const fontsDestDir = join(rootDirectory, "fonts");
  mkdirSync(fontsDestDir, { recursive: true });
  cpSync(cfontsDir, fontsDestDir, { recursive: true });

  console.log("Build done. Node CLI and runtime assets are ready.");
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  await buildProject();
}
