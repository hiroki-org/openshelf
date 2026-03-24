"use client";

import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FileDropzone, type FileEntry } from "@/components/upload/file-dropzone";

const VISIBILITY_OPTIONS = [
  { value: "private", label: "非公開" },
  { value: "org_only", label: "組織内" },
  { value: "public", label: "公開" },
] as const;
const CATEGORY_OPTIONS = [
  { value: "", label: "（なし）" },
  { value: "thesis_bachelor", label: "学士論文" },
  { value: "thesis_master", label: "修士論文" },
  { value: "report", label: "レポート" },
  { value: "presentation", label: "プレゼンテーション" },
  { value: "other", label: "その他" },
] as const;
const VENUE_TYPE_OPTIONS = [
  { value: "", label: "（なし）" },
  { value: "conference", label: "学会" },
  { value: "journal", label: "ジャーナル" },
  { value: "workshop", label: "ワークショップ" },
  { value: "other", label: "その他" },
] as const;


type Organization = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

export default function UploadPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [visibility, setVisibility] =
    useState<(typeof VISIBILITY_OPTIONS)[number]["value"]>("private");
  const [showViewCount, setShowViewCount] = useState(false);
  const [venue, setVenue] = useState("");
  const [venueType, setVenueType] = useState("");
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (!loading && user) {
      const fetchOrganizations = async () => {
        setLoadingOrgs(true);
        try {
          const res = await apiFetch("/api/users/me/orgs");
          if (res.ok) {
            const data = await res.json();
            setOrganizations(data.organizations);
          } else {
            setError("組織情報の取得中にサーバーエラーが発生しました。ページを再読み込みしてください。");
          }
        } catch {
          setError("組織情報の取得中にネットワークまたは予期しないエラーが発生しました。ページを再読み込みしてください。");
        } finally {
          setLoadingOrgs(false);
        }
      };
      fetchOrganizations();
    }
  }, [loading, user]);

  if (loading || !user) return null;

  const addFiles = (selected: FileList | null) => {
    if (!selected) return;
    const newEntries: FileEntry[] = Array.from(selected).map((f) => ({
      file: f,
      fileType: "paper",
    }));
    setFiles((prev) => [...prev, ...newEntries]);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateFileType = (idx: number, newType: FileEntry["fileType"]) => {
    setFiles((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], fileType: newType };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("タイトルは必須です");
      return;
    }
    if (files.length === 0) {
      setError("ファイルを1つ以上添付してください");
      return;
    }
    if (visibility === "org_only") {
      if (loadingOrgs) {
        setError("組織を読み込み中です。しばらくお待ちください");
        return;
      }
      if (organizations.length === 0) {
        setError("組織がありません。別の公開範囲を選択してください");
        return;
      }
      if (!selectedOrgId) {
        setError("組織を選択してください");
        return;
      }
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append(
        "metadata",
        JSON.stringify({
          title: title.trim(),
          abstract: abstract.trim() || null,
          visibility,
          showViewCount,
          venue: venue.trim() || null,
          venueType: venueType || null,
          year: year ? Number(year) : null,
          category: category || null,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          ...(visibility === "org_only" && selectedOrgId
            ? { orgId: selectedOrgId }
            : {}),
        }),
      );

      files.forEach((entry, i) => {
        formData.append(`files_${i}`, entry.file);
        formData.append(`file_types_${i}`, entry.fileType);
      });

      const res = await apiFetch("/api/papers", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/papers/${data.paper.id}`);
        return;
      }

      const data = await res.json();
      setError(data.error ?? "アップロードに失敗しました");
    } catch {
      setError("ネットワークエラーが発生しました");
    } finally {
      setUploading(false);
    }
  };

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
              Upload
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950 dark:text-gray-50">
              論文アップロード
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">
              タイトルや公開範囲、関連ファイルをまとめて登録します。必要な情報から順に入力できるよう、
              セクションごとに整理しています。
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            <p className="font-medium text-gray-900 dark:text-gray-100">
              添付ファイル
            </p>
            <p className="mt-1">{files.length} 件選択中</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
          著者最終稿（Author Accepted Manuscript）をアップロードしてください。
          出版社版のアップロードは著作権上の問題がある場合があります。
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="paper-title">
            タイトル <span className="text-red-500">*</span>
          </Label>
          <Input id="paper-title" type="text" maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div>
          <Label htmlFor="paper-abstract">
            概要
          </Label>
          <Textarea id="paper-abstract" value={abstract} onChange={(e) => setAbstract(e.target.value)} rows={4} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="paper-visibility">
              公開範囲
            </Label>
            <Select id="paper-visibility" value={visibility} onChange={(e) =>
                setVisibility(
                  e.target
                    .value as (typeof VISIBILITY_OPTIONS)[number]["value"],
                )
              }>
              {VISIBILITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="paper-year">
              発表年
            </Label>
            <Input id="paper-year" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
        </div>

        {visibility === "org_only" && (
          <div>
            <Label htmlFor="paper-organization">
              対象組織 <span className="text-red-500">*</span>
            </Label>
            <Select id="paper-organization" value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)} disabled={loadingOrgs || organizations.length === 0}>
              <option value="">
                {loadingOrgs
                  ? "読み込み中..."
                  : organizations.length === 0
                    ? "組織がありません"
                    : "組織を選択してください"}
              </option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-900/40">
          <label
            htmlFor="paper-show-view-count"
            className="flex items-start gap-3"
          >
            <input
              id="paper-show-view-count"
              type="checkbox"
              checked={showViewCount}
              onChange={(e) => setShowViewCount(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-950 focus:ring-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                公開ページに閲覧数を表示する
              </span>
              <span className="block text-xs leading-5 text-gray-600 dark:text-gray-400">
                著者向けの閲覧統計は常に内部で記録されます。ここをオンにした場合のみ、詳細ページに総閲覧数を公開表示します。
              </span>
            </span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="paper-venue">
              会場名
            </Label>
            <Input id="paper-venue" type="text" value={venue} onChange={(e) => setVenue(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="paper-venue-type">
              会場種別
            </Label>
            <Select id="paper-venue-type" value={venueType} onChange={(e) => setVenueType(e.target.value)}>
              {VENUE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="paper-category">
            カテゴリ
          </Label>
          <Select id="paper-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="paper-tags">
            タグ（カンマ区切り）
          </Label>
          <Input id="paper-tags" type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="例: NLP, LLM, attention" />
        </div>

        {/* File uploads */}
        <FileDropzone
          files={files}
          onAddFiles={addFiles}
          onRemoveFile={removeFile}
          onUpdateFileType={handleUpdateFileType}
        />



        {error && (
          <div data-testid="org-selection-error" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex min-w-48 items-center justify-center rounded-xl bg-gray-950 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2 disabled:opacity-50 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200 dark:focus:ring-white dark:focus:ring-offset-gray-950"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                アップロード中...
              </span>
            ) : (
              "論文をアップロードする"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
