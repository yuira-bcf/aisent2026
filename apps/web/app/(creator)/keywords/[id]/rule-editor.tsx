"use client";

import {
  type SaveRulesState,
  saveRules,
  suggestRulesForKeyword,
} from "@/actions/creator-rules";
import type { NoteType } from "@kyarainnovate/db/schema";
import { useActionState, useState, useTransition } from "react";

type RuleInput = {
  flavorId: string;
  weight: number;
  noteType: NoteType;
};

type FlavorOption = {
  id: string;
  nameJa: string;
  nameEn: string;
  noteType: NoteType;
};

const NOTE_GROUPS: {
  noteType: NoteType;
  label: string;
  dot: string;
  color: string;
}[] = [
  {
    noteType: "TOP",
    label: "TOP ノート",
    dot: "bg-amber-500",
    color: "text-amber-500",
  },
  {
    noteType: "MIDDLE",
    label: "MIDDLE ノート",
    dot: "bg-pink-500",
    color: "text-pink-500",
  },
  {
    noteType: "LAST",
    label: "LAST ノート",
    dot: "bg-emerald-500",
    color: "text-emerald-500",
  },
];

export default function RuleEditor({
  keywordId,
  existingRules,
  allFlavors,
}: {
  keywordId: string;
  existingRules: RuleInput[];
  allFlavors: FlavorOption[];
}) {
  const [rules, setRules] = useState<RuleInput[]>(existingRules);
  const [suggesting, startSuggesting] = useTransition();
  const [message, setMessage] = useState("");

  const initialState: SaveRulesState = {};
  const [state, formAction, pending] = useActionState(saveRules, initialState);

  function addRuleForNote(noteType: NoteType) {
    const flavorsForNote = allFlavors.filter((f) => f.noteType === noteType);
    const unused = flavorsForNote.find(
      (f) => !rules.some((r) => r.flavorId === f.id),
    );
    if (!unused) return;
    setRules([...rules, { flavorId: unused.id, weight: 0.5, noteType }]);
  }

  function removeRule(index: number) {
    setRules(rules.filter((_, i) => i !== index));
  }

  function updateRule(index: number, partial: Partial<RuleInput>) {
    setRules(rules.map((r, i) => (i === index ? { ...r, ...partial } : r)));
  }

  function handleSuggest() {
    startSuggesting(async () => {
      const suggestions = await suggestRulesForKeyword(keywordId);
      if (suggestions.length > 0) {
        setRules(suggestions);
        setMessage("AIが提案を生成しました。確認して保存してください。");
      } else {
        setMessage("提案を生成できませんでした。");
      }
    });
  }

  return (
    <form
      action={(formData) => {
        formData.set("data", JSON.stringify({ keywordId, rules }));
        formAction(formData);
      }}
      className="border border-gray-200 p-6 space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-black uppercase tracking-wide">
          香料ルール
        </h2>
        <button
          type="button"
          onClick={handleSuggest}
          disabled={suggesting}
          className="px-3 py-1.5 text-xs border border-gray-200 hover:border-black transition flex items-center gap-1 disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-sm text-amber-500">
            auto_awesome
          </span>
          {suggesting ? "AI生成中..." : "AI提案"}
        </button>
      </div>

      {message && (
        <div className="text-xs text-gray-500 bg-gray-50 border border-gray-100 px-3 py-2">
          {message}
        </div>
      )}

      <div className="space-y-6">
        {NOTE_GROUPS.map(({ noteType, label, dot, color }) => {
          const groupRules = rules
            .map((r, i) => ({ ...r, originalIndex: i }))
            .filter((r) => r.noteType === noteType);
          const flavorsForNote = allFlavors.filter(
            (f) => f.noteType === noteType,
          );
          const hasUnused = flavorsForNote.some(
            (f) => !rules.some((r) => r.flavorId === f.id),
          );

          return (
            <div key={noteType}>
              <div className="flex items-center justify-between mb-2">
                <p
                  className={`text-xs font-medium tracking-wide flex items-center gap-1.5 ${color}`}
                >
                  <span className={`w-2 h-2 rounded-full ${dot}`} />
                  {label}
                  <span className="text-gray-300 font-normal">
                    ({groupRules.length})
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => addRuleForNote(noteType)}
                  disabled={!hasUnused}
                  className="px-2 py-0.5 text-xs border border-gray-200 hover:border-black transition flex items-center gap-0.5 disabled:opacity-30"
                >
                  <span className="material-symbols-outlined text-sm text-indigo-400">
                    add
                  </span>
                  追加
                </button>
              </div>

              {groupRules.length > 0 ? (
                <div className="space-y-2">
                  {groupRules.map((rule) => (
                    <div
                      key={rule.originalIndex}
                      className="flex items-center gap-3"
                    >
                      <select
                        value={rule.flavorId}
                        onChange={(e) => {
                          const selected = flavorsForNote.find(
                            (f) => f.id === e.target.value,
                          );
                          if (selected) {
                            updateRule(rule.originalIndex, {
                              flavorId: e.target.value,
                            });
                          }
                        }}
                        className="flex-1 border border-gray-200 px-2 py-2 text-sm focus:border-black focus:outline-none"
                      >
                        {flavorsForNote.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nameJa}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1">
                        <label
                          htmlFor={`input-ruleWeight-${rule.originalIndex}`}
                          className="text-xs text-gray-400"
                        >
                          重み:
                        </label>
                        <input
                          id={`input-ruleWeight-${rule.originalIndex}`}
                          type="number"
                          min={0}
                          max={1}
                          step={0.05}
                          value={rule.weight}
                          onChange={(e) =>
                            updateRule(rule.originalIndex, {
                              weight: Number.parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-16 border border-gray-200 px-2 py-2 text-sm text-center focus:border-black focus:outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeRule(rule.originalIndex)}
                        className="text-gray-300 hover:text-red-500 transition"
                      >
                        <span className="material-symbols-outlined text-base">
                          delete
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-300 py-3 text-center border border-dashed border-gray-200">
                  香料なし
                </p>
              )}
            </div>
          );
        })}

        {rules.length === 0 && (
          <p className="text-sm text-gray-300 text-center py-4">
            「AI提案」または各ノートの「追加」で香料を追加してください。
          </p>
        )}
      </div>

      {state.error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3">
          <span className="material-symbols-outlined text-base text-red-500">
            error
          </span>
          {state.error}
        </div>
      )}

      {state.success && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-4 py-3">
          <span className="material-symbols-outlined text-base text-emerald-500">
            check_circle
          </span>
          保存しました
        </div>
      )}

      <button
        type="submit"
        disabled={pending || rules.length === 0}
        className="w-full bg-black text-white py-3 text-sm font-medium tracking-wide hover:bg-gray-800 transition disabled:opacity-40"
      >
        {pending ? "保存中..." : "保存"}
      </button>
    </form>
  );
}
