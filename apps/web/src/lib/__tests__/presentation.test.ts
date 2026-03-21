import { describe, expect, it } from "vitest";
import {
  getInviteStatusBadge,
  getRoleBadge,
  getVisibilityBadge,
} from "../presentation";

const toneClassNames = {
  neutral: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
  warning: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
  danger: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900",
  info: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900",
};

describe("presentation badge helpers", () => {
  describe("getVisibilityBadge", () => {
    it.each([
      ["public", "公開", "success"],
      ["org_only", "組織内", "warning"],
      ["private", "非公開", "neutral"],
      ["limited", "限定公開", "neutral"],
    ] as const)("returns correct badge for %s", (visibility, label, tone) => {
      expect(getVisibilityBadge(visibility)).toEqual({
        label,
        tone,
        className: toneClassNames[tone],
      });
    });
  });

  describe("getInviteStatusBadge", () => {
    it.each([
      ["pending", "保留中", "warning"],
      ["accepted", "承認済み", "success"],
      ["declined", "拒否済み", "danger"],
    ] as const)("returns correct badge for %s", (status, label, tone) => {
      expect(getInviteStatusBadge(status)).toEqual({
        label,
        tone,
        className: toneClassNames[tone],
      });
    });

    describe("fallback / edge cases", () => {
      it.each([
        ["expired", "expired", "neutral"],
        ["PENDING", "PENDING", "neutral"],
        ["", "", "neutral"],
      ] as const)(
        "returns neutral fallback badge for %s status",
        (status, label, tone) => {
          expect(getInviteStatusBadge(status)).toEqual({
            label,
            tone,
            className: toneClassNames[tone],
          });
        },
      );
    });
  });

  describe("getRoleBadge", () => {
    it.each([
      ["owner", "オーナー", "info"],
      ["admin", "管理者", "warning"],
      ["member", "メンバー", "neutral"],
      ["uploader", "アップロード者", "info"],
      ["author", "著者", "success"],
    ] as const)("returns correct badge for %s", (role, label, tone) => {
      expect(getRoleBadge(role)).toEqual({
        label,
        tone,
        className: toneClassNames[tone],
      });
    });

    it.each([
      ["reviewer", "reviewer", "neutral"],
      ["unknown_role", "unknown_role", "neutral"],
      ["", "", "neutral"],
    ] as const)(
      "falls back to the input label for %s when role is not recognized",
      (role, label, tone) => {
        expect(getRoleBadge(role)).toEqual({
          label,
          tone,
          className: toneClassNames[tone],
        });
      },
    );
  });
});
