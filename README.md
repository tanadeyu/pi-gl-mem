# pi-local-mem

pi（pi-coding-agent）用の**プロジェクト専用ローカル記憶拡張**。

> **実験段階**: 作り込みは荒く、動作は自己責任でお願いします。最低限の動作確認はしていますが、エッジケースでの振る舞いは保証しません。

## pi-mem との関係

| | pi-mem（@haha1903/pi-mem） | pi-local-mem（本拡張） |
|---|---|---|
| 役割 | **グローバル記憶**（PC全体） | **ローカル記憶**（プロジェクト単位） |
| インストール | npm パッケージ | GitHub リポジトリ直指定 |
| ツール名 | memory_write / memory_read / ... | write_local_memory / read_local_memory / ... |
| 自動ロード | グローバル MEMORY.md + 日次ログ | ローカル MEMORY.md + 日次ログ |

**共存可能**。両方をインストールするとグローバル記憶とローカル記憶が同時にAIに読まれ、ツール名で書き分けられます。分離は設定フラグ（injectGlobal）で制御できます。

## 使い方

AI に「覚えておいて」と伝えると、このプロジェクトのローカル記憶に自動保存されます。ツール名はすべて `_local` 付きで、グローバル（pi-mem）と混同しません：

| 操作 | コマンド |
|---|---|
| 長期記憶に保存 | `write_local_memory(target="long_term")` |
| 日記に保存 | `write_local_memory(target="daily")` |
| ノートに保存 | `write_local_memory(target="note", filename="...")` |
| 記憶を読む | `read_local_memory(target="long_term")` |
| 検索 | `search_local_memory(query="...")` |
| チェックリスト | `local_scratchpad(action="add", text="...")` |

## ツール一覧

| ツール | 機能 |
|---|---|
| `write_local_memory` | long_term/daily/note に保存。append/overwrite。タイムスタンプ+セッションID自動付与 |
| `read_local_memory` | long_term/scratchpad/daily/note/list を読む |
| `local_scratchpad` | チェックリスト管理（add/done/undo/clear_done/list） |
| `search_local_memory` | 全文検索（大文字小文字無視の部分一致） |

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
pi install https://github.com/tanadeyu/pi-local-mem
```
GitHub 上の package.json を参照して拡張機能をロードします。元ファイルの削除・移動制限はありません。

## 設定

`.pi-local-mem/pi_memory_local.json`:
```json
{"injectLocal": true, "injectGlobal": true}
```

- `injectGlobal: false` で pi-mem のグローバル記憶注入を遮断（ローカル専用表示）
- 前提: packages 順序で pi-mem が pi-local-mem より前であること

## ドキュメント

- [`設計思想とpi-core_pi-mem_pi-local-mem連携.md`](設計思想とpi-core_pi-mem_pi-local-mem連携.md) — 設計思想・tool useの仕組み・3者の連携
- [`pi-local-mem解説書.md`](pi-local-mem解説書.md) — ソースコードの初心者向け解説

## 動作確認環境

- pi 0.79.8
- @haha1903/pi-mem 1.0.1
- pi-local-mem.ts v1.0.0 (2026-06-20)

## ライセンス

MIT License

Copyright (c) 2026 tanadeyu

---
*本ドキュメント中で `~` と表記されているパスは、ユーザーのホームディレクトリ（例: Linux `/home/ユーザー名` / macOS `/Users/ユーザー名` / Windows `C:\Users\ユーザー名`）を示します。*
