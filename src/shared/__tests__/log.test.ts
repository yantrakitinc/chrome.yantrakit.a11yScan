import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logError, logWarn, logDebug } from "../log";

describe("logger — logError", () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { errSpy = vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => { errSpy.mockRestore(); });

  it("emits one console.error call with [A11y Scan] prefix + where + message", () => {
    logError("module.fn", "something broke");
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith("[A11y Scan] module.fn: something broke");
  });

  it("when err arg is provided, passes the error object as a second console arg", () => {
    const e = new Error("boom");
    logError("module.fn", "scan failed", e);
    expect(errSpy).toHaveBeenCalledWith("[A11y Scan] module.fn: scan failed", e);
  });

  it("undefined err is treated as 'no err' — no second arg", () => {
    logError("module.fn", "nothing", undefined);
    expect(errSpy).toHaveBeenCalledWith("[A11y Scan] module.fn: nothing");
  });
});

describe("logger — logWarn", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => { warnSpy.mockRestore(); });

  it("emits console.warn with prefix + where + message", () => {
    logWarn("crawl.matchPageRule", "regex parse failed");
    expect(warnSpy).toHaveBeenCalledWith("[A11y Scan] crawl.matchPageRule: regex parse failed");
  });

  it("with err arg, includes it as second console.warn argument", () => {
    const e = new SyntaxError("(unterminated)");
    logWarn("crawl.isUrlGated", "invalid regex", e);
    expect(warnSpy).toHaveBeenCalledWith("[A11y Scan] crawl.isUrlGated: invalid regex", e);
  });
});

describe("logger — logDebug", () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {}); });
  afterEach(() => { debugSpy.mockRestore(); });

  it("emits console.debug with prefix + where + message (hidden by default in Chrome)", () => {
    logDebug("background.SCAN_REQUEST", "content-script inject skipped");
    expect(debugSpy).toHaveBeenCalledWith("[A11y Scan] background.SCAN_REQUEST: content-script inject skipped");
  });

  it("with err arg, includes it as second console.debug argument", () => {
    const e = new Error("already injected");
    logDebug("background.forward", "noop", e);
    expect(debugSpy).toHaveBeenCalledWith("[A11y Scan] background.forward: noop", e);
  });
});
