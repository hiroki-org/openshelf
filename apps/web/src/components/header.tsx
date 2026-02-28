"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "./auth-provider";

export function Header() {
  const { user, loading, login, logout } = useAuth();

  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold">
            OpenShelf
          </Link>
          {user && (
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/upload"
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                アップロード
              </Link>
              <Link
                href="/invites"
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                招待
              </Link>
              <Link
                href="/settings"
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                設定
              </Link>
            </nav>
          )}
        </div>

        <div>
          {loading ? null : user ? (
            <div className="flex items-center gap-3">
              <Image
                src={user.avatarUrl}
                alt={user.name}
                width={32}
                height={32}
                className="rounded-full"
              />
              <span className="text-sm">{user.displayName ?? user.name}</span>
              <button
                onClick={logout}
                className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                ログアウト
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="rounded-md bg-gray-900 px-4 py-1.5 text-sm text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
            >
              GitHubでログイン
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
