## 2025-05-04 - Toast Container Accessibility Improvement
**Learning:** トーストのライブリージョンは、安定した親ラッパーに `aria-live="polite"` を使用し、`role="status"` や `aria-atomic="true"` を避けるべきです。なぜなら、これらはトーストリストに対して繰り返しのフルリストアナウンスを引き起こす可能性があるためです。
**Action:** 今後、動的リストや通知 UI を構築・改善する際は、このガイダンスに従います。

## 2025-02-14 - PDF Viewer Zoom Buttons
**Learning:** Icon-only buttons without `aria-label` or `title` attributes are a common accessibility issue in custom components like the PDF viewer, hindering screen reader users and missing helpful tooltips.
**Action:** Always verify custom component toolbars for icon-only buttons and add `aria-label` and `title` attributes. Make sure to update associated tests (e.g., `screen.getByRole("button", { name: "..." })`) when adding accessible names.
