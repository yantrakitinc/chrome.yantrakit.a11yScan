# R-MV — Multi-Viewport Scan

## Purpose

Scan the same page at multiple viewport widths. Detect responsive-only issues (e.g., violation that only appears at mobile width).

## Activation

In the Scan tab accordion, a checkbox `<input type="checkbox" id="mv-check">` labeled "Multi-Viewport".

When checked: a viewport editor appears below the checkbox.

```
☑ Multi-Viewport
   [375] [×]   [768] [×]   [1280] [×]   [+ Add]   [edit]
```

A row of viewport chips. Each chip:
- A number input (`type="number" min="320"`) for the width
- A small × button to remove
- Each width is in the `state.viewports` array

Edit button: when clicked, the chips become editable inputs (vs read-only display). Save by re-clicking edit (which becomes "done").

Add button: appends a new viewport (e.g., 1024) to the list.

Defaults: `[375, 768, 1280]`. Resetting (Reset button in the accordion) restores defaults.

## Scan flow with MV

1. User clicks "Scan All Viewports".
2. Sidepanel sends `MULTI_VIEWPORT_SCAN { viewports: [375, 768, 1280] }` to background.
3. Background:
   - Saves the current window size.
   - For each viewport width:
     - Resize the window to that width (height stays).
     - Wait 500ms for layout to settle.
     - Inject content script and run scan.
     - Collect violations + passes.
     - Broadcast `MULTI_VIEWPORT_PROGRESS { currentViewport, totalViewports }`.
   - Restore window size.
   - Compute deltas: which violations appear at all viewports vs viewport-specific.
4. Background returns `{ type: "MULTI_VIEWPORT_RESULT", payload: iMultiViewportResult }`.

## Results display

Same as single page scan, BUT each violation row shows:

- "All viewports" label if violation exists at every scanned width
- `[375px]` chip(s) if violation exists ONLY at specific widths

A viewport filter row at the top:

```
[All] [375px] [768px] [1280px]
```

Click a viewport chip to filter the results to violations at that viewport only.

## Progress UI

While scanning multiple viewports:

```
viewport 2/3
[==============------]
```

The progress text updates per `MULTI_VIEWPORT_PROGRESS` message.

## Test config consumption

| Field | Effect |
|---|---|
| `viewports` | Override the default `[375, 768, 1280]` widths. The Multi-Viewport checkbox automatically reflects the test-config-supplied list. |

## Test cases

### E2E

1. Check Multi-Viewport → viewport editor appears with 375/768/1280 chips.
2. Click "Scan All Viewports" → progress updates "viewport 1/3", then "2/3", then "3/3".
3. Results show violations with viewport-specific badges where appropriate.
4. Click a viewport filter chip → results filter to that viewport.
5. Edit a viewport (e.g., change 375 to 320) → next scan uses 320.
6. Add a viewport → list now has 4 viewports.
7. Remove a viewport → list shrinks.
8. With test config `viewports: [320, 1440]`, the chips show 320 and 1440 by default.

### Unit

1. `state.viewports` is mutable; toggling MV does not reset it.
2. When test config has `viewports`, that list is used.
3. Default reset returns to `[375, 768, 1280]`.
