#!/bin/bash
# PreToolUse hook: git commit 前に lint + 型チェック + テストを実行
# Exit 0 = 許可, Exit 2 = ブロック

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# git commit コマンドでなければスルー
if ! echo "$COMMAND" | grep -qE '^\s*git\s+commit'; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 0

echo "コミット前チェックを実行中..." >&2

# Lint
if ! npm run lint --silent 2>&1; then
  echo "lint エラー: npm run lint を修正してからコミットしてください" >&2
  exit 2
fi

# 型チェック
if ! npm run check --silent 2>&1; then
  echo "型エラー: npm run check を修正してからコミットしてください" >&2
  exit 2
fi

# テスト
if ! npm run test --silent 2>&1; then
  echo "テスト失敗: npm run test を修正してからコミットしてください" >&2
  exit 2
fi

echo "全チェック通過" >&2
exit 0
