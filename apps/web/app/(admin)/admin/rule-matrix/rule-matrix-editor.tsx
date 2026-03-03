"use client";

import { apiFetch } from "@/lib/api/client";
import { useMemo, useState } from "react";

type NoteType = "TOP" | "MIDDLE" | "LAST";

type Keyword = {
  id: string;
  word: string;
  category: string;
};

type Flavor = {
  id: string;
  nameJa: string;
  nameEn: string;
  noteType: NoteType;
};

type Rule = {
  id: string;
  keywordId: string;
  flavorId: string;
  weight: string;
  noteType: string;
};

const CATEGORIES = ["ALL", "SEASON", "PLACE", "MOOD", "FREE"] as const;
const PAGE_SIZE = 20;

function getWeightStyle(weight: number): React.CSSProperties {
  if (weight === 0) return { backgroundColor: "#ffffff" };
  const intensity = Math.min(weight / 10, 1);
  const gray = Math.round(255 - intensity * 200);
  return { backgroundColor: `rgb(${gray}, ${gray}, ${gray})` };
}

export function RuleMatrixEditor({
  initialKeywords,
  initialFlavors,
  initialRules,
}: {
  initialKeywords: Keyword[];
  initialFlavors: Flavor[];
  initialRules: Rule[];
}) {
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [keywordPage, setKeywordPage] = useState(0);
  const [flavorPage, setFlavorPage] = useState(0);
  const [editingCell, setEditingCell] = useState<{
    keywordId: string;
    flavorId: string;
  } | null>(null);
  const [editWeight, setEditWeight] = useState("0");
  const [saving, setSaving] = useState(false);

  const filteredKeywords = useMemo(
    () =>
      categoryFilter === "ALL"
        ? initialKeywords
        : initialKeywords.filter((k) => k.category === categoryFilter),
    [initialKeywords, categoryFilter],
  );

  const pagedKeywords = filteredKeywords.slice(
    keywordPage * PAGE_SIZE,
    (keywordPage + 1) * PAGE_SIZE,
  );
  const pagedFlavors = initialFlavors.slice(
    flavorPage * PAGE_SIZE,
    (flavorPage + 1) * PAGE_SIZE,
  );

  const totalKeywordPages = Math.max(
    1,
    Math.ceil(filteredKeywords.length / PAGE_SIZE),
  );
  const totalFlavorPages = Math.max(
    1,
    Math.ceil(initialFlavors.length / PAGE_SIZE),
  );

  const ruleMap = useMemo(() => {
    const map = new Map<string, Rule>();
    for (const r of rules) {
      map.set(`${r.keywordId}:${r.flavorId}`, r);
    }
    return map;
  }, [rules]);

  function getWeight(keywordId: string, flavorId: string): number {
    const rule = ruleMap.get(`${keywordId}:${flavorId}`);
    return rule ? Number(rule.weight) : 0;
  }

  function openEdit(keywordId: string, flavorId: string) {
    const w = getWeight(keywordId, flavorId);
    setEditingCell({ keywordId, flavorId });
    setEditWeight(String(w));
  }

  async function saveWeight() {
    if (!editingCell) return;
    setSaving(true);
    try {
      const flavor = initialFlavors.find((f) => f.id === editingCell.flavorId);
      await apiFetch("/api/v1/admin/rule-matrix", {
        method: "PUT",
        body: JSON.stringify({
          keywordId: editingCell.keywordId,
          flavorId: editingCell.flavorId,
          noteType: flavor?.noteType ?? "TOP",
          weight: Number(editWeight),
        }),
      });

      // Update local state
      const key = `${editingCell.keywordId}:${editingCell.flavorId}`;
      const newWeight = Number(editWeight);
      if (newWeight === 0) {
        setRules((prev) =>
          prev.filter((r) => `${r.keywordId}:${r.flavorId}` !== key),
        );
      } else {
        setRules((prev) => {
          const existing = prev.find(
            (r) => `${r.keywordId}:${r.flavorId}` === key,
          );
          if (existing) {
            return prev.map((r) =>
              `${r.keywordId}:${r.flavorId}` === key
                ? { ...r, weight: String(newWeight) }
                : r,
            );
          }
          return [
            ...prev,
            {
              id: `temp-${Date.now()}`,
              keywordId: editingCell.keywordId,
              flavorId: editingCell.flavorId,
              weight: String(newWeight),
              noteType: flavor?.noteType ?? "TOP",
            },
          ];
        });
      }
      setEditingCell(null);
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Category filter */}
      <div className="flex items-center gap-1 mb-4">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setCategoryFilter(cat);
              setKeywordPage(0);
            }}
            className={`px-3 py-2 text-xs font-medium transition ${
              categoryFilter === cat
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Matrix */}
      <div className="border border-gray-200 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-200 px-3 py-2 text-left text-gray-500 font-medium min-w-[120px]">
                キーワード / 香料
              </th>
              {pagedFlavors.map((f) => (
                <th
                  key={f.id}
                  className="border-b border-r border-gray-200 px-2 py-2 text-center text-gray-500 font-medium bg-gray-50 min-w-[80px]"
                  title={f.nameEn}
                >
                  <div className="truncate max-w-[80px]">{f.nameJa}</div>
                  <div
                    className={`text-[10px] mt-0.5 ${
                      f.noteType === "TOP"
                        ? "text-amber-600"
                        : f.noteType === "MIDDLE"
                          ? "text-pink-600"
                          : "text-emerald-600"
                    }`}
                  >
                    {f.noteType}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedKeywords.length === 0 ? (
              <tr>
                <td
                  colSpan={pagedFlavors.length + 1}
                  className="px-4 py-12 text-center text-sm text-gray-400"
                >
                  該当するキーワードが見つかりません
                </td>
              </tr>
            ) : (
              pagedKeywords.map((kw) => (
                <tr key={kw.id}>
                  <td className="sticky left-0 z-10 bg-white border-b border-r border-gray-200 px-3 py-2 font-medium text-black">
                    <div className="truncate max-w-[120px]">{kw.word}</div>
                    <div className="text-[10px] text-gray-400">
                      {kw.category}
                    </div>
                  </td>
                  {pagedFlavors.map((f) => {
                    const weight = getWeight(kw.id, f.id);
                    const isEditing =
                      editingCell?.keywordId === kw.id &&
                      editingCell?.flavorId === f.id;

                    return (
                      <td
                        key={f.id}
                        className="border-b border-r border-gray-100 px-1 py-1 text-center cursor-pointer hover:ring-1 hover:ring-black hover:ring-inset"
                        style={isEditing ? undefined : getWeightStyle(weight)}
                        onClick={() => !isEditing && openEdit(kw.id, f.id)}
                        title={`${kw.word} x ${f.nameJa}: ${weight}`}
                      >
                        {isEditing ? (
                          <div className="flex flex-col items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={10}
                              step={0.1}
                              value={editWeight}
                              onChange={(e) => setEditWeight(e.target.value)}
                              className="w-14 border border-black px-1 py-0.5 text-xs text-center focus:outline-none"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveWeight();
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                            />
                            <div className="flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  saveWeight();
                                }}
                                disabled={saving}
                                className="text-[10px] bg-black text-white px-1.5 py-0.5"
                              >
                                OK
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCell(null);
                                }}
                                className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5"
                              >
                                x
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span
                            className={`text-[11px] ${
                              weight > 0
                                ? weight > 5
                                  ? "text-white font-medium"
                                  : "text-gray-700"
                                : "text-gray-300"
                            }`}
                          >
                            {weight > 0 ? weight.toFixed(1) : "-"}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span>キーワード:</span>
          <button
            onClick={() => setKeywordPage((p) => Math.max(0, p - 1))}
            disabled={keywordPage === 0}
            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 transition disabled:opacity-30"
          >
            前
          </button>
          <span>
            {keywordPage + 1} / {totalKeywordPages}
          </span>
          <button
            onClick={() =>
              setKeywordPage((p) => Math.min(totalKeywordPages - 1, p + 1))
            }
            disabled={keywordPage >= totalKeywordPages - 1}
            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 transition disabled:opacity-30"
          >
            次
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span>香料:</span>
          <button
            onClick={() => setFlavorPage((p) => Math.max(0, p - 1))}
            disabled={flavorPage === 0}
            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 transition disabled:opacity-30"
          >
            前
          </button>
          <span>
            {flavorPage + 1} / {totalFlavorPages}
          </span>
          <button
            onClick={() =>
              setFlavorPage((p) => Math.min(totalFlavorPages - 1, p + 1))
            }
            disabled={flavorPage >= totalFlavorPages - 1}
            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 transition disabled:opacity-30"
          >
            次
          </button>
        </div>
      </div>
    </div>
  );
}
