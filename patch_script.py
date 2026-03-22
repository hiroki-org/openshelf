import re

with open('apps/web/src/components/papers/edit-form.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace tag initialization with lazy initialization
old_tags_init = """  let initialTags = "";
  if (initialData.tags) {
    try {
      const parsed = JSON.parse(initialData.tags);
      if (Array.isArray(parsed)) {
        initialTags = parsed.join(", ");
      }
    } catch {
      initialTags = String(initialData.tags);
    }
  }
  const [tagsStr, setTagsStr] = useState(initialTags);"""

new_tags_init = """  const [tagsStr, setTagsStr] = useState(() => {
    if (!initialData.tags) return "";
    try {
      const parsed = JSON.parse(initialData.tags);
      if (Array.isArray(parsed)) {
        return parsed.join(", ");
      }
      return String(parsed);
    } catch {
      return String(initialData.tags);
    }
  });"""

content = content.replace(old_tags_init, new_tags_init)

# Add title/abstract validation lengths
old_validation = """  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("タイトルを入力してください。");
      return;
    }"""

new_validation = """  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("タイトルを入力してください。");
      return;
    }
    if (trimmedTitle.length > 300) {
      setError("タイトルは300文字以内で入力してください。");
      return;
    }

    if (abstract && abstract.trim().length > 5000) {
      setError("概要は5000文字以内で入力してください。");
      return;
    }"""

content = content.replace(old_validation, new_validation)

# Add maxLength to inputs
content = content.replace(
    """            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
            placeholder="論文のタイトル"
          />""",
    """            onChange={(e) => setTitle(e.target.value)}
            maxLength={300}
            className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
            placeholder="論文のタイトル"
          />"""
)

content = content.replace(
    """            onChange={(e) => setAbstract(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
            placeholder="アブストラクト..."
          />""",
    """            onChange={(e) => setAbstract(e.target.value)}
            rows={4}
            maxLength={5000}
            className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
            placeholder="アブストラクト..."
          />"""
)

with open('apps/web/src/components/papers/edit-form.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
