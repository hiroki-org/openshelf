## 2025-05-04 - Toast Container Accessibility Improvement
**Learning:** Reactコンポーネント（ここではToastContainer）において、トースト通知のような動的なメッセージが順次追加される場合、静的な親コンテナに `aria-live="polite"` を設定します。ただし、`role="status"` は暗黙的に `aria-atomic="true"` と解釈されることがあり、新しいトーストが追加されるたびに古いトーストを含めてリスト全体が再読み上げされてしまう可能性があるため、このようなトーストのリストコンテナには `role="status"` や `aria-atomic="true"` は付与しないのが適切です。
**Action:** 今後、動的リストや通知 UI を構築・改善する際は、必ず静的なラッパー要素に対して ARIA Live Region 属性を一括で指定し、リストコンテナでの `role="status"` の使用は避けるようにします。
