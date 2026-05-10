## 2025-05-04 - Toast Container Accessibility Improvement
**Learning:** トーストのライブリージョンは、安定した親ラッパーに `aria-live="polite"` を使用し、`role="status"` や `aria-atomic="true"` を避けるべきです。なぜなら、これらはトーストリストに対して繰り返しのフルリストアナウンスを引き起こす可能性があるためです。
**Action:** 今後、動的リストや通知 UI を構築・改善する際は、このガイダンスに従います。
## 2025-05-04 - Icon-only buttons Accessibility Improvement
**Learning:** アイコンや記号（`+`、`-`、`↑`、`↓`など）のみを含むボタンには、スクリーンリーダーユーザーやマウスユーザーのアクセシビリティ向上のために、必ず説明的な `aria-label` 属性を含める必要があります。二重読み上げを防止するため、`title`属性は不要な場合は付与しないことが推奨されます。
**Action:** 今後、テキストを含まない、または記号のみのUIコンポーネント（ボタンなど）を構築・改善する際は、必ず意味のある `aria-label` を設定し、`title`属性の併用については慎重に判断します。

## 2025-05-06 - Accessible Icon Buttons and Tooltips
**Learning:** アイコンのみのボタン（「+」や「-」など）には `aria-label` が必須です。また、非活性（`disabled`）状態のボタンに `title` 属性を付与することで、ユーザーに「なぜ操作できないのか」の理由を示すことができ、親切なUXになります。
**Action:** 今後、アイコンボタンや状態に応じて disabled になるボタンを実装する際は、常に `aria-label` と `title` によるフォローアップ情報を含めるようにします。
## 2025-05-18 - Character Counter Accessibility
**Learning:** 入力制限のあるテキストエリアに文字数カウンターを追加する際、カウンター要素に `aria-live="polite"` を設定すると、1文字入力するごとにスクリーンリーダーが文字数を読み上げてしまい、非常に煩わしい体験になります。
**Action:** 今後文字数カウンターを実装する際は、`aria-live` ではなく、入力フィールドに `aria-describedby` を設定してカウンター要素と紐付けることで、フォーカス時に上限等の情報を適切に伝えるようにします。
