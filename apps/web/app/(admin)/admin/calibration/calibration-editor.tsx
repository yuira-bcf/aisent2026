"use client";

import { apiFetch } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type CalibrationCategory =
  | "blend_weight"
  | "note_ratio"
  | "keyword_influence"
  | "flavor_selection";

type CalibrationParam = {
  id: string;
  paramName: string;
  paramValue: string;
  description: string | null;
  category: CalibrationCategory;
};

type ParamDef = {
  paramName: string;
  label: string;
  description: string;
  category: CalibrationCategory;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
};

const PARAM_DEFINITIONS: ParamDef[] = [
  // Blend Weight
  {
    paramName: "keyword_influence_base",
    label: "キーワード影響度ベース",
    description: "キーワードの基本影響力 (0-10)",
    category: "blend_weight",
    min: 0,
    max: 10,
    step: 0.1,
    defaultValue: 5.0,
  },
  {
    paramName: "creator_style_weight",
    label: "クリエイタースタイル重み",
    description: "クリエイターのスタイル設定の影響度 (0-10)",
    category: "blend_weight",
    min: 0,
    max: 10,
    step: 0.1,
    defaultValue: 3.0,
  },
  // Note Ratio
  {
    paramName: "default_top_ratio",
    label: "デフォルトTOP比率",
    description: "トップノートのデフォルト比率 (0-100%)",
    category: "note_ratio",
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 30,
  },
  {
    paramName: "default_middle_ratio",
    label: "デフォルトMIDDLE比率",
    description: "ミドルノートのデフォルト比率 (0-100%)",
    category: "note_ratio",
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 50,
  },
  {
    paramName: "default_last_ratio",
    label: "デフォルトLAST比率",
    description: "ラストノートのデフォルト比率 (0-100%)",
    category: "note_ratio",
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 20,
  },
  // Flavor Selection
  {
    paramName: "max_flavors_per_note",
    label: "ノートあたり最大香料数",
    description: "各ノートに選択される最大香料数 (1-10)",
    category: "flavor_selection",
    min: 1,
    max: 10,
    step: 1,
    defaultValue: 3,
  },
  {
    paramName: "diversity_factor",
    label: "多様性係数",
    description: "香料選択の多様性を制御 (0-1)",
    category: "flavor_selection",
    min: 0,
    max: 1,
    step: 0.01,
    defaultValue: 0.5,
  },
  // Keyword Influence
  {
    paramName: "seasonal_boost",
    label: "季節ブースト",
    description: "季節キーワードの追加影響度 (0-5)",
    category: "keyword_influence",
    min: 0,
    max: 5,
    step: 0.1,
    defaultValue: 1.5,
  },
  {
    paramName: "mood_boost",
    label: "ムードブースト",
    description: "ムードキーワードの追加影響度 (0-5)",
    category: "keyword_influence",
    min: 0,
    max: 5,
    step: 0.1,
    defaultValue: 1.0,
  },
];

const CATEGORY_LABELS: Record<CalibrationCategory, string> = {
  blend_weight: "ブレンド重み",
  note_ratio: "ノート比率",
  flavor_selection: "フレーバー選択",
  keyword_influence: "キーワード影響",
};

const CATEGORY_ORDER: CalibrationCategory[] = [
  "blend_weight",
  "note_ratio",
  "flavor_selection",
  "keyword_influence",
];

export function CalibrationEditor({
  initialParams,
}: {
  initialParams: CalibrationParam[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Build initial values from DB or defaults
  const getInitialValue = (paramName: string): number => {
    const dbParam = initialParams.find((p) => p.paramName === paramName);
    if (dbParam) return Number(dbParam.paramValue);
    const def = PARAM_DEFINITIONS.find((d) => d.paramName === paramName);
    return def?.defaultValue ?? 0;
  };

  const [values, setValues] = useState<Record<string, number>>(() => {
    const v: Record<string, number> = {};
    for (const def of PARAM_DEFINITIONS) {
      v[def.paramName] = getInitialValue(def.paramName);
    }
    return v;
  });

  function resetToDefaults() {
    const v: Record<string, number> = {};
    for (const def of PARAM_DEFINITIONS) {
      v[def.paramName] = def.defaultValue;
    }
    setValues(v);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const params = PARAM_DEFINITIONS.map((def) => ({
        paramName: def.paramName,
        paramValue: values[def.paramName],
        description: def.description,
        category: def.category,
      }));

      await apiFetch("/api/v1/admin/calibration", {
        method: "PUT",
        body: JSON.stringify({ params }),
      });
      setSaved(true);
      router.refresh();
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {CATEGORY_ORDER.map((category) => {
        const params = PARAM_DEFINITIONS.filter((d) => d.category === category);
        return (
          <div key={category}>
            <h2 className="text-sm font-bold text-black mb-4 uppercase tracking-wide">
              {CATEGORY_LABELS[category]}
            </h2>
            <div className="border border-gray-200 divide-y divide-gray-100">
              {params.map((def) => (
                <div key={def.paramName} className="px-4 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor={`input-${def.paramName}`}
                      className="text-sm font-medium text-black"
                    >
                      {def.label}
                    </label>
                    <span className="text-sm font-mono text-black tabular-nums">
                      {values[def.paramName]?.toFixed(
                        def.step < 1 ? (def.step < 0.1 ? 2 : 1) : 0,
                      )}
                    </span>
                  </div>
                  <input
                    id={`input-${def.paramName}`}
                    type="range"
                    min={def.min}
                    max={def.max}
                    step={def.step}
                    value={values[def.paramName]}
                    onChange={(e) =>
                      setValues({
                        ...values,
                        [def.paramName]: Number(e.target.value),
                      })
                    }
                    className="w-full accent-black"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {def.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-black text-white px-6 py-2 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存"}
        </button>
        <button
          type="button"
          onClick={resetToDefaults}
          className="bg-gray-100 text-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-200 transition"
        >
          デフォルトに戻す
        </button>
        {saved && (
          <span className="text-sm text-emerald-600">保存しました</span>
        )}
      </div>
    </div>
  );
}
