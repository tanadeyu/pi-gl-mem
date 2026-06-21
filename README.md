# pi-gl-mem

pi（pi-coding-agent）用の **グローバル＋ローカル記憶拡張**。

> **実験段階**: 動作は自己責任でお願いします。最低限の動作確認はしていますが、エッジケースでの振る舞いは保証しません。

## 概要

pi-gl-mem は **2つの記憶階層** を提供します：

| 記憶 | 保存先 | 用途 |
|------|-------|------|
| 🌐 **グローバル** | `~/.pi/agent/pi-gl-mem/MEMORY.md` | PC全体で共有する知識（全プロジェクト横断） |
| 📁 **ローカル** | `./.pi-gl-mem/` | プロジェクト固有の仕様・TODO・日次ログ |

pi-mem（@haha1903/pi-mem）への依存は **ゼロ**。必要な機能はすべて自己完結しています。

## ツール一覧（6ツール）

### グローバル用

| ツール | 機能 |
|--------|------|
| `write_global_memory` | グローバル MEMORY.md に追記/上書き |
| `read_global_memory` | グローバル MEMORY.md を読む |

### ローカル用

| ツール | 機能 |
|--------|------|
| `write_local_memory` | long_term/daily/note に保存。append/overwrite。タイムスタンプ+セッションID自動付与 |
| `read_local_memory` | long_term/scratchpad/daily/note/list を読む |
| `local_scratchpad` | チェックリスト管理（add/done/undo/clear_done/list） |
| `search_local_memory` | 全文検索（大文字小文字無視の部分一致） |

## 記憶領域

### グローバル

```
~/.pi/agent/pi-gl-mem/
  └── MEMORY.md       # グローバル長期記憶（1ファイルのみ）
```

初回 `write_global_memory` 呼び出し時に自動生成されます。

### ローカル

プロジェクトごとに `pi-gl-mem-init` で作成します：

```
your-project/
  └── .pi-gl-mem/
        ├── MEMORY.md            # 長期記憶（自動ロード）
        ├── SCRATCHPAD.md        # チェックリスト（手動read）
        ├── daily/YYYY-MM-DD.md  # 日次ログ（今日＋昨日を自動ロード）
        ├── notes/<file>.md      # ノート類（手動read）
        └── pi_gl_settings.json  # 設定ファイル
```

未 init のプロジェクトではローカルツールは何もせず、エラーも出しません（早期returnガード）。グローバルツール（write/read_global_memory）は init 不要で常に使用できます。

### 上方向探索

カレントディレクトリだけでなく、親ディレクトリも自動探索します。
サブディレクトリから起動しても同じ `.pi-gl-mem/` を共有できます。

```
project/
  └── .pi-gl-mem/        ← ここにあれば
      └── src/
          └── app/
              └── main.ts  ← ここで pi 起動しても認識
```

## インストール

### 手順A: GitHub から直接インストール（推奨）

```bash
pi install https://github.com/tanadeyu/pi-local-memo0
```

### 手順B: ローカルファイルから

```bash
pi install ./pi-gl-mem.ts
```

### 初期化

新しいプロジェクトでは `pi-gl-mem-init` を実行します：

```bash
pi-gl-mem-init
# → .pi-gl-mem/ が作成される（Y/N確認あり）
```

必要に応じて `.gitignore` に追記：

```
.pi-gl-mem/
```

### アンインストール

```bash
pi uninstall https://github.com/tanadeyu/pi-local-memo0
rm -rf ./.pi-gl-mem   # データも削除する場合
```

## 設定

`.pi-gl-mem/pi_gl_settings.json`（プロジェクトごとに設定可能）:

```json
{"injectLocal": true, "injectGlobal": true}
```

| 設定 | 初期値 | 意味 |
|------|--------|------|
| `injectLocal` | `true` | ローカル記憶をAIに読ませる |
| `injectGlobal` | `true` | グローバル記憶をAIに読ませる |

## pi-local-mem からの移行

既存の `.pi-local-mem/` がある場合、以下で内容を引き継げます：

```bash
mv .pi-local-mem .pi-gl-mem
cd .pi-gl-mem
mv MEMORY_local.md MEMORY.md
mv SCRATCHPAD_local.md SCRATCHPAD.md
mv daily_local daily
mv notes_local notes
mv pi_memory_local.json pi_gl_settings.json
```

## ドキュメント

- [`pi-gl-mem解説書.md`](pi-gl-mem解説書.md) — ソースコードの初心者向け解説
- [`pi-gl-mem仕様書/pi-gl-mem仕様書01.md`](pi-gl-mem仕様書/pi-gl-mem仕様書01.md) — 基本設計書
- [`pi-gl-mem仕様書/old/`](pi-gl-mem仕様書/old/) — 旧 pi-local-mem 仕様書（参考）

## 動作確認環境

- pi: 0.79.8
- pi-gl-mem.ts: v1.0.0 (2026-06-21)

## ライセンス

MIT License

Copyright (c) 2026 tanadeyu
