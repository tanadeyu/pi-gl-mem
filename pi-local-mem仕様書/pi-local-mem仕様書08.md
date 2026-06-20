# プロジェクト専用メモリ拡張プラグイン「pi-local-mem」仕様書8
## 0. 経緯（7→8 の変更点だけ）
仕様書1・3には「グローバル記憶との分離（`global:false`）」が文言・JSON雛形だけ存在したが、**コード実装は一度もなく構想のみ**だった（仕様書1の context ハンドラは `global` フラグを一切参照しない）。5以降で文言ごと消滅し、6/7では「グローバルは pi-mem 任せ（非破壊）」に方針確定していた。
今回 pi-mem のソースを直接確認し、注入が `context` イベントで `<pi-mem-injected>` を含む **user メッセージ追加** であることを突き止めた。pi 本体の `emitContext` は拡張ハンドラを **登録順にバケツリレー** で走らせ、前段の戻り値を後段へ引き継ぐため、後段の pi-local-mem が当該メッセージを **フィルタ除去** できる。`pi -p` で実証済み（`messages count=2 → after filter: 2 -> 1 (removed 1)`）。
「最初からスキップ」は不可（pi に他拡張のハンドラを止める口がなく、pi-mem にも注入OFF設定がないため）。本書は「後段フィルタで後から除去」方式を採用し、仕様書1の構想を初めて本当に実装した版である。
## 1. 概要
大元のグローバルプラグイン（`pi-mem`）のソースコードや共通資産（`~/.pi/` 内のファイル）に一切干渉せず、**あらゆるプロジェクトフォルダの直下にのみ、独立した記憶領域を完全自動で展開・管理する**カスタム拡張プラグイン。加えて **プロジェクト単位で pi-mem のグローバル注入を遮断** できる。
### 価値
- **グローバル自動運用**: 一度だけ登録すれば、今後どのプロジェクトフォルダで `pi` を起動しても、自動で足元を検知（`process.cwd()`）して記憶フォルダを展開する。
- **マルチエージェントの脳内分離**: プロジェクトごとに記憶が独立し、エージェント同士によるグローバル記憶の汚染を防ぐ。
- **ローカル注入のON/OFF**: `.pi-local-mem/pi_memory.json` の `injectLocal: false` でローカル記憶の注入を止められる。
- **ローカルログの自動蓄積（pi-mem と同方式）**: `write_local_memory` はタイムスタンプ＋セッションIDを自動付与し、追記(`append`)/上書き(`overwrite`)を選択可能。ローカル注入には pi-mem と同じ「Local Log Rule」指示を仕込み、**グローバルと同程度の書き込み頻度** で「なんでもかんでも増やしすぎない」基準で AI が自律追記する。
- **グローバル注入のON/OFF（本書で新規実装）**: 同JSONの `injectGlobal: false` で、pi-mem がAI頭脳へ注入する `<pi-mem-injected>` を送信前に除去できる。**表示だけ消す後段フィルタ方式**。
- **グローバルプラグイン（`@haha1903/pi-mem`）との併用**: pi-mem のツール（`memory_write`/`memory_read` 等）や dashboard は停止せず残る。注入「表示」のみを消す。
- **競合リスクゼロ（非破壊設計）**: 既存のプラグインコードを1文字も書き換えない「完全外付け型」。pi 本体の正規イベント仕様（`on('before_agent_start')` / `on('context')`）にのみ準拠。
- **tmux環境への最適化**: 各画面のメモが足元の `.pi-local-mem/` に閉じ込められ、画面間コンテキスト汚染を防ぐ。
- **極限のクリーンな見た目**: プロジェクト側には一切スクリプトを置かず、`.pi-local-mem/` という隠しフォルダ1つだけ自動生成される。
- **堅牢な安全設計**: 権限の有無やJSONの記述ミスを想定した例外処理（`try-catch`）を内包。
## 2. ディレクトリおよびファイル構造
```
# 【グローバル】（既存のpi-mem仕様・完全放置 / 共存可能）
~/.pi/agent/memory/
  └── MEMORY.md          # 既存のツールはこれまで通りここを勝手に読み書きする
# 【ローカル】（あらゆるプロジェクトで「pi」を起動した瞬間に自動展開される領域）
~/any-your-project-folder/
  └── .pi-local-mem/     # 起動時に完全自動で生成される隠しフォルダ
        ├── MEMORY.md    # このプロジェクト専用の仕様、型定義、TODOなど
        └── pi_memory.json # ローカル/グローバル注入をON/OFFする設定フラグ（デフォルト: 両方true）
```
`pi_memory.json` の中身:
```json
{
  "injectLocal": true,
  "injectGlobal": true
}
```
## 3. グローバル遮断の仕組み（injectGlobal）
- pi-mem は `on('context')` で user メッセージとして `<pi-mem-injected>...</pi-mem-injected>` を **追加** する。
- pi 本体の `emitContext` は拡張ハンドラを **packages の登録順** に走らせ、前段の戻り値（messages）を後段の `event.messages` へ引き継ぐ。
- `settings.json` の `packages` で `pi-mem` が `pi-local-mem` より **前** であれば、後段の pi-local-mem が `<pi-mem-injected>` を含むメッセージを filter 除去し `{ messages }` を返すことで **AIへの送信前に消える**。
- 「最初からスキップ」は不可（pi に他拡張ハンドラを止める口がなく、pi-mem にも注入OFF設定がない）。本方式は「走らせた上で結果を捨てる」後段フィルタ。
- 実証ログ（`pi -p`）: `messages count=2 → after filter: 2 -> 1 (removed 1)`。
### 1つのチェックで「参照」も「ファイル記憶」も同時に消える
pi-mem の `buildMemoryContext` は以下を **1つの文字列に結合** して単一の `<pi-mem-injected>` メッセージに詰め込む:
- 参照ファイル（`contextFiles`: AGENTS.md / SOUL.md 等）
- 長期記憶（`MEMORY.md`）
- デイリーログ（今日・昨日）
- キャッチアップ（catchup/INDEX.md）
この1メッセージを丸ごと除去するため、**`injectGlobal: false` の1フラグで「参照」と「ファイル記憶」が同時に消える**。個別には切れないが、個別制御の必要はない（マルチエージェントで「グローバルを見せない」運用では両方まとめて消すのが目的のため）。
### 前提条件
- `settings.json` の `packages` 順序が `pi-mem` → `pi-local-mem` であること。逆順だと除去できない。
- pi-mem が `<pi-mem-injected>` を **独立した単独メッセージ** として追加することを確認済み（ユーザー入力と混ざらないため丸ごと消去で安全）。
- 除去されるのは **AI頭脳への表示のみ**。`memory_write`/`memory_read`/dashboard は pi-mem が登録するので動き続ける。
### デフォルト運用（推奨）
- デフォルトは **両方 `true`**（何も消さない）。勝手に消されることはない。
- マルチエージェント運用などで「このプロジェクトはグローバルに繋ぎたくない」時だけ、`pi_memory.json` の `injectGlobal` を `false` に書き換えて `pi` を再起動する。
- ローカル記憶（`injectLocal`）も同じJSONで個別にON/OFFできるが、通常は `true` のまま運用する。
## 4. ローカルログの仕組み（タイムスタンプ＋追記＋Local Log Rule）
- **タイムスタンプ＋セッションID**: `write_local_memory` は書き込み毎に `<!-- 2026-06-20 12:30:00 [019ee2e8] -->` 形式のヘッダを自動付与（pi-mem の `nowTimestamp`/`shortSessionId` と同方式）。「いつ・どのセッションで書いたか」が追跡できる。
- **追記モード**: `mode: "append"`（デフォルト）で時系列ログとして蓄積、`mode: "overwrite"` で全面上書き。上書きで過去ログを消さない運用を推奨。
- **Local Log Rule**: ローカル注入の末尾に pi-mem の Daily Log Rule と同じ基準の指示を仕込む:
  - **Log when:** task completed, decision made, bug fixed, new info discovered, config changed.
  - **Skip when:** greetings, goodbyes, chitchat, simple acks, trivial factual questions.
  - Log the outcome, not the question.
