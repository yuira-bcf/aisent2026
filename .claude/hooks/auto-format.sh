#!/bin/bash
# PostToolUse hook: ファイル編集後に Biome で自動フォーマット
# Edit / Write ツール実行後にトリガー

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# ファイルパスが取得できなければスルー
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# TypeScript/JavaScript ファイルのみ対象
if ! echo "$FILE_PATH" | grep -qE '\.(ts|tsx|js|jsx|json)$'; then
  exit 0
fi

# ファイルが存在しなければスルー（削除された場合）
if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Biome でフォーマット（エラーは警告として無視）
npx biome check --write "$FILE_PATH" 2>/dev/null || true

exit 0
