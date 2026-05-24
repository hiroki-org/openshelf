"use client";

import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getInviteStatusBadge } from "@/lib/presentation";
import { Spinner } from "@/components/spinner";
import { toast } from "@/components/toast";

type ReceivedInvite = {
  id: string;
  paperId: string;
  paperTitle: string;
  inviterId: string;
  inviterName: string;
  status: string;
  createdAt: string;
};

type InviteAction = "accept" | "decline";

export default function InvitesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [invites, setInvites] = useState<ReceivedInvite[]>([]);
  const [fetching, setFetching] = useState(true);
  const [processingById, setProcessingById] = useState<Map<string, InviteAction>>(
    () => new Map(),
  );

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

  const respond = async (inviteId: string, action: InviteAction) => {
    setProcessingById((current) => {
      const next = new Map(current);
      next.set(inviteId, action);
      return next;
    });
    try {
      const res = await apiFetch(
        `/api/invites/${encodeURIComponent(inviteId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      if (res.ok) {
        setInvites((prev) =>
          prev.map((i) =>
            i.id === inviteId
              ? { ...i, status: action === "accept" ? "accepted" : "declined" }
              : i,
          ),
        );
        toast.success(action === "accept" ? "招待を承認しました" : "招待を拒否しました");
      } else {
        toast.error("処理に失敗しました");
      }
    } catch (err) {
      console.error(`Failed to ${action} invite ${inviteId}:`, err);
      toast.error("ネットワークエラーが発生しました");
      // Keep UI state unchanged when request fails.
    } finally {
      setProcessingById((current) => {
        const next = new Map(current);
        next.delete(inviteId);
        return next;
      });
    }
  };

  if (loading || !user) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← ダッシュボードに戻る
        </Link>
      </div>

      <div className="mb-8 rounded-3xl border border-gray-200 bg-white px-6 py-6 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Invites
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950 dark:text-gray-50">
              共著者招待
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">
              成果物への招待を確認し、必要に応じて承認または拒否できます。
              研究成果物への参加依頼を落ち着いて整理できる画面です。
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            <p className="font-medium text-gray-900 dark:text-gray-100">
              受信件数
            </p>
            <p className="mt-1">{invites.length} 件</p>
          </div>
        </div>
      </div>

      {fetching ? (
        <div className="rounded-3xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            読み込み中...
          </p>
        </div>
      ) : invites.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-6 py-14 text-center dark:border-gray-700 dark:bg-gray-900/60">
          <div className="mx-auto max-w-md">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              招待はありません
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
              新しい共著者招待が届くと、この画面に一覧で表示されます。
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-4">
          {invites.map((inv) => {
            const processingAction = processingById.get(inv.id);
            const isProcessing = processingAction !== undefined;

            return (
              <li
                key={inv.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950"
              >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
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
                  </div>

                  <Link
                    href={`/papers/${inv.paperId}`}
                    className="mt-3 block text-base font-semibold text-gray-950 transition-colors hover:text-gray-700 hover:underline dark:text-gray-50 dark:hover:text-gray-200"
                  >
                    {inv.paperTitle}
                  </Link>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {inv.inviterName} からの招待
                  </p>
                </div>

                {inv.status === "pending" ? (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => respond(inv.id, "accept")}
                      disabled={isProcessing}
                      aria-busy={processingAction === "accept"}
                      className="inline-flex min-w-[72px] items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                    >
                      {processingAction === "accept" && (
                        <Spinner />
                      )}
                      <span className={processingAction === "accept" ? "sr-only" : undefined}>
                        承認
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => respond(inv.id, "decline")}
                      disabled={isProcessing}
                      aria-busy={processingAction === "decline"}
                      className="inline-flex min-w-[72px] items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
                    >
                      {processingAction === "decline" && (
                        <Spinner />
                      )}
                      <span className={processingAction === "decline" ? "sr-only" : undefined}>
                        拒否
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="shrink-0 text-xs text-gray-400">対応済み</div>
                )}
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
