## 2025-05-04 - Toast Container Accessibility Improvement
**Learning:** トーストのライブリージョンは、安定した親ラッパーに `aria-live="polite"` を使用し、`role="status"` や `aria-atomic="true"` を避けるべきです。なぜなら、これらはトーストリストに対して繰り返しのフルリストアナウンスを引き起こす可能性があるためです。
**Action:** 今後、動的リストや通知 UI を構築・改善する際は、このガイダンスに従います。
## 2025-05-04 - Icon-only buttons Accessibility Improvement
**Learning:** アイコンや記号（`+`、`-`、`↑`、`↓`など）のみを含むボタンには、スクリーンリーダーユーザーやマウスユーザーのアクセシビリティ向上のために、必ず説明的な `aria-label` 属性を含める必要があります。二重読み上げを避けるため、title 属性との併用は避けるべきです。
**Action:** 今後、テキストを含まない、または記号のみのUIコンポーネント（ボタンなど）を構築・改善する際は、必ず意味のある `aria-label` を設定し、title の使用は控えます。
