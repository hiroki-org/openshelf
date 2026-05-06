## 2025-05-04 - Toast Container Accessibility Improvement
**Learning:** トーストのライブリージョンは、安定した親ラッパーに `aria-live="polite"` を使用し、`role="status"` や `aria-atomic="true"` を避けるべきです。なぜなら、これらはトーストリストに対して繰り返しのフルリストアナウンスを引き起こす可能性があるためです。
**Action:** 今後、動的リストや通知 UI を構築・改善する際は、このガイダンスに従います。
## 2026-05-06 - PDF Viewer Zoom Buttons Accessibility
**Learning:** アイコンのみのボタン（PDFビューアの+や-ボタンなど）には、スクリーンリーダーユーザーやツールチップを利用するユーザーのために`aria-label`と`title`属性を必ず追加する必要があります。また、これらを変更した際には関連するDOMテスト（`getByRole(button, { name: ... })`）も同時に更新しなければ、テストが壊れる原因となります。
**Action:** 今後、アイコンのみのインタラクティブな要素を見つけた際は、視覚的・非視覚的なアクセシビリティの両方を考慮し、テストも合わせて更新するよう徹底します。
