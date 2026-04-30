/**
 * Verify task — runs every e2e/verify-*.ts script sequentially and produces
 * a structured report. Used as `pnpm verify`.
 *
 * Per TESTING_STANDARDS.md Phase 2 + 3:
 * - one verification script per inventory file in docs/test-matrix/
 * - each script returns exit code 0 (pass) / nonzero (fail)
 * - this runner aggregates results and produces:
 *     - human-readable stdout
 *     - JSON report at e2e/verify-report.json
 *     - per-script duration + pass/fail
 *
 * Usage:
 *   pnpm build && pnpm verify
 *   pnpm verify -- --filter aria   (only run scripts with "aria" in the name)
 */

import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const E2E_DIR = path.resolve(__dirname);
const REPORT_PATH = path.join(E2E_DIR, "verify-report.json");

interface iScriptResult {
  script: string;
  durationMs: number;
  exitCode: number;
  status: "pass" | "fail" | "error";
  stdoutSnippet: string;
  stderrSnippet: string;
}

function listVerifyScripts(filter?: string): string[] {
  const all = fs.readdirSync(E2E_DIR)
    .filter((f) => f.startsWith("verify-") && f.endsWith(".ts"))
    .filter((f) => f !== "run-verify.ts")
    .sort();
  if (!filter) return all;
  return all.filter((f) => f.includes(filter));
}

function runScript(script: string): Promise<iScriptResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    let stdout = "";
    let stderr = "";
    const child = spawn("npx", ["tsx", path.join(E2E_DIR, script)], {
      env: { ...process.env, NODE_ENV: "test" },
    });
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("close", (exitCode) => {
      const durationMs = Date.now() - start;
      resolve({
        script,
        durationMs,
        exitCode: exitCode ?? -1,
        status: exitCode === 0 ? "pass" : exitCode === null ? "error" : "fail",
        stdoutSnippet: stdout.split("\n").slice(-15).join("\n"),
        stderrSnippet: stderr.split("\n").slice(-15).join("\n"),
      });
    });
    child.on("error", (err) => {
      resolve({
        script,
        durationMs: Date.now() - start,
        exitCode: -1,
        status: "error",
        stdoutSnippet: "",
        stderrSnippet: String(err),
      });
    });
  });
}

async function main(): Promise<void> {
  const filterArg = process.argv.find((a, i) => process.argv[i - 1] === "--filter");
  const scripts = listVerifyScripts(filterArg);

  console.log(`\n=== Running ${scripts.length} verification script(s) ===\n`);
  if (scripts.length === 0) {
    console.error("No verify-*.ts scripts found.");
    process.exit(1);
  }

  const results: iScriptResult[] = [];
  for (const script of scripts) {
    process.stdout.write(`▶ ${script} ... `);
    const result = await runScript(script);
    results.push(result);
    if (result.status === "pass") {
      console.log(`PASS (${result.durationMs}ms)`);
    } else {
      console.log(`${result.status.toUpperCase()} (${result.durationMs}ms, exit ${result.exitCode})`);
      if (result.stderrSnippet) console.log(`  stderr: ${result.stderrSnippet.split("\n").slice(0, 3).join("\n  ")}`);
    }
  }

  const summary = {
    timestamp: new Date().toISOString(),
    total: results.length,
    pass: results.filter((r) => r.status === "pass").length,
    fail: results.filter((r) => r.status === "fail").length,
    error: results.filter((r) => r.status === "error").length,
    durationMs: results.reduce((sum, r) => sum + r.durationMs, 0),
    results,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(summary, null, 2));

  console.log(`\n=== Report ===`);
  console.log(`  total: ${summary.total}`);
  console.log(`   pass: ${summary.pass}`);
  console.log(`   fail: ${summary.fail}`);
  console.log(`  error: ${summary.error}`);
  console.log(`   time: ${(summary.durationMs / 1000).toFixed(1)}s`);
  console.log(`\nFull report written to ${REPORT_PATH}\n`);

  process.exit(summary.pass === summary.total ? 0 : 1);
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(2);
});
