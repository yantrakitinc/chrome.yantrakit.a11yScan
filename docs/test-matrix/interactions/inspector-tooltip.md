# Inspector tooltip (page-side)

Floating tooltip rendered in the inspected page when inspect mode is active.

| Element | Trigger | Behavior | Visual state | Message |
|---|---|---|---|---|
| document mousemove (inspect active, !pinned) | move | elementFromPoint → highlight + show tooltip | yellow outline on hovered element + dark tooltip | none |
| document click (inspect active) | click | toggle pin on hovered element | tooltip border turns indigo when pinned | INSPECT_ELEMENT (with iInspectorData) |
| document click on pinned element again | click | unpin; remove tooltip + highlight | tooltip removed | none |
| document keydown Escape | press | exitInspectMode | tooltip + highlight removed; inspector inactive | none |
| Tooltip placement (above fits) | render | top: rect.top - 200 - 8 | tooltip above target | none |
| Tooltip placement (above too small, below fits) | render | top: rect.bottom + 8 | tooltip below target | none |
| Tooltip placement (above + below don't fit, right fits) | render | left: rect.right + 8 | tooltip to right | none |
| Tooltip placement (above + below + right don't fit) | render | left: rect.left - 320 - 8 (clamped to MARGIN) | tooltip to left | none |
| Tooltip content | render | Role + Name + ARIA Attrs + Tabindex + Focusable status + Violations | dark tooltip with sections | none |
| Tooltip Violations section | render (matches exist) | one row per match with rule id + impact + message | per match | none |

## Source
- Module: `src/content/inspector.ts`

## Security
- All page-controlled fields (role, accessibleName, ARIA attribute names + values) HTML-escaped before innerHTML — defends against hostile aria-label content with `<script>` or quote chars.

## Notes
- Inspector activated via SR tab "Inspect" or KB tab "Inspect" buttons (sends ENTER_INSPECT_MODE to content).
