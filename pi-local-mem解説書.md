# pi-local-mem.ts 解説書 — プログラム初心者でもわかる完全ガイド
このファイルは **pi という AI コーディングエージェントに「プロジェクトごとの記憶」を追加する拡張機能**です。
## そもそも pi とは？
pi はターミナルで動く**AI プログラミングアシスタント**です。ユーザーが「このファイルを作って」「このバグを直して」と指示すると、AI がコードを読んだり書いたりしてくれます。pi には「拡張機能」を追加でき、この `pi-local-mem.ts` もそのひとつです。
## 何をするもの？
通常 pi は会話ごとに「記憶」を引き継ぎません。しかし「このプロジェクトでは〜という仕様にしよう」といった情報を毎回忘れてしまうと不便です。
**pi-local-mem** を入れると、プロジェクトフォルダに `.pi-local-mem/` という隠しフォルダが自動生成され、そこに**プロジェクト専用の記憶**を保存・参照できるようになります。PC 全体に一度インストールすれば、以降**新しいプロジェクトフォルダに移動して pi を起動するたびに**自動で記憶領域が作られます。
## ファイルの全体像
この1ファイル（約420行）で以下をすべて実現しています：
| # | 名前 | やっていること |
|---|---|---|
| 1 | 起動時の自動生成 | `.pi-local-mem/` フォルダと中身のファイルを自動作成 |
| 2 | AIへの記憶注入 | 保存された記憶を AI が読める形でプロンプトに追加 |
| 3 | グローバル記憶の遮断 | 必要に応じて PC 全体の記憶をオフにできる |
| 4 | 4つのツール | AI が記憶を読み書きするための道具 |
以下、**コードを前から順に**見ていきます。
## 1. 最初のコメントブロック（1〜32行目）
```typescript
/**
 * pi-local-mem.ts v1.0.0 (2026-06-20)・独立完結版・仕様書10準拠
 * 【概要】
 * プロジェクト（カレントディレクトリ）直下にのみ、独立した記憶領域を展開・管理するプラグイン。
 * ...
 */
```
ファイルの先頭にある `/** ... */` は**コメント**です。プログラムの動作には関係なく、人間が読むための説明書きです。ここでは **「この拡張機能は何か」「どうインストールするか」「どう使うか」** が書いてあります。
## 2. おまじないの import（34〜37行目）
```typescript
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import * as fs from 'fs';
import * as path from 'path';
```
`import` は「他の場所にある便利な道具を借りてくる」宣言です。
- **ExtensionAPI** — pi の拡張機能を作るための「型定義」（設計図のようなもの）
- **Type** — AI にツールの使い方を教えるための「型」（どんな引数が必要か定義する）
- **fs** — ファイルを読んだり書いたりするための Node.js 標準機能
- **path** — ファイルのパス（住所）を扱うための Node.js 標準機能
「Node.js」は JavaScript/TypeScript をパソコン上で動かすための土台です。
## 3. 小さなヘルパー関数（39〜68行目）
ファイルの後半で何度も使う、小さな処理を先に関数として定義しています。
### nowTimestamp() — 今の時刻を文字列で返す
```typescript
function nowTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}
```
- `new Date()` で現在時刻を取得、`toISOString()` で `"2026-06-21T12:34:56.789Z"` という標準形式に変換
- `T` を半角スペースに、末尾のミリ秒と `Z` を削除 → `"2026-06-21 12:34:56"` という見やすい形にする
**返り値の例**: `"2026-06-21 12:34:56"`
### shortSessionId() — 長いIDを短くする
```typescript
function shortSessionId(id: string): string {
  return id.slice(0, 8);
}
```
pi の会話（セッション）には長いID（例: `019ee7dd-abcd-efgh-ijkl-mnopqrstuv`）が振られますが、見づらいので先頭8文字だけ取り出します。**返り値の例**: `"019ee7dd"`
### todayStr() — 今日の日付
```typescript
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
```
ISO形式の日付から前10文字だけ取り出します。**返り値の例**: `"2026-06-21"`
### yesterdayStr() — 昨日の日付
```typescript
function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
```
現在時刻から1日戻してから、日付部分だけ取り出します。**返り値の例**: `"2026-06-20"`
### readFileSafe() — ファイルを安全に読む
```typescript
function readFileSafe(filePath: string): string | null {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}
```
- ファイルを読もうと試みる。成功したら文字列を返す。失敗したら（ファイル不在など）`null` を返す（エラーで止まらない）
- `try...catch` は「失敗しても大丈夫」の構文
### dailyPath() — 日記ファイルのパスを作る
```typescript
function dailyPath(dailyDir: string, date: string): string {
  return path.join(dailyDir, `${date}.md`);
}
```
`dailyDir`（例: `/プロジェクト/.pi-local-mem/daily_local`）と `date`（例: `"2026-06-21"`）を組み合わせて**フルパスのファイル名**を作ります。**返り値の例**: `/mnt/c/projects/pi-local-mem/.pi-local-mem/daily_local/2026-06-21.md`
### ScratchpadItem インターフェース
```typescript
interface ScratchpadItem { done: boolean; text: string; meta: string; }
```
「チェックリストの1項目」を表す型定義：`done`=完了したか, `text`=内容, `meta`=補足情報
### parseScratchpad() — チェックリストを読み解く
```typescript
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
```
SCRATCHPAD.md に書かれたチェックリスト（`- [ ] やること` / `- [x] やったこと`）を解析してプログラムで扱いやすい形に変換します。**例**: `- [x] バグ修正` → `{ done: true, text: "バグ修正", meta: "" }`
### serializeScratchpad() — チェックリストを書き戻す
```typescript
function serializeScratchpad(items: ScratchpadItem[]): string {
  const lines: string[] = ['# Scratchpad', ''];
  for (const item of items) {
    if (item.meta) lines.push(item.meta);
    lines.push(`- ${item.done ? '[x]' : '[ ]'} ${item.text}`);
  }
  return lines.join('\n') + '\n';
}
```
`parseScratchpad` の逆。プログラムで処理したチェックリストを再びファイル保存できるテキストに戻します。
## 4. メイン関数（73行目〜最後）
```typescript
export default function (pi: ExtensionAPI) {
```
`export default function` は**「このファイルは pi の拡張機能ですよ」**という印です。pi が起動時にこの関数を呼び出します。
### 4-1. パスの設定（74〜80行目）
```typescript
const currentDir = process.cwd();
const localDir = path.join(currentDir, '.pi-local-mem');
const dailyDir = path.join(localDir, 'daily_local');
const notesDir = path.join(localDir, 'notes_local');
const memoryFile = path.join(localDir, 'MEMORY_local.md');
const scratchpadFile = path.join(localDir, 'SCRATCHPAD_local.md');
const configPath = path.join(localDir, 'pi_memory_local.json');
```
まず、記憶を保存するフォルダとファイルの**住所（パス）**を計算します。
| 変数名 | 実際のパス（例） | 用途 |
|---|---|---|
| `currentDir` | `/mnt/c/projects/pi-local-mem` | 今いるプロジェクトフォルダ |
| `localDir` | `.../.pi-local-mem` | 記憶のトップフォルダ |
| `dailyDir` | `.../.pi-local-mem/daily_local` | 日記を保存するサブフォルダ |
| `notesDir` | `.../.pi-local-mem/notes_local` | メモを保存するサブフォルダ |
| `memoryFile` | `.../.pi-local-mem/MEMORY_local.md` | 長期的な記憶のファイル |
| `scratchpadFile` | `.../.pi-local-mem/SCRATCHPAD_local.md` | チェックリストのファイル |
| `configPath` | `.../.pi-local-mem/pi_memory_local.json` | 設定ファイル |
ファイル名が `_local` で終わっているのは別の拡張機能（pi-mem）と名前が衝突しないようにする工夫です。
### 4-2. 初回起動時の自動生成（82〜94行目）
```typescript
if (!fs.existsSync(localDir)) {
  try {
    fs.mkdirSync(dailyDir, { recursive: true });
    fs.mkdirSync(notesDir, { recursive: true });
    fs.writeFileSync(memoryFile, '...');
    fs.writeFileSync(scratchpadFile, '# Scratchpad (local)\n');
    fs.writeFileSync(configPath, JSON.stringify({ injectLocal: true, injectGlobal: true }, null, 2));
  } catch (err) {
    console.error(`⚠️ pi-local-mem: 初期化に失敗しました: ${err.message}`);
  }
}
```
**初めて**そのプロジェクトフォルダで pi を起動したときだけ実行されます。`.pi-local-mem/` フォルダが存在するかチェック→なければフォルダと初期ファイルをすべて作成。`{ recursive: true }` でサブフォルダも含めて一気に作成。万一失敗してもエラーメッセージ表示のみで pi 本体は止まらない（安全設計）。2回目以降は何もしません（ユーザー編集ファイルの上書き保護）。
### 4-3. 設定ファイルの読み込み（96〜102行目）
```typescript
let config = { injectLocal: true, injectGlobal: true };
if (fs.existsSync(configPath)) {
  try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) {
    console.warn('⚠️ pi-local-mem: 設定ファイルのパースに失敗...');
  }
}
```
`pi_memory_local.json` を JSON として読み込み、失敗してもデフォルト値（両方 true）で安全動作。**2つの設定項目**: `injectLocal`（ローカル記憶をAIに自動読ませるか）と `injectGlobal`（PC全体の記憶を読ませるか）
### 4-4. AIへの記憶注入（104〜128行目）← 最も重要
```typescript
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
```
**流れ**: ① `pi.on('before_agent_start', ...)` で「AIが会話を始める直前」に処理を登録 ② 3つのファイルを読む（`MEMORY_local.md` / 今日の日記 / 昨日の日記）③ それらを連結し `localLogRule`（後述）と一緒にひとつの文章に ④ AI への指示（systemPrompt）の末尾に追記して返す→**AI が常にプロジェクトの記憶を参照できる**ようになる。

