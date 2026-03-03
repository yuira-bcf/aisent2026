---
description: Git ワークフロー・コミット規約
globs: ["**/*"]
---

# Git ワークフロー

## コミットメッセージ規約
- 日本語で記述
- 形式: `<種別>: <変更内容の要約>`
- 種別:
  - `feat`: 新機能
  - `fix`: バグ修正
  - `refactor`: リファクタリング
  - `test`: テスト追加・修正
  - `docs`: ドキュメント更新
  - `chore`: 設定・依存関係等
  - `style`: フォーマット・lint修正
- 例: `feat: クリエーター一覧ページを追加`

## コミット前チェック（必須）
コミット前に以下を全て通過させること:
```bash
npm run lint && npm run check && npm run test
```

## ブランチ戦略
- `main`: 本番ブランチ
- `develop`: 開発ブランチ（Sprint単位でmainにマージ）
- `feature/*`: 機能ブランチ（例: `feature/phase2-creator-marketplace`）
- `fix/*`: バグ修正ブランチ

## .gitignore に含めるもの
- `node_modules/`
- `.next/`
- `.env`, `.env.local`
- `.claude/settings.local.json`
- `legacy/`（必要に応じて）

## 注意
- **現在Gitは未初期化**。Sprint 0 で `git init` → 初期コミット → リモート接続を行う
- 機密情報（APIキー、トークン）は絶対にコミットしない
- `package-lock.json` はコミットする（再現性のため）
