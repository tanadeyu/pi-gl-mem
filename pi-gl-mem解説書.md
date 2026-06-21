# pi-gl-mem.ts 解説書 — プログラム初心者でもわかる完全ガイド
このファイルは **pi という AI コーディングエージェントに「プロジェクトごとの記憶」＋「PC全体の記憶」を追加する拡張機能**です。

## そもそも pi とは？
pi はターミナルで動く**AI プログラミングアシスタント**です。ユーザーが「このファイルを作って」「このバグを直して」と指示すると、AI がコードを読んだり書いたりしてくれます。pi には「拡張機能」を追加でき、この `pi-gl-mem.ts` もそのひとつです。

## 何をするもの？
通常 pi は会話ごとに「記憶」を引き継ぎません。しかし「このプロジェクトでは〜という仕様にしよう」といった情報を毎回忘れてしまうと不便です。

**pi-gl-mem** を入れると、**2つの記憶領域**が使えるようになります：

| 記憶の種類 | 保存場所 | 何に使う |
|-----------|---------|---------|
| 🌐 **グローバル記憶** | `~/.pi/agent/pi-gl-mem/MEMORY.md` | PC全体で共有したい知識（全プロジェクト横断） |
| 📁 **ローカル記憶** | `./.pi-gl-mem/` | プロジェクト固有の仕様・TODO・日次ログ |

PC 全体に一度インストールすれば、以降**どのプロジェクトでも**自動的に記憶の仕組みが使えるようになります。

## 前バージョン（pi-local-mem）からの進化点

| 項目 | pi-local-mem | pi-gl-mem |
|------|-------------|-----------|
| グローバル記憶 | なし（pi-mem 任せ） | ✅ 自前で1ファイル管理 |
| ツール数 | 4つ（ローカル専用） | **6つ**（グローバル＋ローカル） |
| 上方向探索 | なし（現在フォルダ固定） | ✅ 親フォルダも自動探索 |
| エラー安全性 | 未init時にエラーが出ることがあった | ✅ 早期returnで何もしない |
| ファイル名 | `_local` postfix 付き | postfix なし（すっきり） |

## ファイルの全体像
この1ファイル（約340行）で以下をすべて実現しています：

| # | 名前 | やっていること |
|---|------|-------------|
| 1 | 上方向探索 | `.pi-gl-mem/` を現在フォルダ→親→…と自動で探す |
| 2 | 早期returnガード | 見つからなければ何もせず終了（エラーにならない） |
| 3 | グローバル注入 | `~/.pi/agent/pi-gl-mem/MEMORY.md` を AI に読ませる |
| 4 | ローカル注入 | プロジェクトの記憶を AI に読ませる |
| 5 | 6つのツール | AI が記憶を読み書きするための道具 |

以下、**コードを前から順に**見ていきます。

## 1. 最初のコメントブロック（1〜27行目）

```typescript
/**
 * pi-gl-mem.ts v1.0.0 (2026-06-21)・独立完結版・pi-gl-mem仕様書01準拠
 * 【概要】
 * pi エージェント向け記憶管理プラグイン。
 * グローバル記憶（~/.pi/agent/pi-gl-mem/）とローカル記憶（./.pi-gl-mem/）の
 * 両方を提供する。pi-mem（@haha1903/pi-mem）への依存ゼロ・完全独立。
 * ...
 */
```

ファイルの先頭にある `/** ... */` は**コメント**です。プログラムの動作には関係なく、人間が読むための説明書きです。ここでは**「この拡張機能は何か」「どうインストールするか」「どう使うか」**が書いてあります。

## 2. おまじないの import（29〜32行目）

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

## 3. 小さなヘルパー関数（34〜63行目）

ファイルの後半で何度も使う、小さな処理を先に関数として定義しています。

### nowTimestamp() — 今の時刻を文字列で返す

```typescript
function nowTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}
```

