import { describe, expect, it } from "vitest";
import {
  getInviteStatusBadge,
  getRoleBadge,
  getVisibilityBadge,
} from "../presentation";

describe("presentation badge helpers", () => {
  describe("getVisibilityBadge", () => {
    it.each([
      [
        "public",
        {
          label: "公開",
          tone: "success",
          className:
            "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
        },
      ],
      [
        "org_only",
        {
          label: "組織内",
          tone: "warning",
          className:
            "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
        },
      ],
      [
        "private",
        {
          label: "非公開",
          tone: "neutral",
          className:
            "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
        },
      ],
      [
        "limited",
        {
          label: "limited",
          tone: "neutral",
          className:
            "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
        },
      ],
    ] as const)("returns the correct badge for %s", (visibility, expected) => {
      expect(getVisibilityBadge(visibility)).toEqual(expected);
    });
  });

  describe("getInviteStatusBadge", () => {
    it.each([
      [
        "pending",
        {
          label: "保留中",
          tone: "warning",
          className:
            "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
        },
      ],
      [
        "accepted",
        {
          label: "承認済み",
          tone: "success",
          className:
            "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
        },
      ],
      [
        "declined",
        {
          label: "拒否済み",
          tone: "danger",
          className:
            "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900",
        },
      ],
      [
        "expired",
        {
          label: "expired",
          tone: "neutral",
          className:
            "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
        },
      ],
    ] as const)("returns the correct badge for %s", (status, expected) => {
      expect(getInviteStatusBadge(status)).toEqual(expected);
    });
  });

  describe("getRoleBadge", () => {
    it.each([
      [
        "owner",
        {
          label: "オーナー",
          tone: "info",
          className:
            "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900",
        },
      ],
      [
        "admin",
        {
          label: "管理者",
          tone: "warning",
          className:
            "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
        },
      ],
      [
        "member",
        {
          label: "メンバー",
          tone: "neutral",
          className:
            "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
        },
      ],
      [
        "uploader",
        {
          label: "アップロード者",
          tone: "info",
          className:
            "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900",
        },
      ],
      [
        "author",
        {
          label: "著者",
          tone: "success",
          className:
            "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
        },
      ],
      [
        "reviewer",
        {
          label: "reviewer",
          tone: "neutral",
          className:
            "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
        },
      ],
    ] as const)("returns the correct badge for %s", (role, expected) => {
      expect(getRoleBadge(role)).toEqual(expected);
    });
  });
});