- これにより **「難しいアルゴリズムは使わず、自然言語指示で AI 任せ」** という pi-mem と同じ設計で、グローバルと同程度の書き込みボリュームに揃う（件数を完全一致させる保証はないが、頻度のオーダーは同じになる）。
- **グローバルを切った時の相乗効果**: `injectGlobal: false` で pi-mem の表示が消えると AI は Daily Log Rule を見なくなる → グローバルへの自動書き込みが実質止まり、代わりにローカルの Local Log Rule だけが見える → ローカルだけに同量蓄積される。
## 5. ソースコード（TypeScript / 約90行）
以下のコードをコピーして、PCの適当な場所に **`pi-local-mem.ts`** という名前で保存してください。
```typescript
/**
 * pi-local-mem.ts (ロバスト・ミニマム決定版 + グローバルスキップ実装版)
 * 【概要】
 * プロジェクト（カレントディレクトリ）直下にのみ、独立した記憶領域を展開・管理するプラグイン。
 * PC全体に「一度だけ」インストールすれば、今後の全プロジェクトで完全自動で記憶を分離する。
 * さらに大元のグローバルプラグイン（pi-mem）の注入をプロジェクト単位で遮断できる。
 * 【安全性・競合リスクゼロについて】
 * 他プラグインのコードを書き換えない「完全外付け型」の非破壊設計。
 * 将来の公式アップデートや他の亜流プラグインが共存しても絶対に衝突しない。
 * 【1. インストール方法（最初の一度だけ）】
 * PCの適当な場所に本ファイルを配置し、ターミナルで以下を実行：
 *   $ pi install ./pi-local-mem.ts
 * ※pi install はファイルをコピーせずパスを参照登録するだけなので、インストール後もこの「pi-local-mem.ts」は削除・移動してはいけません。削除・移動するとプラグインがロードできなくなります。位置を変える場合は pi remove → pi install で再登録してください。
 * 【2. 使い方】
 * 新しいプロジェクトフォルダに移動し、通常通り「pi」を起動するだけ。
 * 起動した瞬間に、足元に「.pi-local-mem/」が完全自動で展開される。
 * 【3. グローバル記憶の遮断（injectGlobal）について】
 * .pi-local-mem/pi_memory.json の "injectGlobal": false で、pi-mem がAI頭脳へ注入する
 * <pi-mem-injected> ブロックを送信前に除去できる（表示だけ消す・後段フィルタ方式）。
 * ※本機能が効くには settings.json の packages で pi-mem が pi-local-mem より「前」に登録されている必要がある。
 * ※pi-mem のツール（memory_write 等）や dashboard は停止せず残る。注入「表示」のみを消す仕組み。
 * 【4. 安全な融合作業（注意・免責事項）】
 * ローカルからグローバルへ知識を昇格・マージさせる作業は、AIの誤作動（ハルシネーション）を防ぐため、以下のステップを推奨：
 *   ① あなたが「プロジェクトの .pi-local-mem/MEMORY.md から、汎用的な知識を抜き出してテキストで整理し提出する」
 *   ② AIが提案した内容を人間が確認し、大元のグローバル記憶にコピペして追加する。
 *   ③ 本機能の起こしうるデータの分離は、あなたの【自己責任】で運用する。
 * 【5. アンインストール（削除）方法】
 *   A. pi全体からこのプラグインの利用を止めるコマンド：
 *      $ pi uninstall pi-local-mem
 *   B. 【手動クリーンアップ】プロジェクトに残された「記憶データ」を完全に削除したい場合：
 *      Mac/Linux/WSL環境： $ rm -rf ./.pi-local-mem
 *      Windows環境（PowerShell）： $ Remove-Item -Recurse -Force .\.pi-local-mem
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import * as fs from 'fs';
import * as path from 'path';
export default function (pi: ExtensionAPI) {
  const currentDir = process.cwd();
  const localDir = path.join(currentDir, '.pi-local-mem');
  const configPath = path.join(localDir, 'pi_memory.json');
  // 1. 起動時にプロジェクト直下に自動的に隠しフォルダと全ファイルを展開（安全対策付き）
  if (!fs.existsSync(localDir)) {
    try {
      fs.mkdirSync(localDir, { recursive: true });
      fs.writeFileSync(path.join(localDir, 'MEMORY.md'), '# プロジェクト個別記憶\n\nここにこのプロジェクト特有の仕様・型定義・TODO・決定事項などを記録してください。\n', 'utf8');
      fs.writeFileSync(configPath, JSON.stringify({ injectLocal: true, injectGlobal: true }, null, 2), 'utf8');
    } catch (err) {
      console.error(`⚠️ pi-local-mem: 初期化に失敗しました: ${err.message}`);
    }
  }
  // 2. 設定ファイルの安全な読み込み
  let config: { injectLocal?: boolean; injectGlobal?: boolean } = { injectLocal: true, injectGlobal: true };
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      console.warn('⚠️ pi-local-mem: 設定ファイルのパースに失敗したため、デフォルト(true)で起動します。');
    }
  }
  // 3. コンテキスト注入（ローカル記憶をAIの頭脳へ自動マージ + ローカルログ指示）
  //    pi-mem と同じ「いつ書くか」の自然言語指示をローカルにも仕込み、同程度の書き込み頻度に揃える。
  const localLogRule = [
    '### Local Log Rule',
    'After meaningful interactions, call write_local_memory(mode:"append") with a brief 1-2 sentence summary.',
    '**Log when:** task completed, decision made, bug fixed, new info discovered, config changed.',
    '**Skip when:** greetings, goodbyes, chitchat, simple acks, trivial factual questions.',
    'Log the outcome, not the question (e.g. "Debugged import error — missing __init__.py" not "User asked about imports").',
  ].join('\n');
  if (config.injectLocal !== false) {
    pi.on('before_agent_start', async (event, _ctx) => {
      const localFile = path.join(localDir, 'MEMORY.md');
      let body = '';
      try {
        if (fs.existsSync(localFile)) {
          body = fs.readFileSync(localFile, 'utf8').trim();
        }
      } catch (e) {
        // 読み込み失敗時は黙って空扱い（安全策）
      }
      const section = body ? `${body}\n\n${localLogRule}` : localLogRule;
      return { systemPrompt: event.systemPrompt + `\n\n### [PROJECT LOCAL MEMORY - 優先]\n${section}\n` };
    });
  }
  // 4. グローバル記憶（pi-mem）の注入遮断 —— context イベント後段フィルタ方式
  //    pi-mem が user メッセージとして追加する <pi-mem-injected> を除去して返す。
  //    ※packages 順序で pi-mem が pi-local-mem より前であることが前提。
  if (config.injectGlobal === false) {
    pi.on('context', async (event) => {
      try {
        const messages = (event.messages as any[]).filter(m => {
          if (m.role === 'user' && typeof m.content === 'string') {
            return !m.content.includes('<pi-mem-injected>');
          }
          return true;
        });
        return { messages };
      } catch (e) {
        // 失敗時は何もせず素通し（安全策）
        return {};
      }
    });
  }
  // 5. プロジェクト専用の書き込みツール（タイムスタンプ＋セッションID付与・追記/上書き選択可）
  pi.registerTool({
    name: 'write_local_memory',
    label: 'Write Local Memory',
    description: [
      '現在のプロジェクト直下の .pi-local-mem/MEMORY.md に記憶を書き込むツール。',
      'mode: "append" で追記（推奨・時系列ログ）、"overwrite" で全面上書き。',
      'いずれも自動でタイムスタンプ + セッションID（先頭8桁）が付与される（pi-mem と同形式）。',
    ].join('\n'),
    parameters: Type.Object({
      content: Type.String({ description: '書き込む内容（Markdown）' }),
      mode: Type.Optional(Type.String({ description: '"append" or "overwrite". default: append' })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      try {
        if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
        const file = path.join(localDir, 'MEMORY.md');
        const mode = params.mode === 'overwrite' ? 'overwrite' : 'append';
        const ts = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
        let sid = '--------';
        try { sid = String(ctx.sessionManager.getSessionId()).slice(0, 8); } catch (e) {}
        const stamped = `<!-- ${ts} [${sid}] -->\n${params.content}`;
        if (mode === 'overwrite') {
          fs.writeFileSync(file, stamped, 'utf8');
          return { content: [{ type: 'text', text: '✅ ローカル記憶を上書き保存しました（.pi-local-mem/MEMORY.md）' }] };
        }
        const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
        const sep = existing.trim() ? '\n\n' : '';
        fs.writeFileSync(file, existing + sep + stamped, 'utf8');
        return { content: [{ type: 'text', text: '✅ ローカル記憶に追記しました（.pi-local-mem/MEMORY.md）' }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `❌ 保存失敗: ${err.message}` }], isError: true };
      }
    }
  });
}
```
## 6. 運用ガイドライン
- **日常の開発（デフォルト両方ON）**: プロジェクトごとに `pi` を起動して開発するだけ。グローバル記憶（参照＋ファイル記憶）もローカル記憶も両方見えた状態で運用。プロジェクト固有の知識は `write_local_memory` ツールで足元に蓄積し、グローバルを汚すリスクをほぼゼロにできる。
- **マルチエージェント時だけグローバルを切る**: 並列稼働でグローバル記憶を汚したくない/見せたくないプロジェクトでは、`pi_memory.json` の `injectGlobal` を `false` に書き換えて `pi` を再起動するだけ。参照（AGENTS.md等）もファイル記憶（MEMORY.md等）も1フラグで同時に消え、AI にはローカル記憶のみが見える白紙状態になる（pi-mem のツール類は使えるまま）。
- **安全な融合作業の第一人者としてのプロセス**: AIに丸取りさせるのではなく、「AIに書き出させる → 人間が取捨選択する → マージする」という手間を噛ませることで、大切なグローバル記憶を没収されることは100%防げる。