`new Date()` で現在時刻を取得、ISO形式から不要部分を取り除いて `"2026-06-21 12:34:56"` という見やすい形にします。

### shortSessionId() — 長いIDを短くする

```typescript
function shortSessionId(id: string): string {
  return id.slice(0, 8);
}
```

pi の会話（セッション）には長いIDが振られますが、見づらいので先頭8文字だけ取り出します。**例**: `"019ee7dd"`

### todayStr() / yesterdayStr() — 今日・昨日の日付

```typescript
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
```

日記ファイルの名前に使う日付を返します。**例**: `"2026-06-21"` / `"2026-06-20"`

### readFileSafe() — ファイルを安全に読む

```typescript
function readFileSafe(filePath: string): string | null {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}
```

ファイルを読もうと試み、成功したら内容を返し、失敗したら（ファイル不在など）エラーにせず `null` を返します。

### dailyPath() — 日記ファイルのパスを作る

```typescript
function dailyPath(dailyDir: string, date: string): string {
  return path.join(dailyDir, `${date}.md`);
}
```

**例**: `dailyPath(".pi-gl-mem/daily", "2026-06-21")` → `".pi-gl-mem/daily/2026-06-21.md"`

### parseScratchpad() / serializeScratchpad() — チェックリストの読み書き

チェックリスト（`- [ ] やること` / `- [x] やったこと`）をプログラムで扱いやすい形に変換したり、元に戻したりする関数です。

## 4. メイン関数（67行目〜最後）

```typescript
export default function (pi: ExtensionAPI) {
```

`export default function` は**「このファイルは pi の拡張機能ですよ」**という印です。pi が起動時にこの関数を呼び出します。

### 4-1. 上方向探索（68〜76行目）← pi-local-mem からの新機能

```typescript
let currentDir = process.cwd();
while (currentDir !== path.dirname(currentDir)) {
  if (fs.existsSync(path.join(currentDir, '.pi-gl-mem'))) break;
  currentDir = path.dirname(currentDir);
}
const localDir = path.join(currentDir, '.pi-gl-mem');
```

コードの心臓部のひとつです。**カレントディレクトリから親フォルダへ順に `.pi-gl-mem/` を探します**。

例えば `/home/user/project/src/` で pi を起動した場合：
1. `src/` に `.pi-gl-mem/` ある？ → なければ
2. `project/` に `.pi-gl-mem/` ある？ → なければ
3. `user/` に `.pi-gl-mem/` ある？
4. …ルートに達するまで続ける

これにより、プロジェクトルートではなくサブフォルダから起動しても同じ記憶領域を共有できます。

### 4-2. パスの設定（78〜82行目）

```typescript
const dailyDir = path.join(localDir, 'daily');
const notesDir = path.join(localDir, 'notes');
const memoryFile = path.join(localDir, 'MEMORY.md');
const scratchpadFile = path.join(localDir, 'SCRATCHPAD.md');
const configPath = path.join(localDir, 'pi_gl_settings.json');
```

記憶を保存する各ファイルの**住所（パス）**を計算します。

### 4-3. 早期returnガード（84〜88行目）← pi-local-mem からの新機能

```typescript
if (!fs.existsSync(localDir)) {
  console.log('ℹ️ pi-gl-mem: .pi-gl-mem/ が見つかりません。`pi-gl-mem-init` で初期化してください。');
  return;
}
```

**大切な安全機能**: `.pi-gl-mem/` が存在しない場合、ツールも注入も一切登録せずに即座に終了します。これにより、プロジェクトをまだ初期化していなくても pi がエラーで止まることはありません。

### 4-4. 設定ファイルの読み込み（90〜96行目）

```typescript
let config = { injectLocal: true, injectGlobal: true };
if (fs.existsSync(configPath)) {
  try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) {
    console.warn('⚠️ pi-gl-mem: 設定ファイルのパースに失敗...');
  }
}
```

`pi_gl_settings.json` を読み込みます。2つの設定項目があります：

