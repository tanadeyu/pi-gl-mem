# pi-gl-mem 仕様書01（基本設計・v1.0.0）

> 最終更新: 2026-06-21
> 種別: 基本設計書（実装コードは別途 pi-gl-mem.ts に記載）

---

## 0. 目次

1. 位置づけと概要
2. 用語定義
3. ディレクトリおよびファイル構造
4. グローバル記憶（global）
5. ローカル記憶（local）
6. 自動ロード仕様（before_agent_start）
7. ツール一覧（6ツール）
8. 上方向探索ロジック
9. init プロセス
10. タイムスタンプ・フォーマット互換
11. pi-local-mem からの変更点
12. 動作確認環境

---

## 1. 位置づけと概要

### 1-1. pi-gl-mem とは

pi-gl-mem は、pi エージェント向け記憶管理プラグインである。
pi-local-mem（v1.0.0）を改名し、**グローバル記憶** と **ローカル記憶** の両方を提供する拡張版として再設計した。

### 1-2. 提供するもの

| 記憶の種類 | 保存先 | 特徴 |
|-----------|--------|------|
| グローバル | `~/.pi/agent/pi-gl-mem/MEMORY.md` | PC全体で共有・全プロジェクト横断 |
| ローカル | `./.pi-gl-mem/` | プロジェクトごとに分離・自己完結 |

### 1-3. pi-mem との関係

| 項目 | pi-mem（@haha1903/pi-mem） | pi-gl-mem（本プラグイン） |
|------|---------------------------|--------------------------|
| 範囲 | グローバル（`~/.pi/agent/memory/`） | グローバル＋ローカル両方 |
| 依存 | なし（本体） | **pi-memに依存しない**（importなし） |
| 構成 | 多機能（dashboard/LLM要約等） | 最小構成（6ツール＋必要な機能のみ） |
| 存続 | npm配布物 | 単体で完結・pi-mem不要 |

### 1-4. 基本方針

- pi-mem への import 依存ゼロ（完全独立）
- 必要な関数はすべて内部にコピー持参
- グローバルとローカルでツール名を明確に区別（`write_global_memory` / `write_local_memory`）
- ローカルの運用感は pi-local-mem から継承（4ファイル＋4ツール）

---

## 2. 用語定義

| 用語 | 定義 |
|------|------|
| グローバル記憶 | `~/.pi/agent/pi-gl-mem/MEMORY.md` に保存される全プロジェクト横断の記憶 |
| ローカル記憶 | `./.pi-gl-mem/` 配下に保存されるプロジェクト固有の記憶 |
| グローバル注入 | `before_agent_start` でグローバル MEMORY.md を systemPrompt に追記すること |
| ローカル注入 | `before_agent_start` でローカル記憶（長期・daily）を systemPrompt に追記すること |
| 上方向探索 | カレントディレクトリから親方向に `.pi-gl-mem/` を探すロジック |

---

## 3. ディレクトリおよびファイル構造

### 3-1. グローバル側

```
~/.pi/agent/
  └── pi-gl-mem/
        └── MEMORY.md    # グローバル長期記憶（1ファイルのみ）
```

- daily/notes/scratchpad は持たない（グローバル側は1ファイルのみ）
- init.sh で自動生成（Y/N確認付き）

### 3-2. ローカル側（プロジェクトごと）

```
~/any-your-project-folder/
  └── .pi-gl-mem/
        ├── MEMORY.md              # 長期記憶（決定・仕様・durable facts）※自動ロード
        ├── SCRATCHPAD.md          # チェックリスト（後でやること）※手動read
        ├── daily/
        │   └── YYYY-MM-DD.md      # 日次ログ（タイムスタンプ付き追記）※今日+昨日を自動ロード
        ├── notes/                  # ノート類（手動read）
        └── pi_gl_settings.json      # injectLocal / injectGlobal（デフォルト両方true）
```

