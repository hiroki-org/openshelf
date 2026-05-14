## 2025-05-04 - Toast Container Accessibility Improvement
**Learning:** トーストのライブリージョンは、安定した親ラッパーに `aria-live="polite"` を使用し、`role="status"` や `aria-atomic="true"` を避けるべきです。なぜなら、これらはトーストリストに対して繰り返しのフルリストアナウンスを引き起こす可能性があるためです。
**Action:** 今後、動的リストや通知 UI を構築・改善する際は、このガイダンスに従います。
## 2025-05-04 - Icon-only buttons Accessibility Improvement
**Learning:** アイコンや記号（`+`、`-`、`↑`、`↓`など）のみを含むボタンには、スクリーンリーダーユーザーやマウスユーザーのアクセシビリティ向上のために、必ず説明的な `aria-label` 属性を含める必要があります。二重読み上げを防止するため、`title`属性は不要な場合は付与しないことが推奨されます。
**Action:** 今後、テキストを含まない、または記号のみのUIコンポーネント（ボタンなど）を構築・改善する際は、必ず意味のある `aria-label` を設定し、`title`属性の併用については慎重に判断します。

## 2025-05-06 - Accessible Icon Buttons and Tooltips
**Learning:** アイコンのみのボタン（「+」や「-」など）には `aria-label` が必須です。また、非活性（`disabled`）状態のボタンに `title` 属性を付与することで、ユーザーに「なぜ操作できないのか」の理由を示すことができ、親切なUXになります。
**Action:** 今後、アイコンボタンや状態に応じて disabled になるボタンを実装する際は、常に `aria-label` と `title` によるフォローアップ情報を含めるようにします。

## 2025-05-11 - Character Counter Accessibility
**Learning:** 文字数カウンターを実装する際、カウンター要素に `aria-live="polite"` を設定すると、スクリーンリーダーがユーザーのキーストロークごとに毎回文字数を読み上げてしまい、非常に煩わしい体験になります。
**Action:** 今後、入力フィールドに対する文字数カウンターなど、付加的な動的情報を提供する際は `aria-live` は使用せず、入力フィールドに `aria-describedby` 属性を付与してカウンター要素を紐付けるアプローチを採用します。
## 2026-05-12 - Toast Notification Accessibility & Visual Polish
**Learning:** For UI accessibility with dynamically rendered content like toast notifications, applying `role="status"` along with `aria-live="polite"` on the static wrapper container (instead of the dynamically added children) prevents screen readers from erroneously announcing messages twice or missing them. Additionally, pairing text with status-specific icons (success/error/info) significantly improves the visual polish and cognitive accessibility of these notifications.
**Action:** Added `role="status"` to the ToastContainer's wrapper div and implemented a `ToastIcon` component to inject relevant SVG icons based on the toast type.
