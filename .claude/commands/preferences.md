# 学習済み設定の確認・編集

現在の学習データを表示し、必要に応じて編集する。

## 手順

1. 以下のメモリファイルをすべて読み込む:
   - `~/.claude/projects/-Users-yoshioka-work-aisent2026/memory/MEMORY.md`
   - `~/.claude/projects/-Users-yoshioka-work-aisent2026/memory/preferences.md`
   - `~/.claude/projects/-Users-yoshioka-work-aisent2026/memory/decisions.md`
   - `~/.claude/projects/-Users-yoshioka-work-aisent2026/memory/corrections.md`

2. 以下の形式で見やすくサマリ表示する:

   ### コーディングスタイル
   （preferences.md から抽出）

   ### 技術選定・判断
   （decisions.md から抽出）

   ### 修正パターン
   （corrections.md から抽出）

   ### プロジェクト概要
   （MEMORY.md から抽出）

3. ユーザーが編集を希望する場合は、対話的に該当ファイルを更新する

## ルール

- 読み取り専用で開始し、変更はユーザーの明示的な指示があった場合のみ行う
- 削除する場合は確認を取る
