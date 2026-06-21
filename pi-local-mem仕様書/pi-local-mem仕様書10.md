# プロジェクト専用メモリ拡張プラグイン「pi-local-mem」仕様書10（独立完結版・最終仕様）
## 0-1. インストール手順（冒頭に明示・参照先変更時も同じ）
### 検証バージョン（2026-06-20時点・仕様更新時は再確認すること）
| コンポーネント | バージョン | 役割 |
|---|---|---|
| pi 本体 | 0.79.8 | 拡張ローダ・ExtensionAPI 提供元 |
| @haha1903/pi-mem | 1.0.1 | グローバル記憶・注入順序の前提 |
| pi-local-mem.ts | v1.0.0 (2026-06-20) | 本プラグイン（§8コードブロックと完全一致） |
- injectGlobal 遮断は **pi-mem が `context` イベントで `<pi-mem-injected>` を注入する仕様** に依存する。pi-mem 側の注入方式が変わった場合は§5のフィルタ再検討が必要。
- packages 順序は `npm:@haha1903/pi-mem` → `pi-local-mem.ts` の順を前提（pi-mem が前でないと後段フィルタが効かない）。
### 方法A（推奨）: GitHub リポジトリ直指定
```bash
pi uninstall https://github.com/tanadeyu/pi-local-mem  # 既存登録の除去
pi install https://github.com/tanadeyu/pi-local-mem
```
元ファイルの削除・移動制限なし。GitHub上の package.json を参照して拡張機能をロードする。

### 方法B（従来）: ローカルファイル参照
```bash
pi uninstall pi-local-mem        # 既存登録の除去（参照先変更時・再インストール時に必須）
pi install ./pi-local-mem.ts
```
`pi install` は参照登録のみ。インストール後も元ファイルは削除・移動不可。

