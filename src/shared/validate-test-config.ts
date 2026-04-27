/**
 * Test config JSON validation.
 *
 * Source of truth: /docs/requirements/00-test-config-schema.md and
 * /docs/requirements/R-CONFIG-test-configuration.md.
 *
 * Validates the textarea/file content the user pasted into the config
 * dialog. Returns the parsed iTestConfig on success, or throws an Error
 * with a field-path-specific message on failure.
 */

import type { iTestConfig } from "./types";

/**
 * Validates raw JSON text against the iTestConfig shape.
 * All fields are optional; unknown keys are silently ignored (forward compat).
 * Returns the parsed config on success, or throws with a descriptive message.
 */
export function validateTestConfig(jsonText: string): iTestConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    const msg = e instanceof SyntaxError ? e.message : String(e);
    throw new Error("Invalid JSON — " + msg);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Config must be a JSON object, not an array or primitive.");
  }

  const obj = parsed as Record<string, unknown>;

  // wcag
  if ("wcag" in obj && obj.wcag !== undefined) {
    if (typeof obj.wcag !== "object" || obj.wcag === null || Array.isArray(obj.wcag)) {
      throw new Error("wcag must be an object. Got: " + JSON.stringify(obj.wcag));
    }
    const wcag = obj.wcag as Record<string, unknown>;
    if ("version" in wcag && wcag.version !== undefined) {
      if (!["2.0", "2.1", "2.2"].includes(wcag.version as string)) {
        throw new Error("wcag.version must be '2.0', '2.1', or '2.2'. Got: '" + String(wcag.version) + "'");
      }
    }
    if ("level" in wcag && wcag.level !== undefined) {
      if (!["A", "AA", "AAA"].includes(wcag.level as string)) {
        throw new Error("wcag.level must be 'A', 'AA', or 'AAA'. Got: '" + String(wcag.level) + "'");
      }
    }
  }

  // viewports
  if ("viewports" in obj && obj.viewports !== undefined) {
    if (!Array.isArray(obj.viewports)) {
      throw new Error("viewports must be an array of numbers. Got: " + JSON.stringify(obj.viewports));
    }
    for (const v of obj.viewports) {
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
        throw new Error("viewports entries must be positive numbers. Got: " + JSON.stringify(v));
      }
    }
  }

  // timing
  if ("timing" in obj && obj.timing !== undefined) {
    if (typeof obj.timing !== "object" || obj.timing === null || Array.isArray(obj.timing)) {
      throw new Error("timing must be an object. Got: " + JSON.stringify(obj.timing));
    }
    const timing = obj.timing as Record<string, unknown>;
    for (const key of ["pageLoadTimeout", "delayBetweenPages"] as const) {
      if (key in timing && timing[key] !== undefined) {
        if (typeof timing[key] !== "number" || !Number.isFinite(timing[key] as number) || (timing[key] as number) < 0) {
          throw new Error("timing." + key + " must be a non-negative number. Got: " + JSON.stringify(timing[key]));
        }
      }
    }
    if ("movieSpeed" in timing && timing.movieSpeed !== undefined) {
      const allowed = [0.25, 0.5, 1, 2, 4];
      if (typeof timing.movieSpeed !== "number" || !allowed.includes(timing.movieSpeed)) {
        throw new Error("timing.movieSpeed must be one of 0.25, 0.5, 1, 2, 4. Got: " + JSON.stringify(timing.movieSpeed));
      }
    }
  }

  // rules
  if ("rules" in obj && obj.rules !== undefined) {
    if (typeof obj.rules !== "object" || obj.rules === null || Array.isArray(obj.rules)) {
      throw new Error("rules must be an object. Got: " + JSON.stringify(obj.rules));
    }
    const rules = obj.rules as Record<string, unknown>;
    for (const key of ["include", "exclude"] as const) {
      if (key in rules && rules[key] !== undefined) {
        if (!Array.isArray(rules[key])) {
          throw new Error("rules." + key + " must be an array of strings. Got: " + JSON.stringify(rules[key]));
        }
        for (const r of rules[key] as unknown[]) {
          if (typeof r !== "string") {
            throw new Error("rules." + key + " entries must be strings. Got: " + JSON.stringify(r));
          }
        }
      }
    }
    // R-CONFIG-test-configuration.md AC: reject configs that try to use BOTH
    // include and exclude. They're mutually exclusive — the background applies
    // include-only first and silently ignores exclude when both are present,
    // which would surprise users who don't know that.
    if ("include" in rules && rules.include !== undefined && "exclude" in rules && rules.exclude !== undefined) {
      throw new Error("rules.include and rules.exclude are mutually exclusive — pick one.");
    }
  }

  // crawl
  if ("crawl" in obj && obj.crawl !== undefined) {
    if (typeof obj.crawl !== "object" || obj.crawl === null || Array.isArray(obj.crawl)) {
      throw new Error("crawl must be an object. Got: " + JSON.stringify(obj.crawl));
    }
    const crawl = obj.crawl as Record<string, unknown>;
    if ("mode" in crawl && crawl.mode !== undefined) {
      if (!["follow", "urllist"].includes(crawl.mode as string)) {
        throw new Error("crawl.mode must be 'follow' or 'urllist'. Got: '" + String(crawl.mode) + "'");
      }
    }
    if ("scope" in crawl && crawl.scope !== undefined && typeof crawl.scope !== "string") {
      throw new Error("crawl.scope must be a string. Got: " + JSON.stringify(crawl.scope));
    }
    if ("urlList" in crawl && crawl.urlList !== undefined) {
      if (!Array.isArray(crawl.urlList)) {
        throw new Error("crawl.urlList must be an array of strings. Got: " + JSON.stringify(crawl.urlList));
      }
      for (const u of crawl.urlList as unknown[]) {
        if (typeof u !== "string") {
          throw new Error("crawl.urlList entries must be strings. Got: " + JSON.stringify(u));
        }
      }
    }
  }

  // auth
  if ("auth" in obj && obj.auth !== undefined) {
    if (typeof obj.auth !== "object" || obj.auth === null || Array.isArray(obj.auth)) {
      throw new Error("auth must be an object. Got: " + JSON.stringify(obj.auth));
    }
    const auth = obj.auth as Record<string, unknown>;
    if ("gatedUrls" in auth && auth.gatedUrls !== undefined) {
      if (typeof auth.gatedUrls !== "object" || auth.gatedUrls === null || Array.isArray(auth.gatedUrls)) {
        throw new Error("auth.gatedUrls must be an object. Got: " + JSON.stringify(auth.gatedUrls));
      }
      const gu = auth.gatedUrls as Record<string, unknown>;
      if ("mode" in gu && gu.mode !== undefined) {
        if (!["none", "list", "prefix", "regex"].includes(gu.mode as string)) {
          throw new Error("auth.gatedUrls.mode must be 'none', 'list', 'prefix', or 'regex'. Got: '" + String(gu.mode) + "'");
        }
      }
      if ("patterns" in gu && gu.patterns !== undefined) {
        if (!Array.isArray(gu.patterns)) {
          throw new Error("auth.gatedUrls.patterns must be an array of strings. Got: " + JSON.stringify(gu.patterns));
        }
        for (const p of gu.patterns as unknown[]) {
          if (typeof p !== "string") {
            throw new Error("auth.gatedUrls.patterns entries must be strings. Got: " + JSON.stringify(p));
          }
        }
      }
    }
  }

  // pageRules
  if ("pageRules" in obj && obj.pageRules !== undefined) {
    if (!Array.isArray(obj.pageRules)) {
      throw new Error("pageRules must be an array. Got: " + JSON.stringify(obj.pageRules));
    }
    for (const r of obj.pageRules as unknown[]) {
      if (typeof r !== "object" || r === null || Array.isArray(r)) {
        throw new Error("pageRules entries must be objects. Got: " + JSON.stringify(r));
      }
      const rule = r as Record<string, unknown>;
      if (typeof rule.pattern !== "string") {
        throw new Error("pageRules[].pattern is required and must be a string. Got: " + JSON.stringify(rule.pattern));
      }
      if (!["login", "interaction", "deferred-content"].includes(rule.waitType as string)) {
        throw new Error("pageRules[].waitType must be 'login', 'interaction', or 'deferred-content'. Got: " + JSON.stringify(rule.waitType));
      }
      if (typeof rule.description !== "string") {
        throw new Error("pageRules[].description is required and must be a string. Got: " + JSON.stringify(rule.description));
      }
    }
  }

  // mocks
  if ("mocks" in obj && obj.mocks !== undefined) {
    if (!Array.isArray(obj.mocks)) {
      throw new Error("mocks must be an array. Got: " + JSON.stringify(obj.mocks));
    }
    for (const m of obj.mocks as unknown[]) {
      if (typeof m !== "object" || m === null || Array.isArray(m)) {
        throw new Error("mocks entries must be objects. Got: " + JSON.stringify(m));
      }
      const mock = m as Record<string, unknown>;
      if (typeof mock.urlPattern !== "string") {
        throw new Error("mocks[].urlPattern is required and must be a string. Got: " + JSON.stringify(mock.urlPattern));
      }
      if ("status" in mock && mock.status !== undefined) {
        if (typeof mock.status !== "number" || !Number.isInteger(mock.status) || mock.status < 100 || mock.status > 599) {
          throw new Error("mocks[].status must be an integer between 100 and 599. Got: " + JSON.stringify(mock.status));
        }
      }
      if ("method" in mock && mock.method !== undefined) {
        if (typeof mock.method !== "string") {
          throw new Error("mocks[].method must be a string when present. Got: " + JSON.stringify(mock.method));
        }
        if (!["GET", "POST", "PUT", "DELETE", "PATCH"].includes(mock.method.toUpperCase())) {
          throw new Error("mocks[].method must be one of 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'. Got: '" + String(mock.method) + "'");
        }
      }
      if ("headers" in mock && mock.headers !== undefined) {
        if (typeof mock.headers !== "object" || mock.headers === null || Array.isArray(mock.headers)) {
          throw new Error("mocks[].headers must be an object. Got: " + JSON.stringify(mock.headers));
        }
      }
    }
  }

  // enrichment
  if ("enrichment" in obj && obj.enrichment !== undefined) {
    if (typeof obj.enrichment !== "object" || obj.enrichment === null || Array.isArray(obj.enrichment)) {
      throw new Error("enrichment must be an object. Got: " + JSON.stringify(obj.enrichment));
    }
    const enr = obj.enrichment as Record<string, unknown>;
    for (const key of ["domContext", "cssContext", "frameworkHints", "filePathGuess"] as const) {
      if (key in enr && enr[key] !== undefined && typeof enr[key] !== "boolean") {
        throw new Error("enrichment." + key + " must be a boolean. Got: " + JSON.stringify(enr[key]));
      }
    }
  }

  // heuristics
  if ("heuristics" in obj && obj.heuristics !== undefined) {
    if (typeof obj.heuristics !== "object" || obj.heuristics === null || Array.isArray(obj.heuristics)) {
      throw new Error("heuristics must be an object. Got: " + JSON.stringify(obj.heuristics));
    }
    const h = obj.heuristics as Record<string, unknown>;
    if ("enabled" in h && h.enabled !== undefined && typeof h.enabled !== "boolean") {
      throw new Error("heuristics.enabled must be a boolean. Got: " + JSON.stringify(h.enabled));
    }
    if ("exclude" in h && h.exclude !== undefined) {
      if (!Array.isArray(h.exclude)) {
        throw new Error("heuristics.exclude must be an array of numbers. Got: " + JSON.stringify(h.exclude));
      }
      for (const n of h.exclude as unknown[]) {
        if (typeof n !== "number" || !Number.isFinite(n)) {
          throw new Error("heuristics.exclude entries must be numbers. Got: " + JSON.stringify(n));
        }
      }
    }
  }

  return obj as iTestConfig;
}
