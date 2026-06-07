type AutocompleteDropdownProps = {
  listId: string;
  suggestions: string[];
  highlightedIndex: number;
  onSelect: (suggestion: string) => void;
};

export function AutocompleteDropdown({
  listId,
  suggestions,
  highlightedIndex,
  onSelect,
}: AutocompleteDropdownProps) {
  if (suggestions.length === 0) return null;

  return (
    <ul
      id={listId}
      role="listbox"
      className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-300 bg-white py-1 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900"
    >
      {suggestions.map((suggestion, index) => (
        <li
          key={`${suggestion}-${index}`}
          id={`${listId}-option-${index}`}
          role="option"
          aria-selected={index === highlightedIndex}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect(suggestion)}
          className={`cursor-pointer px-3 py-2 ${
            index === highlightedIndex
              ? "bg-gray-100 dark:bg-gray-800"
              : "hover:bg-gray-50 dark:hover:bg-gray-800/80"
          }`}
        >
          {suggestion}
        </li>
      ))}
    </ul>
  );
}
