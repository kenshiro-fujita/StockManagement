#!/usr/bin/env bash
# ============================================================================
# Codex 移行インストーラ（StockManagement）
#
# 役割:
#   1) BMAD スラッシュコマンドを ~/.codex/prompts/ へ移植する
#      （Claude Code の .claude/commands/*.md を Codex プロンプト形式に変換）
#   2) config.toml.example を ~/.codex/config.toml.stockmanagement として配置する
#      （既存の ~/.codex/config.toml を壊さないよう、マージは手動で行う）
#
# 使い方:
#   bash codex-migration/install.sh
#
# 冪等性: 何度実行しても安全です（既存ファイルは上書き or スキップ）。
# ============================================================================
set -euo pipefail

# --- パス定義 -------------------------------------------------------------
# リポジトリルートをこのスクリプトの位置から解決する（cwd に依存しない）。
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PROMPTS_SRC="$REPO_ROOT/.claude/commands"
PROMPTS_DST="$CODEX_HOME/prompts"

echo "==> リポジトリルート: $REPO_ROOT"
echo "==> Codex ホーム:     $CODEX_HOME"

mkdir -p "$PROMPTS_DST"

# --- 1) スラッシュコマンドの移植 -----------------------------------------
# Codex のプロンプトはファイル名がコマンド名になります（/prompts:<ファイル名>）。
# 本文中の {project-root} を実際のリポジトリルートへ置換しておくと、
# Codex でもパス解決が確実になります。
echo "==> BMAD プロンプトを変換コピーします..."
count=0
for src in "$PROMPTS_SRC"/*.md; do
  [ -e "$src" ] || continue
  name="$(basename "$src")"
  dst="$PROMPTS_DST/$name"
  # {project-root} を絶対パスへ置換して配置する。
  sed "s|{project-root}|$REPO_ROOT|g" "$src" > "$dst"
  count=$((count + 1))
done
echo "    -> $count 個のプロンプトを $PROMPTS_DST に配置しました。"
echo "       例: /prompts:bmad-bmm-dev-story"

# --- 2) config.toml テンプレートの配置 -----------------------------------
# 既存設定を破壊しないため、別名で置いて手動マージを促す。
CONFIG_SRC="$REPO_ROOT/codex-migration/config.toml.example"
CONFIG_DST="$CODEX_HOME/config.toml.stockmanagement"
cp "$CONFIG_SRC" "$CONFIG_DST"
echo "==> 設定テンプレートを配置しました: $CONFIG_DST"

if [ -f "$CODEX_HOME/config.toml" ]; then
  echo "    既存の ~/.codex/config.toml が見つかりました。"
  echo "    上記テンプレートの内容を手動でマージしてください（プロジェクトの projects ブロック等）。"
else
  echo "    ~/.codex/config.toml が無いため、テンプレートをそのまま配置します。"
  cp "$CONFIG_SRC" "$CODEX_HOME/config.toml"
  echo "    -> $CODEX_HOME/config.toml を作成しました。"
fi

echo ""
echo "==> 完了しました。Codex を起動して /prompts: でコマンド一覧を確認してください。"