| 設定 | 初期値 | 意味 |
|------|--------|------|
| `injectLocal` | `true` | ローカル記憶をAIに読ませる |
| `injectGlobal` | `true` | グローバル記憶をAIに読ませる |

ファイルがなくてもエラーにならず、デフォルト値（両方 true）で動作します。

### 4-5. Local Log Rule（98〜113行目）

```typescript
const localLogRule = [
  '### Local Log Rule',
  'After meaningful interactions, call write_local_memory(target="daily") with a brief 1-2 sentence summary.',
  '...',
].join('\n');
```

AI に「記憶を書き残す習慣」を教える指示文です：
- 意味のある作業を終えたら **1〜2行の要約** を daily に書きなさい
- 書くタイミング: タスク完了・決定・バグ修正・新情報発見・設定変更
- 書かないタイミング: 挨拶・雑談・簡単な確認

### 4-6. グローバル注入（116〜133行目）← pi-local-mem からの新機能

```typescript
if (config.injectGlobal !== false) {
  pi.on('before_agent_start', async (event, _ctx) => {
    try {
      const globalDir = path.join(os.homedir(), '.pi', 'agent', 'pi-gl-mem');
      const globalMemoryFile = path.join(globalDir, 'MEMORY.md');
      const globalMem = readFileSafe(globalMemoryFile)?.trim();
      // ...global を注入...
    } catch (e) { return {}; }
  });
}
```

`~/.pi/agent/pi-gl-mem/MEMORY.md` が存在すれば、その内容を AI の指示文（systemPrompt）に追加します。これにより、全プロジェクト横断で共有したい知識を AI が常に参照できるようになります。

### 4-7. ローカル注入（135〜156行目）

```typescript
if (config.injectLocal !== false) {
  pi.on('before_agent_start', async (event, _ctx) => {
    try {
      const sections: string[] = [];
      const mem = readFileSafe(memoryFile)?.trim();
      if (mem) sections.push(`## MEMORY.md (long-term)\n\n${mem}`);
      // ...daily 今日・昨日も同様に...
      return { systemPrompt: event.systemPrompt + `\n\n### [PROJECT LOCAL MEMORY - 優先]\n${section}\n` };
    } catch (e) { return {}; }
  });
}
```

ローカル記憶を注入します。注入されるのは：
1. **MEMORY.md**（長期記憶）— プロジェクトの仕様・決定事項
2. **今日の日記**（あれば）
3. **昨日の日記**（あれば）
4. **Local Log Rule**（AIへの指示）

「優先」ラッパで包まれているため、グローバル記憶よりローカル記憶を重視する意図が AI に伝わります。

### 4-8. セッションID取得ヘルパ（158〜161行目）

```typescript
function getSid(ctx: any): string {
  try { return shortSessionId(String(ctx.sessionManager.getSessionId())); }
  catch { return '--------'; }
}
```

会話のセッションIDを安全に取得します。失敗しても `'--------'` を返すのでエラーになりません。

### 4-9. 6つのツール（163行目〜最後）

pi-gl-mem は **6つのツール** を提供します。グローバル用2つ、ローカル用4つです。

#### 🌐 グローバル用ツール

##### ツール①: write_global_memory（新規）

```typescript
pi.registerTool({
  name: 'write_global_memory',
  // ...
});
```

**グローバル MEMORY.md に書き込む**ツールです。`content`（内容）と `mode`（append/overwrite）を受け取り、`~/.pi/agent/pi-gl-mem/MEMORY.md` に保存します。自動的にタイムスタンプとセッションIDが付与されます。

##### ツール②: read_global_memory（新規）

**グローバル MEMORY.md を読む**ツールです。ファイルの内容をそのまま返します。空なら空文字列を返します。

#### 📁 ローカル用ツール

##### ツール③: write_local_memory（継承）

**ローカル記憶に書き込む**ツールです。`target` で保存先を選びます：
- `long_term` → MEMORY.md（長期記憶）
- `daily` → daily/YYYY-MM-DD.md（日次ログ）
- `note` → notes/ファイル名.md（ノート）

##### ツール④: read_local_memory（継承）

**ローカル記憶を読む**ツールです。`target` で読み取り対象を選びます：
- `long_term` / `scratchpad` / `daily` / `note` / `list`（一覧表示）

##### ツール⑤: local_scratchpad（継承）

**チェックリストを管理する**ツールです。操作一覧：

| 操作 | 意味 |
|------|------|
| `add` | 項目を追加 |
| `done` | 完了にチェック |
| `undo` | 未完了に戻す |
| `clear_done` | 完了項目を一掃 |
| `list` | 一覧表示 |

##### ツール⑥: search_local_memory（継承）

**全文検索ツール**です。`query` で検索語を受け取り、`.pi-gl-mem/` 配下の全 `.md` ファイルを大文字小文字区別なく検索します。

## 5. 全体の処理の流れ（まとめ）

```
pi 起動
 ├─ 1. 上方向探索: .pi-gl-mem/ を親方向に探す
 ├─ 2. 見つからなければ → 早期return（何もしない）
 ├─ 3. 設定ファイル pi_gl_settings.json を読む
 ├─ 4. AI起動直前: 記憶を注入
 │    ├─ 🌐 グローバル MEMORY.md（あれば）
 │    └─ 📁 ローカル MEMORY.md＋今日＋昨日＋Local Log Rule
 └─ 5. 6つのツールを提供
      ├─ 🌐 write_global_memory   （グローバルに書く）
      ├─ 🌐 read_global_memory    （グローバルを読む）
      ├─ 📁 write_local_memory    （ローカルに書く）
      ├─ 📁 read_local_memory     （ローカルを読む）
      ├─ 📁 local_scratchpad      （チェックリスト）
      └─ 📁 search_local_memory   （全文検索）
