# フィードバック記録

ユーザーからの明示的なフィードバックを記録する。

## 引数

$ARGUMENTS - フィードバック内容（例: "コミットメッセージは日本語で書いて"）

## 手順

1. フィードバック内容を分析し、カテゴリを判定する:
   - **修正**: 間違いや改善点の指摘 → corrections.md
   - **好み**: スタイルや方法の指定 → preferences.md
   - **決定**: 技術選定やルール変更 → decisions.md
2. 該当するメモリファイルを読む
3. 重複がないか確認し、追記または更新する
4. 記録完了をユーザーに報告する

## メモリファイルの場所

- `~/.claude/projects/-Users-yoshioka-work-aisent2026/memory/corrections.md`
- `~/.claude/projects/-Users-yoshioka-work-aisent2026/memory/preferences.md`
- `~/.claude/projects/-Users-yoshioka-work-aisent2026/memory/decisions.md`

## ルール

- フィードバックはそのまま記録し、解釈を加えない
- 日付を必ず付与する
- 既存の記録と矛盾する場合は古い記録を更新する
