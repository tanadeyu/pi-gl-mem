# pi-gl-mem — グローバル＋ローカル記憶拡張 for pi

## 何をするもの？
pi エージェントに「記憶」を追加する拡張機能。プロジェクトごとのローカル記憶と、PC全体で共有するグローバル記憶の2階層を提供する。

## 記憶の2階層

| 階層 | 保存先 | 用途 |
|------|--------|------|
| 🌐 グローバル | `~/.pi/agent/pi-gl-mem/MEMORY.md` | 全プロジェクト横断の知識 |
| 📁 ローカル | `./.pi-gl-mem/` | プロジェクト固有の記憶 |

## ツール一覧（6つ）

### グローバル用
- `write_global_memory` — グローバル MEMORY.md に追記/上書き
- `read_global_memory` — グローバル MEMORY.md を読む

### ローカル用
- `write_local_memory` — target=long_term / daily / note に保存
- `read_local_memory` — target=long_term / scratchpad / daily / note / list
- `local_scratchpad` — チェックリスト管理（add/done/undo/clear_done/list）
- `search_local_memory` — 全文検索

## 特徴
- **pi-mem 依存ゼロ** — 必要な関数はすべて内部にコピー持参
- **上方向探索** — サブディレクトリから起動しても親の `.pi-gl-mem/` を自動認識
- **早期returnガード** — 未initのプロジェクトではツール自体を非登録（エラーにならない）
- **競合ゼロ** — 他拡張のコードを書き換えない完全外付け型

## インストール

```bash
pi install https://github.com/tanadeyu/pi-gl-mem
pi-gl-mem-init   # .pi-gl-mem/ を作成（Y/N確認付き）
pi               # 起動
```

## 初期化後のファイル構成

```
your-project/
  └── .pi-gl-mem/
        ├── MEMORY.md            # 長期記憶（自動ロード）
        ├── SCRATCHPAD.md        # チェックリスト（手動read）
        ├── daily/YYYY-MM-DD.md  # 日次ログ（今日＋昨日を自動ロード）
        ├── notes/               # ノート類（手動read）
        └── pi_gl_settings.json  # injectLocal / injectGlobal
```

## 設計思想
- **ゼロ依存**: 単一 TypeScript ファイルで完結（ヘルパー関数はすべてコピー持参）
- **階層化**: Global（横断知識）→ Local（プロジェクト固有）の2段階でコンテキストを最適化
- **非破壊**: pi本体や他拡張に一切手を加えない
- **安全設計**: 未初期化プロジェクトでは何もしない（クラッシュ防止）
