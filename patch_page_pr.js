const fs = require('fs');

let code = fs.readFileSync('apps/web/src/app/orgs/[slug]/settings/page.tsx', 'utf8');

// Move executeApiAction outside of the component
// 1. extract helper
const helperMatch = code.match(/  \/\/ ── Helper ──\n  const executeApiAction = async \([\s\S]+?\n  \};\n/);
if (helperMatch) {
  const helperCode = helperMatch[0].replace(/^  /gm, ''); // remove indentation
  code = code.replace(helperMatch[0], '');

  // Insert before export default function OrgSettingsPage
  code = code.replace(
    'export default function OrgSettingsPage() {',
    helperCode + '\nexport default function OrgSettingsPage() {'
  );
}

// 2. Add updatingMemberId and removingMemberId states
code = code.replace(
  /  const \[inviting, setInviting\] = useState\(false\);\n/,
  `  const [inviting, setInviting] = useState(false);\n  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);\n  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);\n`
);

// 3. Update handleChangeRole
code = code.replace(
  /  const handleChangeRole = async \(userId: string, newRole: string\) => \{\n    await executeApiAction\(\n      \(\) =>\n        apiFetch\(\n          `\/api\/orgs\/\$\{encodeURIComponent\(slug\)\}\/members\/\$\{encodeURIComponent\(userId\)\}`,\n          \{\n            method: "PATCH",\n            headers: \{ "Content-Type": "application\/json" \},\n            body: JSON\.stringify\(\{ role: newRole \}\),\n          \}\n        \),\n      fetchData,\n      "変更に失敗しました"\n    \);\n  \};/,
  `  const handleChangeRole = async (userId: string, newRole: string) => {
    setUpdatingMemberId(userId);
    await executeApiAction(
      () =>
        apiFetch(
          \`/api/orgs/\${encodeURIComponent(slug)}/members/\${encodeURIComponent(userId)}\`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: newRole }),
          }
        ),
      fetchData,
      "変更に失敗しました"
    );
    setUpdatingMemberId(null);
  };`
);

// 4. Update handleRemoveMember
code = code.replace(
  /  const handleRemoveMember = async \(userId: string\) => \{\n    if \(!confirm\("このメンバーを削除しますか？"\)\) return;\n    await executeApiAction\(\n      \(\) =>\n        apiFetch\(\n          `\/api\/orgs\/\$\{encodeURIComponent\(slug\)\}\/members\/\$\{encodeURIComponent\(userId\)\}`,\n          \{\n            method: "DELETE",\n          \}\n        \),\n      fetchData,\n      "削除に失敗しました"\n    \);\n  \};/,
  `  const handleRemoveMember = async (userId: string) => {
    if (!confirm("このメンバーを削除しますか？")) return;
    setRemovingMemberId(userId);
    await executeApiAction(
      () =>
        apiFetch(
          \`/api/orgs/\${encodeURIComponent(slug)}/members/\${encodeURIComponent(userId)}\`,
          {
            method: "DELETE",
          }
        ),
      fetchData,
      "削除に失敗しました"
    );
    setRemovingMemberId(null);
  };`
);

// 5. Update UI for role select and delete button in members tab
code = code.replace(
  /                  <select\n                    value=\{m\.role === "owner" \? "admin" : m\.role\}\n                    onChange=\{\(e\) => handleChangeRole\(m\.userId, e\.target\.value\)\}\n                    disabled=\{m\.userId === user\?\.id\}\n                    className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"\n                  >/,
  `                  <select
                    value={m.role === "owner" ? "admin" : m.role}
                    onChange={(e) => handleChangeRole(m.userId, e.target.value)}
                    disabled={m.userId === user?.id || updatingMemberId === m.userId || removingMemberId === m.userId}
                    className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900 disabled:opacity-50"
                  >`
);

code = code.replace(
  /                  \{m\.userId !== user\?\.id && \(\n                    <button\n                      type="button"\n                      onClick=\{\(\) => handleRemoveMember\(m\.userId\)\}\n                      className="text-red-500 hover:text-red-700 text-xs"\n                    >\n                      削除\n                    <\/button>\n                  \)\}/,
  `                  {m.userId !== user?.id && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.userId)}
                      disabled={removingMemberId === m.userId || updatingMemberId === m.userId}
                      className="text-red-500 hover:text-red-700 text-xs disabled:opacity-50"
                    >
                      {removingMemberId === m.userId ? "削除中..." : "削除"}
                    </button>
                  )}`
);


fs.writeFileSync('apps/web/src/app/orgs/[slug]/settings/page.tsx', code);
