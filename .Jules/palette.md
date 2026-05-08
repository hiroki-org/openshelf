## 2025-05-04 - Toast Container Accessibility Improvement
**Learning:** トーストのライブリージョンは、安定した親ラッパーに `aria-live="polite"` を使用し、`role="status"` や `aria-atomic="true"` を避けるべきです。なぜなら、これらはトーストリストに対して繰り返しのフルリストアナウンスを引き起こす可能性があるためです。
**Action:** 今後、動的リストや通知 UI を構築・改善する際は、このガイダンスに従います。

## 2025-05-08 - Icon-Only Button Accessibility
**Learning:** アイコンのみのボタン（例：PDFビューアの `+` や `-` のようなズームコントロールボタン）には、スクリーンリーダーユーザーにとって意味が伝わるように `aria-label` および `title` 属性を付与する必要があります。これがないと、ボタンの目的が正確に伝わらない可能性があります。
**Action:** 今後、テキストを含まないアイコンのみのボタンを作成・修正する際は、必ず意味のある `aria-label` とツールチップ用の `title` 属性を設定します。
