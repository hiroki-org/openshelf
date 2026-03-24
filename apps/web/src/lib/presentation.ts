export type Tone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info";

export type BadgePresentation = {
  label: string;
  tone: Tone;
  className: string;
};

const toneClassNames: Record<Tone, string> = {
  neutral:
    "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  success:
    "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
  warning:
    "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
  danger:
    "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900",
  info: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900",
};

function createBadge(label: string, tone: Tone): BadgePresentation {
  return {
    label,
    tone,
    className: toneClassNames[tone],
  };
}

export function getVisibilityBadge(visibility: string): BadgePresentation {
  switch (visibility) {
    case "public":
      return createBadge("公開", "success");
    case "org_only":
      return createBadge("組織内", "warning");
    case "private":
      return createBadge("非公開", "neutral");
    case "limited":
      return createBadge("限定公開", "neutral");
    default:
      return createBadge(visibility, "neutral");
  }
}

export function getInviteStatusBadge(status: string): BadgePresentation {
  switch (status) {
    case "pending":
      return createBadge("保留中", "warning");
    case "accepted":
      return createBadge("承認済み", "success");
    case "declined":
      return createBadge("拒否済み", "danger");
    default:
      return createBadge(status, "neutral");
  }
}

export function getRoleBadge(role: string): BadgePresentation {
  switch (role) {
    case "owner":
      return createBadge("オーナー", "info");
    case "admin":
      return createBadge("管理者", "warning");
    case "member":
      return createBadge("メンバー", "neutral");
    case "uploader":
      return createBadge("アップロード者", "info");
    case "author":
      return createBadge("著者", "success");
    default:
      return createBadge(role, "neutral");
  }
}
