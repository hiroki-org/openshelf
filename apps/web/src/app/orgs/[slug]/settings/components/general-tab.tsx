import { Dispatch, SetStateAction } from "react";
import { Org } from "../types";

type GeneralFormState = {
  editName: string;
  editSlug: string;
  editDescription: string;
  saveMsg: string;
  saving: boolean;
};

type GeneralFormActions = {
  setEditName: Dispatch<SetStateAction<string>>;
  setEditSlug: Dispatch<SetStateAction<string>>;
  setEditDescription: Dispatch<SetStateAction<string>>;
  handleSave: () => Promise<void>;
};

type DeleteDialogState = {
  showDelete: boolean;
  deleteConfirm: string;
  deleting: boolean;
};

type DeleteDialogActions = {
  setShowDelete: Dispatch<SetStateAction<boolean>>;
  setDeleteConfirm: Dispatch<SetStateAction<string>>;
  handleDelete: () => Promise<void>;
};

type GeneralTabProps = {
  org: Org;
  formState: GeneralFormState;
  formActions: GeneralFormActions;
  deleteState: DeleteDialogState;
  deleteActions: DeleteDialogActions;
};

export function GeneralTab({
  org,
  formState,
  formActions,
  deleteState,
  deleteActions,
}: GeneralTabProps) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="org-edit-name" className="block text-sm font-medium mb-1">
          組織名
        </label>
        <input
          id="org-edit-name"
          type="text"
          maxLength={100}
          value={formState.editName}
          onChange={(e) => formActions.setEditName(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
      </div>
      <div>
        <label htmlFor="org-edit-slug" className="block text-sm font-medium mb-1">
          スラッグ
        </label>
        <input
          id="org-edit-slug"
          type="text"
          maxLength={40}
          value={formState.editSlug}
          onChange={(e) =>
            formActions.setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
          }
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
      </div>
      <div>
        <label htmlFor="org-edit-description" className="block text-sm font-medium mb-1">
          説明
        </label>
        <textarea
          id="org-edit-description"
          value={formState.editDescription}
          onChange={(e) => formActions.setEditDescription(e.target.value)}
          rows={3}
          maxLength={500}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
      </div>

      {formState.saveMsg && <p className="text-sm text-gray-600">{formState.saveMsg}</p>}

      <button
        type="button"
        onClick={formActions.handleSave}
        disabled={formState.saving}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
      >
        {formState.saving ? "保存中..." : "保存"}
      </button>

      {/* Danger zone */}
      <div className="mt-10 rounded-md border border-red-300 p-4 dark:border-red-700">
        <h3 className="text-sm font-medium text-red-600 mb-2">Danger Zone</h3>
        <p className="text-xs text-gray-500 mb-3">
          組織を削除すると、メンバー情報と論文の紐づけが全て削除されます。
        </p>
        {!deleteState.showDelete ? (
          <button
            type="button"
            onClick={() => deleteActions.setShowDelete(true)}
            className="rounded-md border border-red-500 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          >
            組織を削除
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-red-600">
              確認のため「<strong>{org.slug}</strong>」を入力してください。
            </p>
            <input
              type="text"
              value={deleteState.deleteConfirm}
              onChange={(e) => deleteActions.setDeleteConfirm(e.target.value)}
              aria-label="削除確認のためスラッグを入力"
              className="w-full rounded-md border border-red-300 px-3 py-2 text-sm dark:border-red-700 dark:bg-gray-900"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={deleteActions.handleDelete}
                disabled={deleteState.deleting || deleteState.deleteConfirm !== org.slug}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deleteState.deleting ? "削除中..." : "完全に削除する"}
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteActions.setShowDelete(false);
                  deleteActions.setDeleteConfirm("");
                }}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