```

## 6. キーワード解説

| 用語 | ざっくり意味 |
|------|-------------|
| **TypeScript** | JavaScript に「型」の概念を追加したプログラミング言語 |
| **拡張機能** | 他のソフトに機能を追加する部品。pi では `.ts` ファイル |
| **関数** | 処理をひとまとめにしたもの。呼び出すと結果を返す |
| **変数** | 値を入れておく箱。`const` は再代入できない変数 |
| **パス** | ファイルやフォルダの住所（例: `/home/project/file.txt`） |
| **JSON** | データを `{ "名前": 値 }` の形で書く形式。設定ファイルに使う |
| **async/await** | 「待ち」が発生する処理を効率よく書く仕組み |
| **イベント** | 「起動するよ」などの出来事 |
| **プロンプト** | AI に与える指示文。systemPrompt は「人格設定」のようなもの |
| **グローバル** | PC全体に共有される領域。どのプロジェクトからも見える |
| **ローカル** | プロジェクト固有の領域。そのプロジェクトの中だけで見える |
| **上方向探索** | 現在のフォルダから親フォルダへ順に目的のフォルダを探すこと |
| **早期return** | 条件を満たさない場合、処理の最初で即座に終了すること |
| **inject** | 注入する。記憶を AI のプロンプトに自動で埋め込むこと |
| **grep** | ファイルの中から特定の文字列を探す操作 |

## 7. なぜ「独立完結版」なのか

この拡張機能は元となった **pi-mem** という別の拡張機能と**互換性がありますが、pi-mem への依存がゼロ**です。pi-mem の関数を一切 import せず、必要なロジックをすべてこのファイル内にコピーしています（「コピー持参」方式）。

**メリット**:
- pi-mem がインストールされていなくても動く
- pi-mem のアップデートで互換性が壊れても影響を受けない
- グローバル記憶もローカル記憶も自己完結で管理できる
- 設定次第で pi-mem との併用も単独運用もできる

---

これで解説は以上です。「この部分をもっと詳しく」や「この用語がわからない」などあれば聞いてください。
