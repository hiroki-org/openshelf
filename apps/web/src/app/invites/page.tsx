"use client";

import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ReceivedInvite = {
  id: string;
  paperId: string;
  paperTitle: string;
  inviterId: string;
  inviterName: string;
  status: string;
  createdAt: string;
};

export default function InvitesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [invites, setInvites] = useState<ReceivedInvite[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setFetching(true);
    (async () => {
      try {
        const r = await apiFetch("/api/invites/received");
        if (!r.ok) {
          if (!cancelled) setInvites([]);
          return;
        }
        const d = await r.json();
        if (!cancelled) setInvites(d.invites ?? []);
      } catch (err) {
        console.error("Failed to fetch invites:", err);
        if (!cancelled) setInvites([]);
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const respond = async (inviteId: string, action: "accept" | "decline") => {
    try {
      const res = await apiFetch(`/api/invites/${inviteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setInvites((prev) =>
          prev.map((i) =>
            i.id === inviteId
              ? { ...i, status: action === "accept" ? "accepted" : "declined" }
              : i,
          ),
        );
      }
    } catch (err) {
      console.error(`Failed to ${action} invite ${inviteId}:`, err);
      // Keep UI state unchanged when request fails.
    }
  };

  if (loading || !user) return null;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">共著者招待</h1>

      {fetching ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : invites.length === 0 ? (
        <p className="text-gray-500 py-8 text-center">招待はありません</p>
      ) : (
        <ul className="space-y-3">
          {invites.map((inv) => (
            <li
              key={inv.id}
              className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
            >
              <div className="flex items-center justify-between">
                <div>
                  <Link
                    href={`/papers/${inv.paperId}`}
                    className="font-medium hover:underline"
                  >
                    {inv.paperTitle}
                  </Link>
                  <p className="text-sm text-gray-500">
                    {inv.inviterName} からの招待
                  </p>
                </div>
                {inv.status === "pending" ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => respond(inv.id, "accept")}
                      className="rounded-md bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-500"
                    >
                      承認
                    </button>
                    <button
                      type="button"
                      onClick={() => respond(inv.id, "decline")}
                      className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                      拒否
                    </button>
                  </div>
                ) : (
                  <span
                    className={`text-xs rounded px-2 py-1 ${
                      inv.status === "accepted"
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                    }`}
                  >
                    {inv.status === "accepted" ? "承認済み" : "拒否済み"}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