**pi-local-mem からの命名変更点:**

| pi-local-mem | pi-gl-mem | 理由 |
|-------------|-----------|------|
| `.pi-local-mem/` | `.pi-gl-mem/` | パッケージ名変更 |
| `MEMORY_local.md` | `MEMORY.md` | pi-mem と併存しないため `_local` postfix不要 |
| `SCRATCHPAD_local.md` | `SCRATCHPAD.md` | 同上 |
| `daily_local/` | `daily/` | 同上 |
| `notes_local/` | `notes/` | 同上 |
| `pi_memory_local.json` | `pi_gl_settings.json` | 同上（＋一般的な複数形命名） |

> **補足:** pi-local-mem では pi-mem と併存するために `_local` postfix で衝突回避していた。pi-gl-mem は pi-mem とは別パッケージとして独立運用するため、postfix を外した。同一セッションで pi-mem と併用してもファイル名が衝突することはない（グローバル側は別ディレクトリ、ローカル側は pi-mem のローカル機能が存在しないため）。
>
> **移行:** 既存の `.pi-local-mem/` がある場合、以下のリネームで内容を引き継げる（後述 §11-2 参照）。

### 3-3. pi_gl_settings.json

```json
{
  "injectLocal": true,
  "injectGlobal": true
}
```

| 項目 | 型 | 既定 | 説明 |
|------|-----|------|------|
| `injectLocal` | boolean | `true` | ローカル記憶を systemPrompt に注入する |
| `injectGlobal` | boolean | `true` | グローバル記憶を systemPrompt に注入する |

---

## 4. グローバル記憶（global）

### 4-1. 保存先

```
~/.pi/agent/pi-gl-mem/MEMORY.md
```

### 4-2. 特徴

- **1ファイルのみ**（daily/notes/scratchpad は持たない）
- 全プロジェクト横断で共有される長期記憶
- エントリ形式はローカルと同じ（タイムスタンプ + セッションID）
- ファイルが存在しなければスキップ（エラーにしない）

### 4-3. グローバル注入（before_agent_start）

`injectGlobal !== false` の時、`before_agent_start` で以下を systemPrompt 末尾に注入する:

```
## Global Memory

<MEMORY.md 全文>
```

注入ラッパ:
```
### [GLOBAL MEMORY]\n<section>\n
```

### 4-4. グローバル用ツール（2つ）

| ツール | 機能 |
|--------|------|
| `write_global_memory` | グローバル MEMORY.md に追記または上書き |
| `read_global_memory` | グローバル MEMORY.md の内容を返す |

詳細は §7 を参照。

---

## 5. ローカル記憶（local）

### 5-1. 保存先

```
./.pi-gl-mem/  （カレントディレクトリまたは親方向に見つかった最初のもの）
```

### 5-2. ファイル構成（4ファイル）

| ファイル | 用途 | 自動ロード |
|----------|------|-----------|
| `MEMORY.md` | 長期記憶（決定・仕様・durable facts） | ✅ 注入される |
| `SCRATCHPAD.md` | チェックリスト（後でやること） | ❌ 手動read |
| `daily/YYYY-MM-DD.md` | 日次ログ（今日＋昨日） | ✅ 今日＋昨日が注入される |
| `notes/*.md` | ノート類 | ❌ 手動read |

### 5-3. ローカル用ツール（4つ）

| ツール | 機能 |
|--------|------|
| `write_local_memory` | ローカル記憶に書き込み（target=long_term/daily/note） |
| `read_local_memory` | ローカル記憶を読み取り（target=long_term/scratchpad/daily/note/list） |
| `local_scratchpad` | SCRATCHPAD.md 管理（add/done/undo/clear_done/list） |
| `search_local_memory` | .pi-gl-mem/ 配下を部分一致検索 |

詳細は §7 を参照。

---

## 6. 自動ロード仕様（before_agent_start）

### 6-1. 注入順序

