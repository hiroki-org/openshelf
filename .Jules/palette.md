**Action:** 今後、テキストを含まない、または記号のみのUIコンポーネント（ボタンなど）を構築・改善する際は、必ず意味のある `aria-label` を設定し、`title`属性の併用については慎重に判断します。

## 2025-05-06 - Accessible Icon Buttons and Tooltips
**Learning:** アイコンのみのボタン（「+」や「-」など）には `aria-label` が必須です。また、非活性（`disabled`）状態のボタンに `title` 属性を付与することで、ユーザーに「なぜ操作できないのか」の理由を示すことができ、親切なUXになります。
**Action:** 今後、アイコンボタンや状態に応じて disabled になるボタンを実装する際は、常に `aria-label` と `title` によるフォローアップ情報を含めるようにします。
## 2024-05-10 - Toast Container Accessibility Improvement
**Learning:** トーストのライブリージョンは、安定した親ラッパーに `aria-live="polite"` とともに `role="status"` を設定するべきです。これにより、スクリーンリーダーがステータスメッセージとして正しく認識し、ユーザーのワークフローを中断することなく通知を読み上げることができます。
**Action:** 今後、動的リストや通知UI（トーストなど）を構築・改善する際は、必ず `role="status"` と `aria-live="polite"`（または `role="alert"` と `aria-live="assertive"`）を組み合わせてラッパーコンテナに適用します。
