"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";

const navItems = [
  { href: "/upload", label: "アップロード" },
  { href: "/collections/new", label: "コレクション" },
  { href: "/invites", label: "招待" },
  { href: "/settings", label: "設定" },
] as const;

export function Header() {
  const { user, loading, login, logout } = useAuth();
  const pathname = usePathname();

  return (
    <header className="border-b border-gray-200/80 bg-white/90 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/90">
      <div className="mx-auto flex min-h-16 max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-6">
          <Link
            href="/"
            className="text-base font-semibold tracking-tight text-gray-950 transition-colors hover:text-gray-700 dark:text-gray-50 dark:hover:text-gray-300"
          >
            OpenShelf
          </Link>
          {user && (
            <nav className="flex flex-wrap items-center gap-1 text-sm">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`rounded-full px-3 py-1.5 transition-colors ${
                      isActive
                        ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
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
                className="rounded-full ring-1 ring-gray-200 dark:ring-gray-700"
              />
              <div className="flex flex-col items-end text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {user.displayName ?? user.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  @{user.name}
                </p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-gray-50"
              >
                ログアウト
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={login}
              className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
            >
              GitHubでログイン
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