```
[GLOBAL MEMORY]
  ↓
[PROJECT LOCAL MEMORY - 優先]
```

グローバル → ローカルの順で注入する。ローカルは「優先」ラッパで包み、プロジェクト固有の情報を重視する意図を明示する。

### 6-2. グローバル注入条件

- `~/.pi/agent/pi-gl-mem/MEMORY.md` が存在する
- `pi_gl_settings.json` が存在しない、または `injectGlobal !== false`

存在しない場合は何も注入しない（エラーにしない）。

### 6-3. ローカル注入条件

- カレントディレクトリまたは親方向に `.pi-gl-mem/` が見つかる
- `pi_gl_settings.json` が存在しない、または `injectLocal !== false`

見つからない場合は何も注入せず、全ツールが早期returnする（エラーにしない）。

### 6-4. 注入内容（ローカル）

```
### [PROJECT LOCAL MEMORY - 優先]

## MEMORY.md (long-term)

<MEMORY.md 全文>

---

## Daily log: YYYY-MM-DD (today)

<daily/今日.md 全文>

---

## Daily log: YYYY-MM-DD (yesterday)

<daily/昨日.md 全文>

---

### Local Log Rule
（Local Log Rule の説明＋ツール呼び出し指示）

### Local Memory Targets
（各targetの説明）
```

### 6-5. 早期returnガード

`.pi-gl-mem/` が見つからない場合、全ツールは即座に `return` する（何もしない・エラーにしない）。これにより未initのプロジェクトでもプラグインがエラーを出さない。

---

## 7. ツール一覧（6ツール）

### 7-1. write_global_memory（新規）

グローバル MEMORY.md に書き込む。

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `content` | string | ✅ | 書き込む内容（Markdown） |
| `mode` | `"append"` | `"overwrite"` | ❌ | 既定: `append` |

- 自動付与: `<!-- YYYY-MM-DD HH:MM:SS [sessionId8] -->`
- `mode=overwrite` の場合は既存内容を全置換（タイムスタンプも新規）
- `append` の場合は既存内容の末尾に追記

### 7-2. read_global_memory（新規）

グローバル MEMORY.md の内容を返す。

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| （なし） | — | — | MEMORY.md 全文をそのまま返す |

- ファイルが存在しない場合は空文字列を返す

### 7-3. write_local_memory（継承）

ローカル記憶に書き込む（pi-local-mem と同等・パスが `.pi-gl-mem/` に変わったのみ）。

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `target` | `"long_term"` | `"daily"` | `"note"` | ✅ | 書き込み先 |
| `content` | string | ✅ | 書き込む内容（Markdown） |
| `mode` | `"append"` | `"overwrite"` | ❌ | 既定: `append` |
| `filename` | string | target=noteの時✅ | ノートファイル名 |

### 7-4. read_local_memory（継承）

ローカル記憶を読み取る。

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `target` | `"long_term"` | `"scratchpad"` | `"daily"` | `"note"` | `"list"` | ✅ | 読み取り先 |
| `date` | string | ❌ | target=dailyの時（既定: 今日 `YYYY-MM-DD`） |
| `filename` | string | target=noteの時✅ | ノートファイル名 |

### 7-5. local_scratchpad（継承）

SCRATCHPAD.md を操作する。

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `action` | `"add"` | `"done"` | `"undo"` | `"clear_done"` | `"list"` | ✅ | 操作種別 |
| `text` | string | add/done/undoの時✅ | 対象テキスト（substring一致） |

### 7-6. search_local_memory（継承）

`.pi-gl-mem/` 配下を部分一致検索する。

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `query` | string | ✅ | 検索文字列（大文字小文字無視） |
| `max_results` | number | ❌ | 最大結果数（既定: 20） |

---

## 8. 上方向探索ロジック

### 8-1. 目的

