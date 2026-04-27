import { describe, it, expect } from "vitest";
import { validateTestConfig } from "../validate-test-config";

describe("validateTestConfig — JSON-level errors", () => {
  it("rejects malformed JSON with a SyntaxError-derived message", () => {
    expect(() => validateTestConfig("{ not json")).toThrow(/Invalid JSON/);
  });
  it("rejects array root", () => {
    expect(() => validateTestConfig("[]")).toThrow(/must be a JSON object/);
  });
  it("rejects primitive root (string)", () => {
    expect(() => validateTestConfig('"hi"')).toThrow(/must be a JSON object/);
  });
  it("rejects null root", () => {
    expect(() => validateTestConfig("null")).toThrow(/must be a JSON object/);
  });
  it("accepts empty object", () => {
    expect(validateTestConfig("{}")).toEqual({});
  });
});

describe("validateTestConfig — wcag", () => {
  it("accepts wcag.version 2.0 / 2.1 / 2.2", () => {
    expect(() => validateTestConfig('{"wcag":{"version":"2.0"}}')).not.toThrow();
    expect(() => validateTestConfig('{"wcag":{"version":"2.1"}}')).not.toThrow();
    expect(() => validateTestConfig('{"wcag":{"version":"2.2"}}')).not.toThrow();
  });
  it("rejects unknown wcag.version", () => {
    expect(() => validateTestConfig('{"wcag":{"version":"3.0"}}')).toThrow(/wcag.version must be/);
  });
  it("accepts wcag.level A / AA / AAA", () => {
    expect(() => validateTestConfig('{"wcag":{"level":"A"}}')).not.toThrow();
    expect(() => validateTestConfig('{"wcag":{"level":"AA"}}')).not.toThrow();
    expect(() => validateTestConfig('{"wcag":{"level":"AAA"}}')).not.toThrow();
  });
  it("rejects unknown wcag.level", () => {
    expect(() => validateTestConfig('{"wcag":{"level":"B"}}')).toThrow(/wcag.level must be/);
  });
});

describe("validateTestConfig — viewports", () => {
  it("accepts an array of positive numbers", () => {
    expect(() => validateTestConfig('{"viewports":[320,768,1280]}')).not.toThrow();
  });
  it("rejects non-array", () => {
    expect(() => validateTestConfig('{"viewports":"320"}')).toThrow(/must be an array/);
  });
  it("rejects zero or negative widths", () => {
    expect(() => validateTestConfig('{"viewports":[0]}')).toThrow(/positive numbers/);
    expect(() => validateTestConfig('{"viewports":[-100]}')).toThrow(/positive numbers/);
  });
  it("rejects non-number entries", () => {
    expect(() => validateTestConfig('{"viewports":["320"]}')).toThrow(/positive numbers/);
  });
});

describe("validateTestConfig — timing", () => {
  it("accepts pageLoadTimeout/delayBetweenPages as non-negative numbers", () => {
    expect(() => validateTestConfig('{"timing":{"pageLoadTimeout":0,"delayBetweenPages":1000}}')).not.toThrow();
  });
  it("rejects negative pageLoadTimeout", () => {
    expect(() => validateTestConfig('{"timing":{"pageLoadTimeout":-1}}')).toThrow(/non-negative number/);
  });
  it("accepts movieSpeed as a positive number", () => {
    expect(() => validateTestConfig('{"timing":{"movieSpeed":2}}')).not.toThrow();
    expect(() => validateTestConfig('{"timing":{"movieSpeed":0.5}}')).not.toThrow();
  });
  it("rejects non-positive movieSpeed", () => {
    expect(() => validateTestConfig('{"timing":{"movieSpeed":0}}')).toThrow(/positive number/);
    expect(() => validateTestConfig('{"timing":{"movieSpeed":-1}}')).toThrow(/positive number/);
  });
});

