type TagChipsProps = {
  tags: string[];
};

export function TagChips({ tags }: TagChipsProps) {
  if (tags.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {tags.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
