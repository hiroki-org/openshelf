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
## 2025-05-18 - Async Button Loading States
**Learning:** フォーム送信などの非同期処理を実行するボタンでは、単にテキストを「保存中...」などに変更するだけではなく、視覚的なローディングスピナー（例：`animate-spin`を用いた要素）を併用することで、処理が進行中であることを直感的に伝えることができます。
**Action:** 今後、非同期処理を伴うボタンを実装・改善する際は、必ずローディングスピナーなどの視覚的フィードバックを含めるようにします。
## 2025-05-13 - Input Field Character Counter Accessibility Improvement
**Learning:** 文字数カウンターを実装する際、スクリーンリーダー向けに入力フィールドとカウンターをプログラム的に関連付けるには `aria-describedby` 属性を使用するのがベストプラクティスです。`aria-live` は入力のたびに読み上げが発生するため煩わしい場合があります。
**Action:** 今後、入力フィールドに対する文字数カウンターなど、付加的な動的情報を提供する際は `aria-live` ではなく、入力要素に `aria-describedby` を付与してカウンター要素を紐付けるアプローチをデフォルトの設計とします。

## 2025-05-19 - Accessible Loading Spinner in Dropdown Menu Items
**Learning:** The loading spinner pattern inside a `button` (e.g. `animate-spin` with `aria-hidden="true"`) is equally effective when applied to interactive dropdown menu items (e.g., `role="menuitem"`) during async operations like generating formats, providing better visual context than text changes alone.
**Action:** Moving forward, apply visual loading indicators not just to primary form submit buttons, but also to secondary action items like dropdown menu items that execute async actions.
