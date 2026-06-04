import { getInviteStatusBadge } from "@/lib/presentation";
import { Invite } from "../types";

type PaperPendingInvitesProps = {
  isUploader: boolean;
  invites: Invite[];
};

export function PaperPendingInvites({
  isUploader,
  invites,
}: PaperPendingInvitesProps) {
  if (!isUploader || invites.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-sm font-medium text-gray-500 mb-2">招待状況</h2>
      <ul className="space-y-1">
        {invites.map((inv) => (
          <li
            key={inv.id}
            className="flex items-center justify-between text-sm border rounded-md p-2 dark:border-gray-700"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {inv.inviteeName}
              </span>
            </div>
            {(() => {
              const badge = getInviteStatusBadge(inv.status);
              return (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
                >
                  {badge.label}
                </span>
              );
            })()}
          </li>
        ))}
      </ul>
    </div>
  );
}
