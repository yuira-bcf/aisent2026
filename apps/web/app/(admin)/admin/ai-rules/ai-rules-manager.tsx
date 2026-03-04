"use client";

import { apiFetch } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type RuleType =
  | "weight_limit"
  | "ratio_constraint"
  | "compatibility"
  | "note_balance";

type AiRule = {
  id: string;
  name: string;
  description: string | null;
  ruleType: RuleType;
  parameter: unknown;
  isActive: boolean;
  priority: number;
};

const RULE_TYPE_OPTIONS: { label: string; value: RuleType }[] = [
  { label: "重量制限", value: "weight_limit" },
  { label: "比率制約", value: "ratio_constraint" },
  { label: "相性", value: "compatibility" },
  { label: "ノートバランス", value: "note_balance" },
];

const RULE_TYPE_BADGES: Record<RuleType, string> = {
  weight_limit: "bg-amber-50 text-amber-700",
  ratio_constraint: "bg-pink-50 text-pink-700",
  compatibility: "bg-emerald-50 text-emerald-700",
  note_balance: "bg-blue-50 text-blue-700",
};

const EMPTY_FORM = {
  name: "",
  ruleType: "weight_limit" as RuleType,
  description: "",
  parameter: "",
  priority: 0,
  isActive: true,
};

export function AiRulesManager({ initialRules }: { initialRules: AiRule[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<RuleType | "ALL">("ALL");

  const filtered = initialRules.filter(
    (r) => typeFilter === "ALL" || r.ruleType === typeFilter,
  );

  function openNewForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(rule: AiRule) {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      ruleType: rule.ruleType,
      description: rule.description ?? "",
      parameter: rule.parameter ? JSON.stringify(rule.parameter, null, 2) : "",
      priority: rule.priority,
      isActive: rule.isActive,
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let parsedParam = null;
      if (form.parameter.trim()) {
        try {
          parsedParam = JSON.parse(form.parameter);
        } catch {
          alert("パラメータのJSON形式が不正です");
          setSaving(false);
          return;
        }
      }

      const payload = {
        name: form.name,
        ruleType: form.ruleType,
        description: form.description || undefined,
        parameter: parsedParam,
        priority: form.priority,
        isActive: form.isActive,
      };

      if (editingId) {
        await apiFetch(`/api/v1/admin/ai-rules/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/v1/admin/ai-rules", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      cancelForm();
      router.refresh();
    } catch {
      alert(editingId ? "更新に失敗しました" : "作成に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("このルールを削除しますか？")) return;
    setDeleting(id);
    try {
      await apiFetch(`/api/v1/admin/ai-rules/${id}`, { method: "DELETE" });
      router.refresh();
    } catch {
      alert("削除に失敗しました");
    } finally {
      setDeleting(null);
    }
  }

  async function handleToggleActive(rule: AiRule) {
    try {
      await apiFetch(`/api/v1/admin/ai-rules/${rule.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      router.refresh();
    } catch {
      alert("更新に失敗しました");
    }
  }

  return (
    <div>
      {/* Actions bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 flex-wrap">
          {(["ALL", ...RULE_TYPE_OPTIONS.map((o) => o.value)] as const).map(
            (rt) => (
              <button
                type="button"
                key={rt}
                onClick={() => setTypeFilter(rt as RuleType | "ALL")}
                className={`px-3 py-2 text-xs font-medium transition ${
                  typeFilter === rt
                    ? "bg-black text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {rt === "ALL"
                  ? "ALL"
                  : (RULE_TYPE_OPTIONS.find((o) => o.value === rt)?.label ??
                    rt)}
              </button>
            ),
          )}
        </div>
        <button
          type="button"
          onClick={openNewForm}
          className="flex items-center gap-1 bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 transition"
        >
          <span className="material-symbols-outlined text-base">add</span>
          新規追加
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="border border-gray-200 p-4 mb-6 space-y-4"
        >
          <div className="text-sm font-medium text-black mb-2">
            {editingId ? "ルールを編集" : "新しいルールを追加"}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="input-ruleName"
                className="block text-xs text-gray-500 mb-1"
              >
                ルール名
              </label>
              <input
                id="input-ruleName"
                type="text"
                required
                maxLength={100}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="input-ruleType"
                className="block text-xs text-gray-500 mb-1"
              >
                タイプ
              </label>
              <select
                id="input-ruleType"
                value={form.ruleType}
                onChange={(e) =>
                  setForm({ ...form, ruleType: e.target.value as RuleType })
                }
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              >
                {RULE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="input-priority"
                className="block text-xs text-gray-500 mb-1"
              >
                優先度
              </label>
              <input
                id="input-priority"
                type="number"
                value={form.priority}
                onChange={(e) =>
                  setForm({
                    ...form,
                    priority: Number.parseInt(e.target.value) || 0,
                  })
                }
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                  className="accent-black"
                />
                <span className="text-sm text-gray-600">有効</span>
              </label>
            </div>
          </div>
          <div>
            <label
              htmlFor="input-ruleDescription"
              className="block text-xs text-gray-500 mb-1"
            >
              説明
            </label>
            <textarea
              id="input-ruleDescription"
              maxLength={500}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={2}
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none resize-none"
            />
          </div>
          <div>
            <label
              htmlFor="input-ruleParameter"
              className="block text-xs text-gray-500 mb-1"
            >
              パラメータ (JSON)
            </label>
            <textarea
              id="input-ruleParameter"
              value={form.parameter}
              onChange={(e) => setForm({ ...form, parameter: e.target.value })}
              rows={3}
              placeholder='例: {"maxWeight": 30, "minRatio": 0.1}'
              className="w-full border border-gray-200 px-3 py-2 text-sm font-mono focus:border-black focus:outline-none resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50"
            >
              {saving ? "保存中..." : editingId ? "更新" : "追加"}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="bg-gray-100 text-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-200 transition"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="border border-gray-200">
        <div className="grid grid-cols-[1fr_0.7fr_0.4fr_0.4fr_0.6fr] gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <span>ルール名</span>
          <span>タイプ</span>
          <span>優先度</span>
          <span>状態</span>
          <span>アクション</span>
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-400">
            該当するルールが見つかりません
          </div>
        ) : (
          filtered.map((rule) => (
            <div
              key={rule.id}
              className="grid grid-cols-[1fr_0.7fr_0.4fr_0.4fr_0.6fr] gap-2 px-4 py-3 border-b border-gray-100 items-center text-sm"
            >
              <span className="font-medium text-black truncate">
                {rule.name}
              </span>
              <span>
                <span
                  className={`text-xs px-2 py-0.5 font-medium ${RULE_TYPE_BADGES[rule.ruleType]}`}
                >
                  {RULE_TYPE_OPTIONS.find((o) => o.value === rule.ruleType)
                    ?.label ?? rule.ruleType}
                </span>
              </span>
              <span className="text-xs text-gray-400">{rule.priority}</span>
              <span>
                <button
                  type="button"
                  onClick={() => handleToggleActive(rule)}
                  className={`text-xs px-2 py-0.5 font-medium cursor-pointer ${
                    rule.isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {rule.isActive ? "有効" : "無効"}
                </button>
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEditForm(rule)}
                  className="text-gray-400 hover:text-black transition"
                  title="編集"
                >
                  <span className="material-symbols-outlined text-base">
                    edit
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(rule.id)}
                  disabled={deleting === rule.id}
                  className="text-gray-400 hover:text-red-600 transition disabled:opacity-50"
                  title="削除"
                >
                  <span className="material-symbols-outlined text-base">
                    delete
                  </span>
                </button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
