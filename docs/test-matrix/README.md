# Test Matrix

Source-of-truth verification inventory for the A11y Scan Chrome extension.

Built per [TESTING_STANDARDS.md](https://github.com/dattupatel/com.yantrakit.a11yScan/blob/main/standards/TESTING_STANDARDS.md).

## Layout

- [`status.md`](./status.md) — verification matrix (last-verified date + mechanism + status per row)
- [`structural-gaps.md`](./structural-gaps.md) — paths NOT directly verifiable + indirect mechanism
- [`features/`](./features/) — one file per user-facing feature
- [`interactions/`](./interactions/) — one file per UI surface (panel/dialog/tab/sub-tab/toolbar)
- [`flows/`](./flows/) — one file per multi-step UX journey

## Hard rules

1. **No file > 30 rows of test cases** — split if over.
2. **No nested headings deeper than 3 levels** — keep files flat.
3. **One verification script per inventory file** in `extension/e2e/` — coverage maps 1:1.
4. **Every PR that adds/changes code must update at least one row in [`status.md`](./status.md)**.

## Workflow per change

1. Write or update the relevant inventory file FIRST.
2. Write the verification script (`e2e/verify-<feature|interaction|flow>-<name>.ts`) — must FAIL on parent main if the bug exists, PASS after the fix.
3. Make the code change.
4. Run unit tests + build + verify task. ALL must pass.
5. Manually run the verify task against the real environment — confirm screenshots look right.
6. Update `status.md` with new "last verified" date.
7. Commit, push, open PR.
8. **STOP.** Wait for explicit per-PR authorization from user before `gh pr merge`.
