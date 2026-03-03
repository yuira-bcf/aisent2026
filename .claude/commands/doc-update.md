---
description: コード変更に合わせてdocs/配下のドキュメントを更新
---

# /doc-update

最近のコード変更に合わせて、関連するドキュメントを更新してください。

## 手順

1. `git diff` または直近の変更内容を確認
2. 変更に関連する設計書を特定:
   - DBスキーマ変更 → `01_要件定義書.md` (§5), 該当 feature ドキュメント
   - API追加/変更 → `03_詳細設計書.md`, 該当 feature ドキュメント
   - ページ追加 → `01_要件定義書.md` (§6 画面一覧)
   - 機能追加 → `01_要件定義書.md` (§3), 該当 feature ドキュメント
3. 設計書の該当箇所を更新
4. `docs/context-log.md` に変更を追記

## 更新対象ドキュメント

- `docs/01systemdesign/01_要件定義書.md` — 要件・画面一覧・データ要件
- `docs/01systemdesign/03_詳細設計書.md` — API仕様・画面詳細
- `docs/01systemdesign/06_実装計画書.md` — 実装状況・タスク一覧
- `docs/01systemdesign/features/` — 各機能の詳細仕様
- `docs/context-log.md` — セッションログ

## 注意事項

- ドキュメントの既存フォーマットに従う
- 「実装済み」「未実装」のステータスを正確に反映
- AIモデル関連: 「GPT-4」「OpenAI」への参照は「claude-sonnet-4.5」に更新
