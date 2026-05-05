## 2025-05-04 - Toast Container Accessibility Improvement
**Learning:** トーストのライブリージョンは、安定した親ラッパーに `aria-live="polite"` を使用し、`role="status"` や `aria-atomic="true"` を避けるべきです。なぜなら、これらはトーストリストに対して繰り返しのフルリストアナウンスを引き起こす可能性があるためです。
**Action:** 今後、動的リストや通知 UI を構築・改善する際は、このガイダンスに従います。

## 2025-05-04 - Icon-only button Accessibility Improvement
**Learning:** `+` や `-` といったアイコンや記号のみのボタンでは、スクリーンリーダーで内容が正しく伝わらないため、機能や目的を示す明確な `aria-label` が必須です。
**Action:** 今後、アイコンのみで構成されるボタンやコントロールを見つけた場合、コンテキストに合わせた `aria-label` を必ず付与します。
