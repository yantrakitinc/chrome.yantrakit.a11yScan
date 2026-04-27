// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = { runtime: { sendMessage: vi.fn() } };
  // jsdom doesn't implement scrollIntoView; movie-mode calls it on every step.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Element.prototype as any).scrollIntoView = function () { /* noop */ };
  document.body.innerHTML = "";
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).chrome;
  document.body.innerHTML = "";
});

describe("movie-mode — lifecycle", () => {
  it("startMovie on a page with no focusables is a no-op (doesn't throw)", async () => {
    const { startMovie, stopMovie } = await import("../movie-mode");
    expect(() => startMovie()).not.toThrow();
    stopMovie();
  });

  it("setSpeed accepts valid multipliers", async () => {
    const { setSpeed } = await import("../movie-mode");
    expect(() => setSpeed(0.25)).not.toThrow();
    expect(() => setSpeed(0.5)).not.toThrow();
    expect(() => setSpeed(1)).not.toThrow();
    expect(() => setSpeed(2)).not.toThrow();
    expect(() => setSpeed(4)).not.toThrow();
  });

  it("setSpeed silently ignores 0 / negative / NaN / Infinity", async () => {
    const { setSpeed } = await import("../movie-mode");
    expect(() => setSpeed(0)).not.toThrow();
    expect(() => setSpeed(-1)).not.toThrow();
    expect(() => setSpeed(NaN)).not.toThrow();
    expect(() => setSpeed(Infinity)).not.toThrow();
  });

  it("pause/resume/stop are idempotent — no-op when not playing", async () => {
    const { pauseMovie, resumeMovie, stopMovie } = await import("../movie-mode");
    expect(() => pauseMovie()).not.toThrow();
    expect(() => resumeMovie()).not.toThrow();
    expect(() => stopMovie()).not.toThrow();
  });

  it("startMovie schedules a tick that broadcasts MOVIE_TICK or MOVIE_COMPLETE", async () => {
    const { startMovie, stopMovie } = await import("../movie-mode");
    document.body.innerHTML = `<button id="b1">a</button><button id="b2">b</button><button id="b3">c</button>`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sendMessage = (globalThis as any).chrome.runtime.sendMessage as ReturnType<typeof vi.fn>;
    startMovie();

    // Advance 2× speed (default 1000ms) — should produce a MOVIE_TICK
    await vi.advanceTimersByTimeAsync(1100);
    const types = sendMessage.mock.calls.map((c) => (c[0] as { type: string }).type);
    expect(types).toContain("MOVIE_TICK");

    stopMovie();
  });
});
