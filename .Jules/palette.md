## 2025-05-04 - Toast Container Accessibility Improvement
**Learning:** Reactコンポーネント（ここではToastContainer）において、トースト通知のような動的なメッセージが順次追加される場合、各子要素ではなく、親コンテナ全体に `role="status"` および `aria-live="polite"`（または `alert` と `assertive`）を設定することで、スクリーンリーダーによる二重読み上げを防ぎ、アクセシビリティを正しく向上させることができます。
**Action:** 今後、動的リストや通知 UI を構築・改善する際は、必ず静的なラッパー要素に対して ARIA Live Region 属性を一括で指定するようにします。
