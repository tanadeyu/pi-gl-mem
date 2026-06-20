# プロジェクト専用メモリ拡張プラグイン「pi-local-mem」仕様書9
## 0. 経緯（8→9 の変更点だけ）
仕様書8までは `.pi-local-mem/MEMORY.md` の**単一ファイル**構成だった。ユーザーから「グローバル(pi-mem)は4ファイルあるのにローカルは1ファイルでよいのか、特にマルチエージェント(`injectGlobal:false`)でグローバルを見せない運用ではローカルが自己完結できないのでは」と指摘が入り、構成再検討へ。
検討の結果、**「4ファイル構成＋pi-mem互換ツール」は高機能化ではなく自己完結のための構成互換** と判断。重機能(dashboard/LLM要約/session scanner/git autocommit)だけを除外し、操作感はpi-memと同じに揃える方針（案3改）を採用した。本書は実装前の**設計仕様**である。
## 1. 検討の枠組み（3案比較）
| 案 | 内容 | pi-memを触る | 高機能化 | 更新耐性 | 採否 |
|---|---|---|---|---|---|
| 1. pi-memを改造 | pi-memにcwd単位モード追加 | ❌触る | 抑えられる | ❌npm更新で消える | × |
| 2. 完全再実装 | 4ファイル+全ツール+重機能を自作 | 触らない | ❌高機能化 | ✅ | × |
| 3. **最小構成（採用）** | 4ファイル+最小ツール、重機能は作らない | 触らない | 抑えられる | ✅ | **○** |
採用理由: pi-memは触らない（非破壊・更新耐性）、かつローカルはpi-mem互換の操作感で自己完結（マルチエージェント時も独立稼働）、重機能は持たない（ミニマム維持・二重メンテ回避）。
## 2. pi-mem機能カバーマトリクス（最小構成でどこまで同じにするか）
| pi-mem機能 | ローカル実装 | 理由 |
|---|---|---|
| MEMORY.md（長期記憶） | ✅実装 | 自己完結の核 |
| daily/YYYY-MM-DD.md（日次ログ・今日+昨日） | ✅実装 | Local Log Ruleの書き先 |
| SCRATCHPAD.md（チェックリスト） | ✅実装 | ローカル完結で便利・実装軽量 |
| notes/*.md（ノート） | ✅実装 | target振り分けのみ・コスト小 |
| タイムスタンプ＋セッションID付与 | ✅実装 | pi-memと同形式（既に8で実装済） |
| memory_write(target/mode) 相当 | ✅実装 | `write_local_memory(target,mode)` |
| memory_read(target) 相当 | ✅実装 | `read_local_memory(target,...)` |
| scratchpad tool 相当 | ✅実装 | `scratchpad(action,...)` |
| memory_search 相当 | △簡易実装 | 簡易grep版で「同じ感じ」を担保 |
| contextFiles(AGENTS.md等)自動ロード | ❌作らない | プロジェクト直下のAGENTS.mdはpi本体が別途読む想定・ローカル职责外 |
| catchup/ロールアップ | ❌作らない | 日次今日+昨日で十分・最小構成 |
| dashboard（Last 24h） | ❌作らない | 重機能・LLM要約不要 |
| LLM要約 | ❌作らない | 重機能・コスト・最小構成 |
| session scanner(.jsonl走査) | ❌作らない | 重機能・ローカルに不要 |
| git autocommit | ❌作らない | 重機能・8で無効化方針と整合 |
## 3. ディレクトリおよびファイル構造
```
# 【グローバル】（既存pi-mem・完全放置）
~/.pi/agent/memory/
  └── MEMORY.md 等   # pi-memが従来通り読み書き（injectGlobal:falseでAIには見えなくなるのみ）
# 【ローカル】（pi起動時にプロジェクト直下へ完全自動展開・自己完結）
~/any-your-project-folder/
  └── .pi-local-mem/
        ├── MEMORY.md              # 長期記憶（決定・仕様・durable facts）※自動ロード
        ├── SCRATCHPAD.md          # チェックリスト（後でやること）※手動read
        ├── daily/
        │   └── YYYY-MM-DD.md      # 日次ログ（タイムスタンプ付き追記）※今日+昨日を自動ロード
        ├── notes/                 # ノート類（手動read）
        └── pi_memory.json         # injectLocal / injectGlobal（デフォルト両方true）
```
`pi_memory.json`（8から変更なし）:
```json
{
  "injectLocal": true,
  "injectGlobal": true
}
```
## 4. ツール一覧（3ツール＋search=計4）
### 4-1. write_local_memory（pi-mem: memory_write 互換）
- `target`: `long_term` | `daily` | `note`
- `content`: string
- `mode`: `append`（既定） | `overwrite`
- `filename`: target=note の時に必須
- 振り分け先: long_term→MEMORY.md / daily→daily/YYYY-MM-DD.md / note→notes/<filename>.md
- いずれも `<!-- YYYY-MM-DD HH:MM:SS [sessionId8] -->` を自動付与（pi-mem同形式）
- daily は常に append（pi-memと同じ）
### 4-2. read_local_memory（pi-mem: memory_read 互換）
- `target`: `long_term` | `scratchpad` | `daily` | `note` | `list`
- `date`: target=daily の時（既定: 今日）
- `filename`: target=note/file の時
- SCRATCHPAD/notes は手動read（自動ロードしない・pi-memと同じ挙動）
### 4-3. scratchpad（pi-mem: scratchpad 互換）
- `action`: `add` | `done` | `undo` | `clear_done` | `list`
- `text`: add/done/undo の時に使用（substring一致）
- フォーマット: `- [ ] text` / `- [x] text`（pi-memと同じ）
### 4-4. search_local_memory（簡易版・pi-mem: memory_search 互換）
- `query`: string
- `.pi-local-mem/` 配下の.mdを対象にファイル名+内容の部分一致検索（同期・簡易grep）
- 重機能(LLM要約)は持たず、純粋な文字列検索のみ
## 5. 自動ロード仕様（before_agent_start）
`injectLocal !== false` の時、ローカル記憶をsystemPrompt末尾へ注入:
- MEMORY.md（長期記憶）全文
- daily/今日.md 全文
- daily/昨日.md 全文
- 末尾に **Local Log Rule**（pi-memのDaily Log Ruleと同基準・ツール名だけ差し替え）
SCRATCHPAD.md / notes は自動ロードしない（pi-memと同じ・必要時にread_local_memoryで取得）。
注入フォーマット: `### [PROJECT LOCAL MEMORY - 優先]\n<結合内容>\n\n<Local Log Rule>\n`
## 6. グローバル遮断（injectGlobal）—— 8から変更なし
- `injectGlobal === false` の時、`context` イベント後段フィルタで `<pi-mem-injected>` を含むuserメッセージを除去
- 前提: settings.json の packages で pi-mem が pi-local-mem より前
- 1フラグで「参照(contextFiles)＋ファイル記憶(MEMORY/daily/catchup)」が同時に消える（pi-memが1メッセージに結合しているため）
- ツール(memory_write等)・dashboard は pi-mem 側で動き続けるが、AIは注入を見ないので実質使わない → ローカル4ツールで自己完結
- デフォルトは両方 true（勝手に消さない・マルチエージェント時だけ false にする運用）
## 7. タイムスタンプ・フォーマット互換
- 生成: `new Date().toISOString().replace('T',' ').replace(/\.\d+Z$/,'')` → `2026-06-20 12:30:00`
- セッションID: `ctx.sessionManager.getSessionId().slice(0,8)` → `019ee2e8`
- ヘッダ: `<!-- 2026-06-20 12:30:00 [019ee2e8] -->`（pi-memのnowTimestamp/shortSessionIdと同一ロジック・8で実証済み）
- エントリ間: `\n\n` 区切り（pi-memと同じ）
- グローバルのdailyとローカルのdailyは**同フォーマット**で並べても違和感なし
## 8. 最小構成の線引き（作らないもの・理由明記）
作らない重機能と理由:
- **dashboard**: LLM要約+session scannerが前提・重い・ローカルに不要
- **LLM要約**: APIコスト発生・最小構成の範囲外
- **session scanner**: ~/.pi/agent/sessions の.jsonl走査・グローバル資産への依存を避ける
- **git autocommit**: 8で無効化方針・ローカルでも持たない
- **catchup/ロールアップ**: daily今日+昨日で十分・実装が膨らむ要因を排除
- **contextFiles自動ロード**: プロジェクト直下AGENTS.md等はpi本体の別経路で読む想定・ローカルの职责外と明確化
これらを除外することで、コード量はpi-mem(約500行)の1/3程度（概算150〜200行）に抑え、**「ミニマム維持・自己完結・pi-mem互換操作感」** を同時に達成する。
## 9. ソースコード
本書は**設計仕様**の段階であり、実装コード全文は上記§1〜§8の設計で合意取得後に仕様書9改（または10）として書き下ろす。主要構造のみ記載:
- 起動時: `.pi-local-mem/` と `daily/` `notes/` を生成、MEMORY.md/SCRATCHPAD.md/pi_memory.json の雛形を書き出し（存在時はスキップ）
- 設定読み込み: injectLocal/injectGlobal（不正時フォールバックtrue）
- before_agent_start: MEMORY.md + daily今日/昨日 を結合 + Local Log Rule を注入
- context フィルタ: injectGlobal=false 時に `<pi-mem-injected>` 除去
- ツール登録: write_local_memory / read_local_memory / scratchpad / search_local_memory の4つ
## 10. 運用ガイドライン
- **日常の開発（デフォルト両方ON）**: グローバル(pi-mem)とローカル(pi-local-mem)が両方見える。プロジェクト固有知識は `write_local_memory(target='daily')` で足元に蓄積、グローバルを汚すリスクをほぼゼロに。
- **マルチエージェント時だけグローバルを切る**: `pi_memory.json` の `injectGlobal` を `false` にして再起動。参照・グローバル記憶の表示が消え、AIはローカル4ファイル＋4ツールだけで自己完結（操作感はpi-memと同じ）。
- **安全な融合作業**: ローカル→グローバルへの知識昇格は「AIに書き出させる → 人間が取捨選択 → グローバルへ手動マージ」（8から変更なし）。
- **完全リセット**: `rm -rf ./.pi-local-mem` → pi起動で新形式クリーン生成（8から変更なし・フォルダ構成だけ9へ拡張）。
