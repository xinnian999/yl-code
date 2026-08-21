import { describe, expect, it } from "vitest";
import { MAX_OUTPUT_TOKENS, normalizeProxyPath } from "./constants.ts";
import { validateContentLength, validatePayload } from "./validation.ts";

describe("validateContentLength", () => {
  it("接受边界内的请求体", () => {
    const request = new Request("https://api.elin521.cn/v1/chat/completions", {
      method: "POST",
      headers: { "content-length": "128" },
    });
    expect(validateContentLength(request)).toBeNull();
  });

  it("拒绝缺少长度的请求", () => {
    const request = new Request("https://api.elin521.cn/v1/chat/completions", {
      method: "POST",
    });
    expect(validateContentLength(request)).toMatchObject({
      ok: false,
      status: 411,
    });
  });
});

describe("normalizeProxyPath", () => {
  it("移除根域模型代理前缀", () => {
    expect(normalizeProxyPath("/api/yl-code/v1/chat/completions"))
      .toBe("/v1/chat/completions");
  });

  it("保留独立子域名路径", () => {
    expect(normalizeProxyPath("/v1/chat/completions"))
      .toBe("/v1/chat/completions");
  });
});

describe("validatePayload", () => {
  it("接受白名单模型", () => {
    expect(validatePayload({ model: "qwen3-coder-next", messages: [] })).toMatchObject({
      ok: true,
    });
  });

  it("拒绝非白名单模型", () => {
    expect(validatePayload({ model: "other-model" })).toMatchObject({
      ok: false,
      code: "model_not_allowed",
    });
  });

  it("拒绝超出输出上限的请求", () => {
    expect(validatePayload({
      model: "qwen3.5-plus",
      max_tokens: MAX_OUTPUT_TOKENS + 1,
    })).toMatchObject({
      ok: false,
      code: "max_tokens_exceeded",
    });
  });
});
