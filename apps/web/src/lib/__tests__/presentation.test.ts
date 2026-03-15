import { describe, expect, it } from "vitest";
import {
  getInviteStatusBadge,
  getRoleBadge,
  getVisibilityBadge,
} from "../presentation";

describe("presentation badge helpers", () => {
  describe("getVisibilityBadge", () => {
    it("returns a public badge", () => {
      expect(getVisibilityBadge("public")).toEqual({
        label: "公開",
        tone: "success",
        className:
          "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
      });
    });

    it("returns an org-only badge", () => {
      expect(getVisibilityBadge("org_only")).toEqual({
        label: "組織内",
        tone: "warning",
        className:
          "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
      });
    });

    it("returns a private badge", () => {
      expect(getVisibilityBadge("private")).toEqual({
        label: "非公開",
        tone: "neutral",
        className:
          "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
      });
    });

    it("falls back to the raw label for unknown visibility", () => {
      expect(getVisibilityBadge("limited")).toEqual({
        label: "limited",
        tone: "neutral",
        className:
          "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
      });
    });
  });

  describe("getInviteStatusBadge", () => {
    it("returns a pending badge", () => {
      expect(getInviteStatusBadge("pending")).toEqual({
        label: "保留中",
        tone: "warning",
        className:
          "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
      });
    });

    it("returns an accepted badge", () => {
      expect(getInviteStatusBadge("accepted")).toEqual({
        label: "承認済み",
        tone: "success",
        className:
          "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
      });
    });

    it("returns a declined badge", () => {
      expect(getInviteStatusBadge("declined")).toEqual({
        label: "拒否済み",
        tone: "danger",
        className:
          "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900",
      });
    });

    it("falls back to a neutral badge for unknown invite status", () => {
      expect(getInviteStatusBadge("expired")).toEqual({
        label: "expired",
        tone: "neutral",
        className:
          "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
      });
    });

    it("returns a neutral badge for uppercase pending", () => {
      expect(getInviteStatusBadge("PENDING")).toEqual({
        label: "PENDING",
        tone: "neutral",
        className:
          "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
      });
    });

    it("returns a neutral badge for an empty string", () => {
      expect(getInviteStatusBadge("")).toEqual({
        label: "",
        tone: "neutral",
        className:
          "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
      });
    });
  });

  describe("getRoleBadge", () => {
    it("returns an owner badge", () => {
      expect(getRoleBadge("owner")).toEqual({
        label: "オーナー",
        tone: "info",
        className:
          "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900",
      });
    });

    it("returns an admin badge", () => {
      expect(getRoleBadge("admin")).toEqual({
        label: "管理者",
        tone: "warning",
        className:
          "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
      });
    });

    it("returns a member badge", () => {
      expect(getRoleBadge("member")).toEqual({
        label: "メンバー",
        tone: "neutral",
        className:
          "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
      });
    });

    it("returns an uploader badge", () => {
      expect(getRoleBadge("uploader")).toEqual({
        label: "アップロード者",
        tone: "info",
        className:
          "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900",
      });
    });

    it("returns an author badge", () => {
      expect(getRoleBadge("author")).toEqual({
        label: "著者",
        tone: "success",
        className:
          "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
      });
    });

    it("falls back to a neutral badge for unknown roles", () => {
      expect(getRoleBadge("reviewer")).toEqual({
        label: "reviewer",
        tone: "neutral",
        className:
          "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
      });
    });
  });
});
