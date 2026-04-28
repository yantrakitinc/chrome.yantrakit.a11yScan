// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../ai-tab";

describe("renderMarkdown", () => {
  it("escapes raw HTML in input", () => {
    const out = renderMarkdown("<script>alert(1)</script>");
    expect(out).not.toMatch(/<script>alert/);
    expect(out).toMatch(/&lt;script&gt;/);
  });

  it("converts **text** to <strong>text</strong>", () => {
    expect(renderMarkdown("**bold** word")).toMatch(/<strong>bold<\/strong>/);
  });

  it("converts *text* to <em>text</em>", () => {
    expect(renderMarkdown("an *italic* word")).toMatch(/<em>italic<\/em>/);
  });

  it("converts `code` to <code> spans", () => {
    expect(renderMarkdown("call `foo()` here")).toMatch(/<code[^>]*>foo\(\)<\/code>/);
  });

  it("converts ```fenced``` blocks to <pre> blocks", () => {
    expect(renderMarkdown("```\nx = 1\n```")).toMatch(/<pre[^>]*>[\s\S]*x = 1[\s\S]*<\/pre>/);
  });

  it("converts newlines to <br>", () => {
    expect(renderMarkdown("line1\nline2")).toMatch(/line1<br>line2/);
  });

  it("escapes HTML inside fenced code blocks too (no raw script)", () => {
    const out = renderMarkdown("```\n<script>alert(1)</script>\n```");
    expect(out).not.toMatch(/<script>alert/);
    expect(out).toMatch(/&lt;script&gt;/);
  });

  it("returns empty string unchanged", () => {
    expect(renderMarkdown("")).toBe("");
  });

  it("handles plain text with no markdown markers", () => {
    expect(renderMarkdown("plain text")).toBe("plain text");
  });
});