describe("validateTestConfig — rules", () => {
  it("accepts rules.include as a string array", () => {
    expect(() => validateTestConfig('{"rules":{"include":["color-contrast"]}}')).not.toThrow();
  });
  it("accepts rules.exclude as a string array", () => {
    expect(() => validateTestConfig('{"rules":{"exclude":["region"]}}')).not.toThrow();
  });
  it("rejects non-array rules.include", () => {
    expect(() => validateTestConfig('{"rules":{"include":"x"}}')).toThrow(/must be an array of strings/);
  });
  it("rejects non-string entries in rules.include", () => {
    expect(() => validateTestConfig('{"rules":{"include":[1]}}')).toThrow(/entries must be strings/);
  });
  it("rejects when both rules.include and rules.exclude are present", () => {
    expect(() => validateTestConfig('{"rules":{"include":["a"],"exclude":["b"]}}')).toThrow(/mutually exclusive/);
  });
});

describe("validateTestConfig — pageRules", () => {
  it("accepts well-formed pageRules", () => {
    expect(() => validateTestConfig(JSON.stringify({
      pageRules: [{ pattern: "/admin", waitType: "login", description: "Sign in first" }],
    }))).not.toThrow();
  });
  it("rejects missing pattern", () => {
    expect(() => validateTestConfig(JSON.stringify({
      pageRules: [{ waitType: "login", description: "x" }],
    }))).toThrow(/pageRules\[\].pattern is required/);
  });
  it("rejects unknown waitType", () => {
    expect(() => validateTestConfig(JSON.stringify({
      pageRules: [{ pattern: "/x", waitType: "nope", description: "x" }],
    }))).toThrow(/waitType must be/);
  });
  it("rejects missing description", () => {
    expect(() => validateTestConfig(JSON.stringify({
      pageRules: [{ pattern: "/x", waitType: "login" }],
    }))).toThrow(/description is required/);
  });
});

describe("validateTestConfig — mocks", () => {
  it("accepts well-formed mocks", () => {
    expect(() => validateTestConfig(JSON.stringify({
      mocks: [{ urlPattern: "/api", status: 200, body: { ok: true } }],
    }))).not.toThrow();
  });
  it("rejects missing urlPattern", () => {
    expect(() => validateTestConfig(JSON.stringify({
      mocks: [{ status: 200 }],
    }))).toThrow(/urlPattern is required/);
  });
  it("rejects missing status", () => {
    expect(() => validateTestConfig(JSON.stringify({
      mocks: [{ urlPattern: "/api" }],
    }))).toThrow(/status is required/);
  });
  it("rejects non-object headers", () => {
    expect(() => validateTestConfig(JSON.stringify({
      mocks: [{ urlPattern: "/api", status: 200, headers: "x" }],
    }))).toThrow(/headers must be an object/);
  });
});

describe("validateTestConfig — enrichment", () => {
  it("accepts boolean fields", () => {
    expect(() => validateTestConfig(JSON.stringify({
      enrichment: { domContext: true, cssContext: false, frameworkHints: true, filePathGuess: false },
    }))).not.toThrow();
  });
  it("rejects non-boolean values", () => {
    expect(() => validateTestConfig(JSON.stringify({
      enrichment: { domContext: 1 },
    }))).toThrow(/enrichment.domContext must be a boolean/);
  });
});

describe("validateTestConfig — heuristics", () => {
  it("accepts enabled boolean and exclude number array", () => {
    expect(() => validateTestConfig(JSON.stringify({
      heuristics: { enabled: true, exclude: [1, 2, 3] },
    }))).not.toThrow();
  });
  it("rejects non-boolean enabled", () => {
    expect(() => validateTestConfig(JSON.stringify({
      heuristics: { enabled: "yes" },
    }))).toThrow(/heuristics.enabled must be a boolean/);
  });
  it("rejects non-number exclude entries", () => {
    expect(() => validateTestConfig(JSON.stringify({
      heuristics: { exclude: ["1"] },
    }))).toThrow(/exclude entries must be numbers/);
  });
});

describe("validateTestConfig — forward compat", () => {
  it("ignores unknown top-level keys", () => {
    expect(() => validateTestConfig('{"futureKey":"hello"}')).not.toThrow();
  });
});