カレントディレクトリではなく、その親ディレクトリに `.pi-gl-mem/` がある場合も認識する。
これにより、プロジェクトルートで pi を起動しなくても、サブディレクトリから起動した場合に同一のローカル記憶を共有できる。

### 8-2. ロジック

```typescript
function findLocalMemDir(startDir: string): string | null {
  let current = startDir;
  while (true) {
    const candidate = path.join(current, '.pi-gl-mem');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      // ルートに達した
      return null;
    }
    current = parent;
  }
}
```

- 上限なし（ルート `/` または `C:\` まで探索）
- 見つかった最初の `.pi-gl-mem/` を使用する
- 見つからない場合は `null` を返す（全ツールが早期return）

### 8-3. 補足

- 各プロジェクトに1つの `.pi-gl-mem/` を想定
- 親方向の探索は起動時の1回だけ（キャッシュしない）
- `.pi-gl-mem/` が見つかるたびに再評価する必要はない（1セッション中にカレントディレクトリは変わらない前提）

---

## 9. init プロセス

### 9-1. pi-gl-mem-init.sh

ユーザーが手動で実行する初期化スクリプト（Y/N確認付き）。

```bash
#!/bin/bash
# pi-gl-mem-init.sh - プロジェクトに .pi-gl-mem/ を作成

DIR=".pi-gl-mem"

if [ -d "$DIR" ]; then
  echo "$DIR は既に存在します。"
  exit 0
fi

echo "このプロジェクトに .pi-gl-mem/ を作成しますか？ [y/N]"
read -r response
if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
  echo "キャンセルしました。"
  exit 0
fi

mkdir -p "$DIR/daily" "$DIR/notes"

# 設定ファイル
cat > "$DIR/pi_gl_settings.json" << 'EOF'
{
  "injectLocal": true,
  "injectGlobal": true
}
EOF

echo "$DIR を作成しました。"
echo "pi を再起動すると記憶の自動ロードが有効になります。"
```

### 9-2. 初回起動時の動作

- `.pi-gl-mem/` が存在しない → 全ツール早期return（エラーにしない）
- ユーザーが `pi-gl-mem-init.sh` を実行 → ディレクトリ作成
- pi 再起動 → `.pi-gl-mem/` を認識 → 注入＋ツール有効化

### 9-3. グローバル記憶の初期化

- `~/.pi/agent/pi-gl-mem/MEMORY.md` は初回使用時に自動生成される
- `write_global_memory` 初回呼び出し時にディレクトリごと作成する

---

## 10. タイムスタンプ・フォーマット互換

pi-local-mem から継承した内部関数（pi-mem/lib.ts と同一ロジックをコピー持参）。

| 関数 | ロジック | 用途 |
|------|---------|------|
| `nowTimestamp()` | `new Date().toISOString().replace('T',' ').replace(/\.\d+Z$/,'')` | タイムスタンプ `2026-06-21 12:30:00` |
| `shortSessionId(id)` | `id.slice(0,8)` | セッションID `[019ee2e8]` |
| `todayStr()` | `new Date().toISOString().slice(0,10)` | dailyファイル名（今日） |
| `yesterdayStr()` | 昨日の日付 | daily自動ロード（昨日） |
| `readFileSafe(path)` | try-catch付き同期読み込み（失敗時null） | 安全なファイル読み込み |
| `dailyPath(dir,date)` | `path.join(dir, date+'.md')` | dailyファイルパス |
| `parseScratchpad(content)` | `- [x] text` 形式を行解析・meta保持 | SCRATCHPAD読み込み |
| `serializeScratchpad(items)` | `# Scratchpad` ヘッダ＋`- [ ]/[x] text`＋meta | SCRATCHPAD書き出し |

エントリヘッダ:
```
<!-- 2026-06-21 12:30:00 [019ee2e8] -->
```

エントリ間は `\n\n` 区切り。

---

## 11. pi-local-mem からの変更点

### 11-1. 変更一覧

