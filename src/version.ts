/** 构建时由 esbuild 从 package.json 注入的版本号 */
declare const __YL_CODE_VERSION__: string | undefined;

/** 当前 CLI 版本；测试环境未注入时使用开发版本标识 */
export const APP_VERSION =
  typeof __YL_CODE_VERSION__ === "string"
    ? __YL_CODE_VERSION__
    : "0.0.0-dev";
