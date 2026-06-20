# pi-local-mem

pi（pi-coding-agent）用の**プロジェクト専用ローカル記憶拡張**。グローバル拡張の [pi-mem](https://github.com/haha1903/pi-mem) と互換の4ツール・4ファイル構成を、pi-memへの依存なしに自己完結で実現します。

## 特徴
- **方式B（独立実装）**: pi-memへのimport依存ゼロ・必要な関数は内部にコピー持参
- **`_local` postfix**: pi-memとの命名衝突を完全回避
- **完全分離**: グローバル(pi-mem)と8ファイルは一切交差しない
- **軽量**: dashboard/LLM要約/git autocommit等の重機能は除外

## ツール（4つ・pi-mem互換）
| ツール | 互換先 | 機能 |
|---|---|---|
| `write_local_memory` | memory_write | long_term/daily/note・append/overwrite・タイムスタンプ+セッションID自動付与 |
| `read_local_memory` | memory_read | long_term/scratchpad/daily/note/list |
| `local_scratchpad` | scratchpad | add/done/undo/clear_done/list |
| `search_local_memory` | memory_search | 大文字小文字無視の部分一致grep |

## 記憶領域（プロジェクトフォルダ直下に自動展開）
```
.pi-local-mem/
  ├─ MEMORY_local.md            # 長期記憶（自動ロード）
  ├─ SCRATCHPAD_local.md        # チェックリスト（手動read）
  ├─ daily_local/YYYY-MM-DD.md  # 日次ログ（今日+昨日を自動ロード）
  ├─ notes_local/<file>.md      # ノート類（手動read）
  └─ pi_memory_local.json       # injectLocal/injectGlobal（デフォルト両方true）
```

## インストール
```bash
pi install /path/to/pi-local-mem.ts
```
`pi install` は参照登録のみ（コピーなし）。元ファイルを削除/移動すると壊れるため配置は固定。

## 設定
`.pi-local-mem/pi_memory_local.json`:
```json
{"injectLocal": true, "injectGlobal": true}
```
- `injectGlobal: false` で `<pi-mem-injected>` を後段フィルタで除去（ローカル専用表示）
- 前提: settings.json の packages 順序で pi-mem が pi-local-mem より前であること

## ドキュメント
- [`メンテナンス.md`](メンテナンス.md) — 運用・保守・トラブル対応
- [`pi-local-mem仕様書/`](pi-local-mem仕様書/) — 設計仕様書 01-10（10が最終版）

## 動作確認環境
- pi 0.79.8
- @haha1903/pi-mem 1.0.1
- pi-local-mem.ts v1.0.0 (2026-06-20)
