---
description: テスト方針・Vitest の使い方
globs: ["**/*.test.ts", "**/*.test.tsx"]
---

# テストルール

## テストフレームワーク
- ユニットテスト: Vitest 3
- E2Eテスト: Playwright（未導入、Phase 2以降）

## テストファイル配置
- `apps/web/__tests__/` 配下に配置
- ファイル名: `{対象名}.test.ts`

## 既存テスト
- `blend-calculator.test.ts` — 調合計算アルゴリズム（39ケース）
- `blend-calculator-edge.test.ts` — エッジケース（13ケース）
- `api-blend-calculate.test.ts` — API エンドポイントテスト

## テスト記述ルール
- `describe` でテスト対象をグループ化
- `it` で具体的な期待動作を記述（日本語OK）
- 計算結果の検証には `Decimal.js` を使用（浮動小数点誤差回避）
- モック: Vitest の `vi.mock()` を使用

## テスト実行
```bash
npm run test              # 全テスト実行
npx vitest run --reporter=verbose  # 詳細出力
npx vitest run __tests__/blend-calculator.test.ts  # 個別実行
```

## 新機能のテスト要件
- サービス層のロジックには必ずユニットテストを追加
- 調合計算に変更がある場合は既存39+13ケースが全てパスすることを確認
- API テストではリクエスト/レスポンスの型を検証
