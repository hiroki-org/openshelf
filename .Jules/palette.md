## 2024-05-02 - Toast Accessibility
**Learning:** Toasts added dynamically to the DOM without `aria-live` are completely ignored by screen readers, meaning blind users miss critical feedback like success or error states.
**Action:** Always add `aria-live="polite"` (or "assertive" for critical errors) to the static container wrapping the toasts, and `role="alert"` or `role="status"` on the dynamically inserted elements.