| # | 項目 | pi-local-mem | pi-gl-mem | 理由 |
|---|------|-------------|-----------|------|
| 1 | パッケージ名 | pi-local-mem | pi-gl-mem | 改名 |
| 2 | ローカルディレクトリ | `.pi-local-mem/` | `.pi-gl-mem/` | 改名に伴う変更 |
| 3 | ファイル名 postfix | `_local` 付き | postfix なし | pi-mem との併存を前提としないため |
| 4 | グローバル記憶 | なし（pi-mem任せ） | 独自の MEMORY.md 1ファイル | グローバルも自己完結 |
| 5 | ツール数 | 4（local のみ） | 6（local 4 + global 2） | global 追加 |
| 6 | 上方向探索 | なし（cwd 固定） | あり（親方向・上限なし） | 利便性向上 |
| 7 | 早期returnガード | なし | あり | 未init時の安全性 |
| 8 | init.sh | 自動生成（init時） | Y/N確認付き手動実行 | 制御性向上 |
| 9 | injectGlobal | pi-mem の注入を遮断 | 自前の global 注入 | 自己完結化 |
| 10 | pi-mem 依存 | なし（import しない） | なし（import しない） | 継承 |
| 11 | バージョン | v1.0.0 (2026-06-20) | v1.0.0 (2026-06-21) | 新規パッケージ |
| 12 | 互換性 | — | **なし**（.pi-local-mem/ は完全に切る） | 新規設計のため |

### 11-2. 移行手順（.pi-local-mem/ → .pi-gl-mem/）

既存の `.pi-local-mem/` があるプロジェクトでは、以下のリネームで内容を引き継げる。

```bash
cd /path/to/project
# ディレクトリごとリネーム
mv .pi-local-mem .pi-gl-mem
# 内部ファイルを新命名にリネーム
cd .pi-gl-mem
mv MEMORY_local.md MEMORY.md
mv SCRATCHPAD_local.md SCRATCHPAD.md
mv daily_local daily
mv notes_local notes
mv pi_memory_local.json pi_gl_settings.json
```

これで `.pi-local-mem/` 時代の daily ログや長期記憶がそのまま `.pi-gl-mem/` で使える。

### 11-3. 併用注意

- 旧 pi-local-mem と同じセッションで併用するとツール名衝突エラーになる
- 必ず `pi uninstall pi-local-mem` してから `pi install` すること

---

## 12. 動作確認環境

| コンポーネント | バージョン | 役割 |
|---|---|---|
| pi 本体 | 0.79.8 | 拡張ローダ・ExtensionAPI 提供元 |
| pi-gl-mem | v1.0.0 (2026-06-21) | 本プラグイン |
| OS | Ubuntu 24.04 (WSL2) | 動作確認環境 |

---

## 付録A: ツール名分類

| ツール名 | 種別 | 操作対象 |
|----------|------|---------|
| `write_global_memory` | global | `~/.pi/agent/pi-gl-mem/MEMORY.md` |
| `read_global_memory` | global | `~/.pi/agent/pi-gl-mem/MEMORY.md` |
| `write_local_memory` | local | `./.pi-gl-mem/{MEMORY,daily,notes}/*.md` |
| `read_local_memory` | local | `./.pi-gl-mem/{MEMORY,SCRATCHPAD,daily,notes}/*.md` |
| `local_scratchpad` | local | `./.pi-gl-mem/SCRATCHPAD.md` |
| `search_local_memory` | local | `./.pi-gl-mem/**/*.md` |

---

## 付録B: セッションID（参考）

pi 本体から渡される `context.session.sessionId`（UUID形式）の先頭8文字を使用。

例: `019ee2e8-xxxx-xxxx-xxxxxxxxxxxx` → `[019ee2e8]`

---

*以上が pi-gl-mem v1.0.0 の基本設計である。実装コードは pi-gl-mem.ts に記載する。*
