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
    vi.resetModules();
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

describe("movie-mode — pause/resume during playback", () => {
  it("pauseMovie clears the pending tick when called during 'playing' state", async () => {
    vi.resetModules();
    const { startMovie, pauseMovie, stopMovie } = await import("../movie-mode");
    document.body.innerHTML = `<button>a</button><button>b</button><button>c</button>`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sendMessage = (globalThis as any).chrome.runtime.sendMessage as ReturnType<typeof vi.fn>;
    startMovie();
    pauseMovie(); // clears the timer mid-flight

    // Advance well past the tick interval — no MOVIE_TICK should fire while paused
    await vi.advanceTimersByTimeAsync(3000);
    const types = sendMessage.mock.calls.map((c) => (c[0] as { type: string }).type);
    expect(types.includes("MOVIE_TICK")).toBe(false);

    stopMovie();
  });

  it("resumeMovie restarts ticks after pause", async () => {
    vi.resetModules();
    const { startMovie, pauseMovie, resumeMovie, stopMovie } = await import("../movie-mode");
    document.body.innerHTML = `<button>a</button><button>b</button>`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sendMessage = (globalThis as any).chrome.runtime.sendMessage as ReturnType<typeof vi.fn>;
    startMovie();
    pauseMovie();
    resumeMovie();
    await vi.advanceTimersByTimeAsync(1100);
    const ticks = sendMessage.mock.calls.filter((c) => (c[0] as { type: string }).type === "MOVIE_TICK");
    expect(ticks.length).toBeGreaterThan(0);

    stopMovie();
  });
});

describe("movie-mode — completion path", () => {
  it("broadcasts MOVIE_COMPLETE after iterating through all elements", async () => {
    vi.resetModules();
    const { startMovie, stopMovie } = await import("../movie-mode");
    document.body.innerHTML = `<button>only</button>`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sendMessage = (globalThis as any).chrome.runtime.sendMessage as ReturnType<typeof vi.fn>;
    startMovie();
    // After the first tick, currentIndex (0) goes to 1 which is >= elements.length (1)
    await vi.advanceTimersByTimeAsync(1100);
    const types = sendMessage.mock.calls.map((c) => (c[0] as { type: string }).type);
    expect(types).toContain("MOVIE_COMPLETE");

    stopMovie();
  });

  it("MOVIE_COMPLETE catch path: sendMessage throws → no throw bubbles up", async () => {
    vi.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = {
      runtime: {
        sendMessage: vi.fn(() => { throw new Error("sidepanel closed"); }),
      },
    };
    const { startMovie, stopMovie } = await import("../movie-mode");
    document.body.innerHTML = `<button>only</button>`;

    expect(() => {
      startMovie();
    }).not.toThrow();
    await expect(vi.advanceTimersByTimeAsync(1100)).resolves.not.toThrow();

    stopMovie();
  });

  it("MOVIE_TICK catch path: sendMessage throws on tick → no throw bubbles up", async () => {
    vi.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = {
      runtime: {
        sendMessage: vi.fn(() => { throw new Error("sidepanel closed"); }),
      },
    };
    const { startMovie, stopMovie } = await import("../movie-mode");
    document.body.innerHTML = `<button>a</button><button>b</button><button>c</button>`;

    startMovie();
    await expect(vi.advanceTimersByTimeAsync(1100)).resolves.not.toThrow();

    stopMovie();
  });
});

describe("movie-mode — Escape key", () => {
  it("Escape keydown while a movie is playing stops the movie", async () => {
    vi.resetModules();
    const { startMovie } = await import("../movie-mode");
    document.body.innerHTML = `<button>a</button><button>b</button>`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sendMessage = (globalThis as any).chrome.runtime.sendMessage as ReturnType<typeof vi.fn>;
    startMovie();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    sendMessage.mockClear();
    await vi.advanceTimersByTimeAsync(2000);
    // Already stopped — no further ticks
    const types = sendMessage.mock.calls.map((c) => (c[0] as { type: string }).type);
    expect(types.includes("MOVIE_TICK")).toBe(false);
  });

  it("Escape keydown when idle is a no-op (doesn't throw)", async () => {
    vi.resetModules();
    await import("../movie-mode");
    expect(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    }).not.toThrow();
  });
});