### 共通注意事項
- 参照先を変える際は `install` 単独だと旧エントリが `~/.pi/agent/settings.json` の packages に残ることがあるため、**一度 `uninstall` してから `install` すること**。
- `pi uninstall` は `.pi-local-mem/` フォルダを削除しない（データ保護）。完全リセットは `rm -rf ./.pi-local-mem` → pi起動で新形式クリーン生成。
- **ローカルファイル参照の場合の注意**: `pi uninstall pi-local-mem` が「No matching package found」で失効するケースあり（パッケージ名解決不可）。この場合は `~/.pi/agent/settings.json` の `packages` 配列を直接編集して旧エントリを削除すること。GitHub方式ではこの問題は発生しない。
- **重複登録の予防**: `pi install` はパス単位で登録されるため、異なるパスは別エントリとして両方残り衝突エラーが発生する。インストール先を変えるときは `grep local-mem ~/.pi/agent/settings.json` で旧エントリの残存を確認すること。
## 0. 経緯（9→10 の変更点）
仕様書9は設計仕様（実装コード未記載）だった。本書は仕様書9の設計を確定させ、**実装コード全文** を含む最終仕様とする。
方針は仕様書9で確定した **方式B（独立実装・コピー持参）**: pi-memへのimport依存ゼロ、pi-local-mem.ts単体で4ファイル＋4ツールを完結。将来pi-memが消えても/使わなくても同等機能を維持。本書は「pi-memの内容も理解でき、pi-memなしでも新規に同じ機能を作れる」よう、pi-mem側の構造とローカル側の実装を対比できる形でまとめる。
## 1. 位置づけ（pi-memとの関係）
| 項目 | pi-mem（@haha1903/pi-mem） | pi-local-mem（本プラグイン） |
|---|---|---|
| 範囲 | グローバル（~/.pi/agent/memory/） | ローカル（./.pi-local-mem/） |
| 依存 | なし（本体） | **pi-memに依存しない**（importなし） |
| 構成 | 4ファイル＋多数ツール＋dashboard等 | 4ファイル＋4ツール（重機能なし） |
| 互換 | — | フォーマット・操作感をpi-mem互換に |
| 存続 | npm配布物 | pi-memがいなくても単体で動く |
本プラグインは pi-mem の「劣化コピー」ではなく、**プロジェクト単位の記憶分離に必要な機能だけを精査して独立実装した最小完結体** である。
## 2. pi-mem機能の新規再現マトリクス（何をどう自分で持つか）
| pi-mem機能 | ローカル実装 | 備考 |
|---|---|---|
| MEMORY_local.md（長期記憶） | ✅ 実装 | 自己完結の核 |
| daily_local/YYYY-MM-DD.md（今日+昨日） | ✅ 実装 | Local Log Ruleの書き先 |
| SCRATCHPAD_local.md（チェックリスト） | ✅ 実装 | ローカル完結で便利 |
| notes_local/*.md（ノート） | ✅ 実装 | target振り分けのみ |
| タイムスタンプ＋セッションID | ✅ 実装 | pi-mem同形式・内部関数コピー |
| memory_write(target/mode) | ✅ write_local_memory | target=long_term/daily/note |
| memory_read(target) | ✅ read_local_memory | target=long_term/scratchpad/daily/note/list |
| scratchpad tool | ✅ local_scratchpad | action=add/done/undo/clear_done/list |
| memory_search | ✅ search_local_memory | 簡易grep・重機能なし |
| contextFiles自動ロード | ❌ 作らない | pi本体別経路の想定・ローカル職責外 |
| catchup/ロールアップ | ❌ 作らない | daily今日+昨日で十分 |
| dashboard（Last 24h） | ❌ 作らない | LLM要約前提・重機能 |
| LLM要約 | ❌ 作らない | APIコスト・最小構成外 |
| session scanner(.jsonl走査) | ❌ 作らない | グローバル資産依存を避ける |
| git autocommit | ❌ 作らない | 無効化方針と整合 |
### 2-補. 命名衝突回避（_local postfix）
pi-mem と併存するため、ローカル側のファイル・ディレクトリ・ツール名には **`_local` postfix** を付ける。これで pi-mem との競合リスクが完全ゼロになり、`injectGlobal:false` で pi-mem を見せない時もローカル資産が明確に区別できる。
- ファイル: `MEMORY_local.md` / `SCRATCHPAD_local.md`
- ディレクトリ: `daily_local/` / `notes_local/`
- ツール: `local_scratchpad`（pi-mem の `scratchpad` と同名競合するため改名。他の3ツールは元から `_local` を含む）
## 3. ディレクトリおよびファイル構造
```
# 【グローバル】（既存pi-mem・完全放置 / 共存可能）
~/.pi/agent/memory/
  └── MEMORY.md 等   # pi-memが従来通り読み書き（injectGlobal:falseでAIには見えなくなるのみ）
# 【ローカル】（pi起動時にプロジェクト直下へ完全自動展開・自己完結）
~/any-your-project-folder/
  └── .pi-local-mem/
        ├── MEMORY_local.md          # 長期記憶（決定・仕様・durable facts）※自動ロード
        ├── SCRATCHPAD_local.md      # チェックリスト（後でやること）※手動read
        ├── daily_local/
        │   └── YYYY-MM-DD.md      # 日次ログ（タイムスタンプ付き追記）※今日+昨日を自動ロード
        ├── notes_local/             # ノート類（手動read）
        └── pi_memory_local.json     # injectLocal / injectGlobal（デフォルト両方true）
```
`pi_memory_local.json`:
```json
{
  "injectLocal": true,
  "injectGlobal": true
}
```
## 4. 自動ロード仕様（before_agent_start）
`injectLocal !== false` の時、ローカル記憶を systemPrompt 末尾へ注入:
- MEMORY_local.md 全文 → `## MEMORY_local.md (long-term)`
- daily_local/今日.md 全文 → `## Daily log: YYYY-MM-DD (today)`
- daily_local/昨日.md 全文 → `## Daily log: YYYY-MM-DD (yesterday)`
- 結合形式: `# Memory (local)\n\n<sectionsを---で区切る>`（pi-memのbuildMemoryContextと同じ構造）
- 末尾に **Local Log Rule** ＋ **Local Memory Targets** 指示（pi-memのDaily Log Ruleと同基準・ツール名差し替え）
SCRATCHPAD_local.md / notes_local は自動ロードしない（pi-memと同じ・必要時にread_local_memoryで取得）。
注入ラッパ: `### [PROJECT LOCAL MEMORY - 優先]\n<section>\n`
## 5. グローバル遮断（injectGlobal）—— 8/9から継承
- `injectGlobal === false` の時、`context` イベント後段フィルタで `<pi-mem-injected>` を含むuserメッセージを除去
- 前提: settings.json の packages で pi-mem が pi-local-mem より前
- 1フラグで「参照(contextFiles)＋ファイル記憶(MEMORY/daily/catchup)」が同時に消える（pi-memが1メッセージに結合しているため）
- pi-memのツール・dashboard は動き続けるが、AIは注入を見ないので実質使わない → ローカル4ツールで自己完結
- デフォルトは両方 true（勝手に消さない・マルチエージェント時だけ false にする運用）
## 6. ツール一覧（4ツール・すべてpi-mem互換）
### 6-1. write_local_memory（pi-mem: memory_write 互換）
- `target`: `long_term` | `daily` | `note`
- `content`: string
- `mode`: `append`（既定） | `overwrite`（dailyは常にappend）
- `filename`: target=note の時に必須
- 振り分け先: long_term→MEMORY_local.md / daily→daily_local/YYYY-MM-DD.md / note→notes_local/<filename>.md
- 自動付与: `<!-- YYYY-MM-DD HH:MM:SS [sessionId8] -->`（pi-mem同形式）
### 6-2. read_local_memory（pi-mem: memory_read 互換）
- `target`: `long_term` | `scratchpad` | `daily` | `note` | `list`
- `date`: target=daily の時（既定: 今日）
- `filename`: target=note の時
- SCRATCHPAD_local/notes_local は手動read（自動ロードしない・pi-memと同じ）
- list は ルート/daily_local/notes_local のファイル一覧を返す
### 6-3. local_scratchpad（pi-mem: scratchpad 互換・名前衝突回避）
- `action`: `add` | `done` | `undo` | `clear_done` | `list`
- `text`: add/done/undo で使用（substring一致）
- フォーマット: `- [ ] text` / `- [x] text`（pi-memと同じ）
- add 時に `<!-- ts [sid] -->` メタを付与（pi-memと同じ）
- ※ツール名は `scratchpad` ではなく `local_scratchpad`（pi-memと同名競合するため改名）
### 6-4. search_local_memory（pi-mem: memory_search 互換・簡易）
- `query`: string（大文字小文字無視の部分一致）
- `max_results`: 既定20
- `.pi-local-mem/` ルート＋daily_local＋notes_local の.mdを走査・ファイル名と行内容を返す
- 重機能(LLM要約)なし・純粋文字列検索のみ
## 7. タイムスタンプ・フォーマット互換（内部関数）
pi-mem/lib.ts の以下関数と **同一ロジック** を内部にコピー持参する（importしない・完全独立）:
| 関数 | ロジック | 用途 |
|---|---|---|
| `nowTimestamp()` | `new Date().toISOString().replace('T',' ').replace(/\.\d+Z$/,'')` | タイムスタンプ `2026-06-20 12:30:00` |
| `shortSessionId(id)` | `id.slice(0,8)` | セッションID `[019ee2e8]` |
| `todayStr()` | `new Date().toISOString().slice(0,10)` | dailyファイル名（今日） |
| `yesterdayStr()` | 昨日の日付 | daily自動ロード（昨日） |
| `readFileSafe(path)` | try-catch付き同期読み込み（失敗時null） | 安全なファイル読み込み |
| `dailyPath(dir,date)` | `path.join(dir, date+'.md')` | dailyファイルパス |
| `parseScratchpad(content)` | `- [x] text` 形式を行解析・meta(直前のHTMLコメント)保持 | SCRATCHPAD読み込み |
| `serializeScratchpad(items)` | `# Scratchpad` ヘッダ＋`- [ ]/[x] text`＋meta | SCRATCHPAD書き出し |
エントリヘッダ: `<!-- 2026-06-20 12:30:00 [019ee2e8] -->`、エントリ間は `\n\n` 区切り。グローバルのdailyとローカルのdailyは同フォーマットで並べても違和感なし。
## 8. ソースコード全文（TypeScript・方式B・完全独立）
以下を `pi-local-mem.ts` として保存し `pi install ./pi-local-mem.ts` で登録。外部依存は `@earendil-works/pi-coding-agent` / `typebox` / `fs` / `path` のみ（pi-memへの依存なし）。
```typescript
/**
 * pi-local-mem.ts v1.0.0 (2026-06-20)・独立完結版・仕様書10準拠
 * 【概要】
 * プロジェクト（カレントディレクトリ）直下にのみ、独立した記憶領域を展開・管理するプラグイン。
 * pi-mem（@haha1903/pi-mem）と互換の4ファイル＋4ツール構成を、pi-memへの依存なしに自己完結で実現。
 * PC全体に「一度だけ」インストールすれば、今後の全プロジェクトで完全自動で記憶を分離する。
 * 【独立性について】
 * 本プラグインは pi-mem への import を一切行わない。必要な関数はすべて内部にコピー持参する。
 * よって pi-mem が packages になくても動き、将来 pi-mem が消えても/使わなくても同等機能を維持する。
 * 【安全性・競合リスクゼロについて】
 * 他プラグインのコードを書き換えない「完全外付け型」の非破壊設計。
 * 【1. インストール方法】
 *   $ pi uninstall https://github.com/tanadeyu/pi-local-mem  # 既存登録の除去
 *   $ pi install https://github.com/tanadeyu/pi-local-mem
 * ※pi install は参照登録のみ。インストール後も元ファイルは削除・移動不可。
 * ※参照先を変える際は install 単独だと旧エントリが残ることがあるため、一度 uninstall してから install すること。
 * 【2. 使い方】
 * 新しいプロジェクトフォルダに移動し、pi を起動するだけ。.pi-local-mem/ が完全自動で展開される。
 * 【3. グローバル記憶の遮断（injectGlobal）】
 * .pi-local-mem/pi_memory_local.json の "injectGlobal": false で、pi-mem が注入する <pi-mem-injected> を
 * 送信前に除去（後段 context フィルタ方式）。packages 順序で pi-mem が pi-local-mem より前であることが前提。
 * 【4. アンインストール】
 *   A. $ pi uninstall https://github.com/tanadeyu/pi-local-mem
 *   B. 手動クリーンアップ: $ rm -rf ./.pi-local-mem
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import * as fs from 'fs';
import * as path from 'path';
// --- 内部関数群（pi-mem/lib.ts と同等ロジックをコピー持参・完全独立）---
function nowTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}
function shortSessionId(id: string): string {
  return id.slice(0, 8);
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function readFileSafe(filePath: string): string | null {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}
function dailyPath(dailyDir: string, date: string): string {
  return path.join(dailyDir, `${date}.md`);
}
interface ScratchpadItem { done: boolean; text: string; meta: string; }
function parseScratchpad(content: string): ScratchpadItem[] {
  const items: ScratchpadItem[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^- \[([ xX])\] (.+)$/);
    if (match) {
      let meta = '';
      if (i > 0 && lines[i - 1].match(/^<!--.*-->$/)) meta = lines[i - 1];
      items.push({ done: match[1].toLowerCase() === 'x', text: match[2], meta });
    }
  }
  return items;
}
function serializeScratchpad(items: ScratchpadItem[]): string {
  const lines: string[] = ['# Scratchpad', ''];
  for (const item of items) {
    if (item.meta) lines.push(item.meta);
    lines.push(`- ${item.done ? '[x]' : '[ ]'} ${item.text}`);
  }
  return lines.join('\n') + '\n';
}
export default function (pi: ExtensionAPI) {
  const currentDir = process.cwd();
  const localDir = path.join(currentDir, '.pi-local-mem');
  const dailyDir = path.join(localDir, 'daily_local');
  const notesDir = path.join(localDir, 'notes_local');
  const memoryFile = path.join(localDir, 'MEMORY_local.md');
  const scratchpadFile = path.join(localDir, 'SCRATCHPAD_local.md');
  const configPath = path.join(localDir, 'pi_memory_local.json');
  // 1. 起動時に隠しフォルダと全ファイルを展開（存在時はスキップ・ユーザー設定保護）
  if (!fs.existsSync(localDir)) {
    try {
      fs.mkdirSync(dailyDir, { recursive: true });
      fs.mkdirSync(notesDir, { recursive: true });
      fs.writeFileSync(memoryFile, '# プロジェクト個別記憶\n\nここにこのプロジェクト特有の仕様・型定義・TODO・決定事項などを記録してください。\n', 'utf8');
      fs.writeFileSync(scratchpadFile, '# Scratchpad (local)\n', 'utf8');
      fs.writeFileSync(configPath, JSON.stringify({ injectLocal: true, injectGlobal: true }, null, 2), 'utf8');
    } catch (err) {
      console.error(`⚠️ pi-local-mem: 初期化に失敗しました: ${err.message}`);
    }
  }
  // 2. 設定ファイルの安全な読み込み
  let config: { injectLocal?: boolean; injectGlobal?: boolean } = { injectLocal: true, injectGlobal: true };
  if (fs.existsSync(configPath)) {
    try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) {
      console.warn('⚠️ pi-local-mem: 設定ファイルのパースに失敗したため、デフォルト(true)で起動します。');
    }
  }
  // 3. コンテキスト注入（ローカル記憶をAI頭脳へ自動マージ + Local Log Rule）
  //    pi-mem の Daily Log Rule と同基準・ツール名だけ差し替え。
  const localLogRule = [
    '### Local Log Rule',
    'After meaningful interactions, call write_local_memory(target="daily") with a brief 1-2 sentence summary.',
    '**Log when:** task completed, decision made, bug fixed, new info discovered, config changed.',
    '**Skip when:** greetings, goodbyes, chitchat, simple acks, trivial factual questions.',
    'Log the outcome, not the question (e.g. "Debugged import error — missing __init__.py" not "User asked about imports").',
    '',
    '### Local Memory Targets',
    '- Decisions, preferences, durable facts → write_local_memory(target="long_term")',
    '- Day-to-day notes → write_local_memory(target="daily")',
    '- Things to fix later → local_scratchpad tool',
    '- Scratchpad is NOT auto-loaded. Use read_local_memory(target="scratchpad") when needed.',
    '- If someone says "remember this," write it immediately.',
  ].join('\n');
  if (config.injectLocal !== false) {
    pi.on('before_agent_start', async (event, _ctx) => {
      try {
        const sections: string[] = [];
        const mem = readFileSafe(memoryFile)?.trim();
        if (mem) sections.push(`## MEMORY.md (long-term)\n\n${mem}`);
        const today = readFileSafe(dailyPath(dailyDir, todayStr()))?.trim();
        if (today) sections.push(`## Daily log: ${todayStr()} (today)\n\n${today}`);
        const yd = readFileSafe(dailyPath(dailyDir, yesterdayStr()))?.trim();
        if (yd) sections.push(`## Daily log: ${yesterdayStr()} (yesterday)\n\n${yd}`);
        const body = sections.length ? `# Memory\n\n${sections.join('\n\n---\n\n')}` : '';
        const section = body ? `${body}\n\n${localLogRule}` : localLogRule;
        return { systemPrompt: event.systemPrompt + `\n\n### [PROJECT LOCAL MEMORY - 優先]\n${section}\n` };
      } catch (e) { return {}; }
    });
  }
  // 4. グローバル記憶（pi-mem）の注入遮断 —— context 後段フィルタ
  if (config.injectGlobal === false) {
    pi.on('context', async (event) => {
      try {
        const messages = (event.messages as any[]).filter(m => {
          if (m.role === 'user' && typeof m.content === 'string') return !m.content.includes('<pi-mem-injected>');
          return true;
        });
        return { messages };
      } catch (e) { return {}; }
    });
  }
  // 5. セッションID取得ヘルパ（ctxから安全に取得）
  function getSid(ctx: any): string {
    try { return shortSessionId(String(ctx.sessionManager.getSessionId())); } catch { return '--------'; }
  }
  // 6. ツール: write_local_memory（pi-mem: memory_write 互換）
  pi.registerTool({
    name: 'write_local_memory',
    label: 'Write Local Memory',
    description: [
      '現在のプロジェクトの .pi-local-mem/ へ記憶を書き込むツール（pi-mem memory_write 互換・完全独立）。',
      'target: "long_term"→MEMORY.md / "daily"→daily/YYYY-MM-DD.md / "note"→notes/<filename>.md',
      'mode: "append"(既定) or "overwrite"。daily は常に append。タイムスタンプ+セッションID(先頭8桁)自動付与。',
    ].join('\n'),
    parameters: Type.Object({
      target: Type.String({ description: 'long_term | daily | note' }),
      content: Type.String({ description: '書き込む内容（Markdown）' }),
      mode: Type.Optional(Type.String({ description: 'append or overwrite. default: append' })),
      filename: Type.Optional(Type.String({ description: 'target=note の時に必須 (例: lessons.md)' })),
    }),
    async execute(_id, params, _s, _o, ctx) {
      try {
        fs.mkdirSync(dailyDir, { recursive: true });
        fs.mkdirSync(notesDir, { recursive: true });
        const ts = nowTimestamp();
        const sid = getSid(ctx);
        const stamped = `<!-- ${ts} [${sid}] -->\n${params.content}`;
        const { target, content, mode, filename } = params;
        if (target === 'daily') {
          const file = dailyPath(dailyDir, todayStr());
          const existing = readFileSafe(file) ?? '';
          const sep = existing.trim() ? '\n\n' : '';
          fs.writeFileSync(file, existing + sep + stamped, 'utf8');
          return { content: [{ type: 'text', text: `✅ daily/${todayStr()}.md に追記しました` }] };
        }
        if (target === 'note') {
          if (!filename) return { content: [{ type: 'text', text: "Error: 'filename' required for target 'note'." }] };
          const safe = path.basename(filename);
          const file = path.join(notesDir, safe);
          if (mode === 'overwrite') { fs.writeFileSync(file, stamped, 'utf8'); return { content: [{ type: 'text', text: `✅ notes/${safe} を上書きしました` }] }; }
          const existing = readFileSafe(file) ?? '';
          const sep = existing.trim() ? '\n\n' : '';
          fs.writeFileSync(file, existing + sep + stamped, 'utf8');
          return { content: [{ type: 'text', text: `✅ notes/${safe} に追記しました` }] };
        }
        // long_term
        if (mode === 'overwrite') { fs.writeFileSync(memoryFile, stamped, 'utf8'); return { content: [{ type: 'text', text: '✅ MEMORY.md を上書きしました' }] }; }
        const existing = readFileSafe(memoryFile) ?? '';
        const sep = existing.trim() ? '\n\n' : '';
        fs.writeFileSync(memoryFile, existing + sep + stamped, 'utf8');
        return { content: [{ type: 'text', text: '✅ MEMORY.md に追記しました' }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `❌ 保存失敗: ${err.message}` }], isError: true };
      }
    },
  });
  // 7. ツール: read_local_memory（pi-mem: memory_read 互換）
  pi.registerTool({
    name: 'read_local_memory',
    label: 'Read Local Memory',
    description: [
      'ローカル記憶を読むツール（pi-mem memory_read 互換）。',
      'target: long_term|scratchpad|daily|note|list。SCRATCHPAD/notes は手動read。',
    ].join('\n'),
    parameters: Type.Object({
      target: Type.String({ description: 'long_term | scratchpad | daily | note | list' }),
      date: Type.Optional(Type.String({ description: 'target=daily の日付(YYYY-MM-DD)。既定: 今日' })),
      filename: Type.Optional(Type.String({ description: 'target=note のファイル名' })),
    }),
    async execute(_id, params) {
      const { target, date, filename } = params;
      try {
        if (target === 'list') {
          const parts: string[] = [];
          const root = fs.readdirSync(localDir).filter((f: string) => f.endsWith('.md')).sort();
          if (root.length) parts.push(`Files:\n${root.map((f: string) => `- ${f}`).join('\n')}`);
          const dl = fs.readdirSync(dailyDir).filter((f: string) => f.endsWith('.md')).sort().reverse();
          if (dl.length) parts.push(`Daily (${dl.length}):\n${dl.slice(0, 10).map((f: string) => `- daily/${f}`).join('\n')}`);
          const nl = fs.readdirSync(notesDir).filter((f: string) => f.endsWith('.md')).sort();
          if (nl.length) parts.push(`Notes:\n${nl.map((f: string) => `- notes/${f}`).join('\n')}`);
          return { content: [{ type: 'text', text: parts.join('\n\n') || '空です' }] };
        }
        if (target === 'scratchpad') {
          const c = readFileSafe(scratchpadFile);
          return { content: [{ type: 'text', text: c?.trim() || 'SCRATCHPAD.md は空です' }] };
        }
        if (target === 'daily') {
          const d = date ?? todayStr();
          const c = readFileSafe(dailyPath(dailyDir, d));
          return { content: [{ type: 'text', text: c || `No daily log for ${d}` }] };
        }
        if (target === 'note') {
          if (!filename) return { content: [{ type: 'text', text: "Error: 'filename' required" }] };
          const c = readFileSafe(path.join(notesDir, path.basename(filename)));
          return { content: [{ type: 'text', text: c || `Not found: notes/${filename}` }] };
        }
        const c = readFileSafe(memoryFile);
        return { content: [{ type: 'text', text: c || 'MEMORY.md は空です' }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `❌ ${err.message}` }], isError: true };
      }
    },
  });
  // 8. ツール: local_scratchpad（pi-mem: scratchpad 互換・名前衝突回避）
  pi.registerTool({
    name: 'local_scratchpad',
    label: 'Local Scratchpad',
    description: 'チェックリスト管理。action: add|done|undo|clear_done|list。textはadd/done/undoで使用(substring一致)。',
    parameters: Type.Object({
      action: Type.String({ description: 'add | done | undo | clear_done | list' }),
      text: Type.Optional(Type.String({ description: 'add/done/undo の文字列' })),
    }),
    async execute(_id, params, _s, _o, ctx) {
      try {
        const existing = readFileSafe(scratchpadFile) ?? '';
        let items = parseScratchpad(existing);
        const { action, text } = params;
        const ts = nowTimestamp();
        const sid = getSid(ctx);
        if (action === 'list') {
          return { content: [{ type: 'text', text: items.length ? serializeScratchpad(items) : '空です' }] };
        }
        if (action === 'add') {
          if (!text) return { content: [{ type: 'text', text: "Error: 'text' required" }] };
          items.push({ done: false, text, meta: `<!-- ${ts} [${sid}] -->` });
          fs.writeFileSync(scratchpadFile, serializeScratchpad(items), 'utf8');
          return { content: [{ type: 'text', text: `Added: - [ ] ${text}` }] };
        }
        if (action === 'done' || action === 'undo') {
          if (!text) return { content: [{ type: 'text', text: `Error: 'text' required for ${action}` }] };
          const needle = text.toLowerCase();
          const targetDone = action === 'done';
          let matched = false;
          for (const item of items) {
            if (item.done !== targetDone && item.text.toLowerCase().includes(needle)) { item.done = targetDone; matched = true; break; }
          }
          if (!matched) return { content: [{ type: 'text', text: `No match: "${text}"` }] };
          fs.writeFileSync(scratchpadFile, serializeScratchpad(items), 'utf8');
          return { content: [{ type: 'text', text: 'Updated.' }] };
        }
        if (action === 'clear_done') {
          const before = items.length;
          items = items.filter(i => !i.done);
          fs.writeFileSync(scratchpadFile, serializeScratchpad(items), 'utf8');
          return { content: [{ type: 'text', text: `Cleared ${before - items.length} item(s).` }] };
        }
        return { content: [{ type: 'text', text: `Unknown action: ${action}` }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `❌ ${err.message}` }], isError: true };
      }
    },
  });
  // 9. ツール: search_local_memory（pi-mem: memory_search 互換・簡易grep）
  pi.registerTool({
    name: 'search_local_memory',
    label: 'Search Local Memory',
    description: '.pi-local-mem/ 配下の.mdをファイル名+内容の部分一致で検索（大文字小文字無視）。',
    parameters: Type.Object({
      query: Type.String({ description: '検索クエリ' }),
      max_results: Type.Optional(Type.Number({ description: '最大結果数(既定20)' })),
    }),
    async execute(_id, params) {
      try {
        const needle = params.query.toLowerCase();
        const limit = params.max_results ?? 20;
        const fileMatches: string[] = [];
        const lines: { file: string; line: number; text: string }[] = [];
        const searchFile = (file: string, disp: string) => {
          if (disp.toLowerCase().includes(needle) && !fileMatches.includes(disp)) fileMatches.push(disp);
          const c = readFileSafe(file);
          if (!c) return;
          const ls = c.split('\n');
          for (let i = 0; i < ls.length && lines.length < limit; i++) {
            if (ls[i].toLowerCase().includes(needle)) lines.push({ file: disp, line: i + 1, text: ls[i].trimEnd() });
          }
        };
        const searchDir = (dir: string, prefix: string) => {
          try {
            const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.md')).sort();
            for (const f of files) { if (lines.length >= limit) break; searchFile(path.join(dir, f), prefix ? `${prefix}/${f}` : f); }
          } catch {}
        };
        searchDir(localDir, '');
        searchDir(dailyDir, 'daily');
        searchDir(notesDir, 'notes');
        if (!fileMatches.length && !lines.length) return { content: [{ type: 'text', text: `No results for "${params.query}"` }] };
        const parts: string[] = [];
        if (fileMatches.length) parts.push(`Files:\n${fileMatches.map(f => `- ${f}`).join('\n')}`);
        if (lines.length) parts.push(`Content:\n${lines.map(r => `${r.file}:${r.line}: ${r.text}`).join('\n')}`);
        return { content: [{ type: 'text', text: parts.join('\n\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `❌ ${err.message}` }], isError: true };
      }
    },
  });
}
```
## 9. pi-mem なしで新規に同じ機能を作る時の手引き
本プラグインは pi-mem への依存を持たないため、以下の手順で pi-mem が存在しない環境でも同等機能を新規構築できる:
1. **§8のソースコード全文** を `pi-local-mem.ts` として任意の場所に保存
2. `pi uninstall pi-local-mem` → `pi install ./pi-local-mem.ts` で登録（参照登録のみ・元ファイルは削除移動不可）。参照先変更時は一度 uninstall してから install すること（install 単独だと旧エントリが残ることがある）
3. 任意のプロジェクトで `pi` を起動 → `.pi-local-mem/` が4ファイル構成で自動展開
4. 必須依存は `@earendil-works/pi-coding-agent` / `typebox` / Node標準(`fs`,`path`) のみ。pi-mem は不要
5. グローバル遮断(`injectGlobal`)は pi-mem がいないと無意味だが、**ローカル4ファイル＋4ツールは単体で完全動作** する
6. カスタマイズ時は §7 の内部関数群が pi-mem と同等ロジックであることを踏まえ、フォーマット互換を壊さない範囲で編集
### pi-mem の構造を理解したい時の参照先（存在する場合のみ）
- `/home/hello/.pi/agent/npm/node_modules/@haha1903/pi-mem/index.ts` — イベント注入・ツール登録・dashboard
- 同 `lib.ts` — 設定・日付・scratchpad・検索の純粋関数群
- 本プラグインは lib.ts の安定純粋関数のみをコピー持参し、index.ts の重機能(dashboard/LLM要約/session scanner)は持たない
## 10. 運用ガイドライン
- **日常の開発（デフォルト両方ON）**: グローバル(pi-mem)とローカル(pi-local-mem)が両方見える。プロジェクト固有知識は `write_local_memory(target='daily')` で足元に蓄積、グローバルを汚すリスクをほぼゼロに。
- **マルチエージェント時だけグローバルを切る**: `pi_memory_local.json` の `injectGlobal` を `false` にして再起動。参照・グローバル記憶の表示が消え、AIはローカル4ファイル＋4ツールだけで自己完結（操作感はpi-memと同じ）。
- **安全な融合作業**: ローカル→グローバルへの知識昇格は「AIに書き出させる → 人間が取捨選択 → グローバルへ手動マージ」。
- **完全リセット**: `rm -rf ./.pi-local-mem` → pi起動で新形式クリーン生成（4ファイル構成で再展開）。
