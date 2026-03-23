const fs = require('fs');
const file = 'apps/web/src/app/orgs/[slug]/settings/components/general-tab.tsx';
let code = fs.readFileSync(file, 'utf8');

// The previous `useEffect` in general-tab was overriding the local state changes because it fired unnecessarily or the component re-rendered.
// Let's modify it to only update if the org prop actually changes in a way that should overwrite the user's edits (e.g. after a save, which re-syncs the object from the server).
// Actually, `useEffect(() => { ... }, [org])` causes `setEditName(org.name)` to run whenever `org` reference changes. But `org` only changes on save.
// Wait, the test uses `fireEvent.change` which updates `editName`. Then it clicks "保存". The API returns `{ok: true, org: state.org}`.
// Look at `10th vi.fn() call:` in the error message:
// `body: "{\\"name\\":\\"Demo Org\\",\\"slug\\":\\"renamed-team\\",\\"description\\":\\"Updated description\\"}"`
// Why did the `name` go back to "Demo Org"?!
// Ah! In `GeneralTab.tsx` line 18, `useEffect` was running!
// Wait! `OrgSettingsPage` re-renders or something, so `org` is unchanged, but maybe it triggered `useEffect`?
// Let's see `OrgSettingsPage`. It has `setTab`. Changing tab doesn't re-render with new org, but maybe the test does `fireEvent.change` before it fully mounts or something?
// Actually, `useEffect` runs AFTER the first render. So `useState(org.name)` initializes it. Then `useEffect` runs and sets it back to `org.name`.
// So if `fireEvent.change` happens BEFORE the `useEffect` runs (which is asynchronously scheduled), the `useEffect` will overwrite the changed value with the original `org.name`.
// Let's just make sure the `useEffect` only runs when `org.id` or `org` actually updates from the server.
// A simpler way: just remove the `useEffect` and let the parent handle keying, or rely on `setEditName` in the `handleSave` function.
// The PR comment specifically asked: "org プロップ更新時に編集用ローカルstate（name/slug/description）が追従するよう useEffect で同期処理を追加しました"
// So we *must* have the `useEffect`.
// How to fix the test? The test probably fires events immediately after `render`, before `useEffect` has a chance to execute its initial run.
// If we add `await waitFor(() => ...)` or just `await screen.findByRole("heading")` it should give `useEffect` time to run. The test DOES do `await screen.findByRole("heading", { name: "Demo Org — 設定" });`.
// So the `useEffect` SHOULD have run. Why did the change get overwritten?

// Wait, let's look at `org.name`. Is it possible `GeneralTab` is receiving `org` prop that changes?
// If `org` reference changes, `useEffect` runs. `fetchData` might be called again? No.

// Wait... in `page.tsx`, `fetchData` is called on mount.
// `fetchData` updates `setOrg`. This changes `org` reference.
// The `useEffect` in `general-tab.tsx` depends on `[org]`. It will run when `org` changes.
// If `fetchData` finishes AFTER the user starts typing?
// No, the UI isn't rendered until `fetchData` finishes because of `if (loading) return ...`.

// So why did the form submit "Demo Org" as name?
// Let's look at the test:
// fireEvent.change(screen.getByLabelText("組織名"), { target: { value: "Renamed Org" } });
// fireEvent.change(screen.getByLabelText("スラッグ"), { target: { value: "Renamed-Team!!" } });
// fireEvent.change(screen.getByLabelText("説明"), { target: { value: " Updated description " } });
// fireEvent.click(screen.getByRole("button", { name: "保存" }));
//
// In `GeneralTab`, the `onChange` for 組織名 is:
// <input ... value={editName} onChange={(e) => setEditName(e.target.value)} />
// Wait, is there a typo in `general-tab.tsx` for `editName` onChange?
