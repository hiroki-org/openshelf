import Image from "next/image";
import { Member } from "../types";

type MemberListProps = {
  members: Member[];
};

export function MemberList({ members }: MemberListProps) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-3">メンバー</h2>
      {members.length === 0 ? (
        <p className="text-sm text-gray-500">メンバーがいません</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {members.map((m) => (
            <div
              key={m.userId}
              className="flex items-center gap-2 text-sm rounded-md border p-2 dark:border-gray-700"
            >
              {m.avatarUrl && (
                <Image
                  src={m.avatarUrl}
                  alt={m.name}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              )}
              <span>{m.displayName ?? m.name}</span>
              <span className="text-xs text-gray-400 rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800">
                {m.role}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
