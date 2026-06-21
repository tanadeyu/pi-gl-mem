#!/bin/bash
# pi-gl-mem-init.sh — pi-gl-mem の記憶領域 (.pi-gl-mem/) をプロジェクトルートに作成
# Y/N 確認あり。.pi-gl-mem/ が既存の場合は警告して終了。

set -e
DIR=".pi-gl-mem"

if [ -d "$DIR" ]; then
  echo "⚠️ $DIR は既に存在します。上書きせず終了します。"
  exit 1
fi

echo "pi-gl-mem の記憶領域 ($DIR) を現在のディレクトリに作成します。"
read -p "よろしいですか？ (y/N) " yn
case "$yn" in
  [yY]*) ;;
  *) echo "中止しました。"; exit 0;;
esac

mkdir -p "$DIR/daily" "$DIR/notes"
cat > "$DIR/MEMORY.md" <<'EOF'
# プロジェクト個別記憶

ここにこのプロジェクト特有の仕様・型定義・TODO・決定事項などを記録してください。
EOF
echo -n "" > "$DIR/SCRATCHPAD.md"
cat > "$DIR/pi_gl_settings.json" <<'EOF'
{"injectLocal":true,"injectGlobal":true}
EOF

echo "✅ $DIR を作成しました。"
echo "   daily/ notes/ MEMORY.md SCRATCHPAD.md pi_gl_settings.json"