**Local Log Rule** とは AI に「記憶を書き残す習慣」を教える指示文：「意味のある作業を終えたら1〜2行の要約を daily に書きなさい」「タスク完了・決定・バグ修正・新情報発見・設定変更のときに書くこと」「挨拶や雑談では書かない」
### 4-5. グローバル記憶の遮断（130〜139行目）
```typescript
if (config.injectGlobal === false) {
  pi.on('context', async (event) => {
    try {
      const messages = (event.messages as any[]).filter(m => {
        if (m.role === 'user' && typeof m.content === 'string')
          return !m.content.includes('<pi-mem-injected>');
        return true;
      });
      return { messages };
    } catch (e) { return {}; }
  });
}
```
設定で `injectGlobal: false` にしたときだけ有効。別の拡張機能（pi-mem）が注入するグローバル記憶には `<pi-mem-injected>` という目印があり、その目印を含むユーザーメッセージを**フィルタリング（除外）**します。これにより「PC全体の記憶は使わずこのプロジェクトの記憶だけ使う」設定が可能に。
### 4-6. セッションID取得ヘルパ（141〜144行目）
```typescript
function getSid(ctx: any): string {
  try { return shortSessionId(String(ctx.sessionManager.getSessionId())); }
  catch { return '--------'; }
}
```
会話のセッションIDを安全に取得する小さな関数。失敗しても `'--------'` を返すのでエラーになりません。
### 4-7. 4つのツール（146〜416行目）
ここから4つの「ツール」を pi に登録します。ツールとは AI が呼び出せる機能のことです。
#### ツール①: write_local_memory（記憶を書き込む）
```typescript
pi.registerTool({
  name: 'write_local_memory',
  label: 'Write Local Memory',
  description: '現在のプロジェクトの .pi-local-mem/ へ記憶を書き込むツール...',
  parameters: Type.Object({
    target: Type.String({ description: 'long_term | daily | note' }),
    content: Type.String({ description: '書き込む内容（Markdown）' }),
    mode: Type.Optional(Type.String({ description: 'append or overwrite. default: append' })),
    filename: Type.Optional(Type.String({ description: 'target=note の時に必須' })),
  }),
  async execute(_id, params, _s, _o, ctx) {
    // ...保存処理...
  },
});
```
**AI が「これを覚えておいて」と言われたときに呼ぶツール**。
- **引数**: `target`（保存先: long_term/daily/note）, `content`（内容）, `mode`（追記/上書き）, `filename`（note用）
- **処理**: 保存先フォルダがなければ作成→現在時刻+セッションIDを自動付与→`target`に応じて適切なファイルに書き込み→結果をAIに返す
#### ツール②: read_local_memory（記憶を読む）
**AI が「前に何を覚えてたっけ？」と思ったときに呼ぶツール**。
- **引数**: `target`（読む対象）, `date`（日記の日付）, `filename`（noteのファイル名）
- **機能**: `list`で全ファイル一覧, `scratchpad`でチェックリスト表示, `daily`で指定日の日記, `note`で特定メモ, 上記以外なら長期記憶
#### ツール③: local_scratchpad（チェックリスト管理）
**AI が「やることリスト」を管理するツール**。操作一覧：
| 操作 | 意味 | 例 |
|---|---|---|
| `add` | 項目を追加 | やること・課題をリストに追加 |
| `done` | 完了にチェック | 片付いたタスクを ✅ に |
| `undo` | 未完了に戻す | チェックを外す |
| `clear_done` | 完了項目を一掃 | 終わったタスクをリストから削除 |
| `list` | 一覧表示 | 今の状態を全部見る |
SCRATCHPAD_local.md に保存され次回も継続利用可能。
#### ツール④: search_local_memory（全文検索）
**AI が過去の記憶をキーワードで探すツール**。`query`（検索したい言葉）を受け取り、大文字小文字区別なく `.pi-local-mem/` 配下の全 `.md` ファイルを検索。見つかった行を「ファイル名:行番号:内容」形式で返す。
## 5. 全体の処理の流れ（まとめ）
```
pi 起動
 ├─ 1. .pi-local-mem/ がなければ自動作成
 ├─ 2. 設定ファイルを読む
 ├─ 3. AI起動直前: 記憶をプロンプトに注入
 │    ├─ MEMORY_local.md（長期記憶）
 │    ├─ 今日の日記（あれば）
 │    ├─ 昨日の日記（あれば）
 │    └─ Local Log Rule（AIへの指示）
 ├─ 4. 必要ならグローバル記憶を遮断
 └─ 5. 4つのツールを提供
      ├─ write_local_memory  （記憶を書く）
      ├─ read_local_memory   （記憶を読む）
      ├─ local_scratchpad    （チェックリスト）
      └─ search_local_memory （全文検索）
```
## 6. キーワード解説
| 用語 | ざっくり意味 |
|---|---|
| **TypeScript** | JavaScript に「型」の概念を追加したプログラミング言語 |
| **拡張機能** | 他のソフトに機能を追加する部品。pi では `.ts` ファイル |
| **関数** | 処理をひとまとめにしたもの。呼び出すと結果を返す |
| **変数** | 値を入れておく箱。`const` は再代入できない変数 |
| **パス** | ファイルやフォルダの住所（例: `/home/project/file.txt`） |
| **JSON** | データを `{ "名前": 値 }` の形で書く形式。設定ファイルに使う |
| **async/await** | 「待ち」が発生する処理を効率よく書く仕組み |
| **イベント** | 「起動するよ」「設定が変わったよ」などの出来事 |
| **プロンプト** | AI に与える指示文。systemPrompt は「人格設定」のようなもの |
| **context** | AI との会話のやりとり全体 |
| **inject** | 注入する。記憶を AI のプロンプトに自動で埋め込むこと |
| **grep** | ファイルの中から特定の文字列を探す操作 |
| **semver** | `1.0.1` のようなバージョンの付け方のルール |
## 7. なぜ「独立完結版」なのか
この拡張機能は元となった **pi-mem** という別の拡張機能と**互換性がありますが、pi-mem への依存がゼロ**です。pi-mem の関数を一切 import せず必要なロジックをすべてこのファイル内にコピーしています（「コピー持参」方式）。
**メリット**: pi-mem がインストールされていなくても動く / pi-mem のアップデートで互換性が壊れても影響を受けない / 設定次第で pi-mem との併用も単独運用もできる
---
これで解説は以上です。「この部分をもっと詳しく」や「この用語がわからない」などあれば聞いてください。
