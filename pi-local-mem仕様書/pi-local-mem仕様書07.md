# プロジェクト専用メモリ拡張プラグイン「pi-local-mem」仕様書
## 1. 概要
大元のグローバルプラグイン（`pi-mem`）のソースコードや共通資産（`~/.pi/` 内のファイル）に一切干渉せず、**あらゆるプロジェクトフォルダの直下にのみ、独立した記憶領域を完全自動で展開・管理する**カスタム拡張プラグイン。
### 価値
- **グローバル自動運用**: 一度だけ登録すれば、今後どのプロジェクトフォルダで `pi` を起動しても、自動で足元を検知（`process.cwd()`）して記憶フォルダを展開する。
- **マルチエージェントの脳内分離**: プロジェクトごとに記憶が独立し、エージェント同士によるグローバル記憶の汚染を防ぐ。
- **ON/OFF切替**: 隠しフォルダ内のJSONのフラグ（`injectLocal: false`）を変更するだけでローカル記憶の注入を止められる。
- **グローバルプラグイン（`@haha1903/pi-mem`）との併用**: 大元の共通ルールの下に、本プラグインのローカル仕様がAIの頭脳へ自動マージされる。
- **競合リスクゼロ（非破壊設計）**: 既存のプラグインコードを1文字も書き換えない「完全外付け型」。pi 本体の正規イベント仕様（`on('before_agent_start')`）にのみ準拠。
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
        └── pi_memory.json # ローカル記憶の注入をON/OFFする設定フラグ（デフォルト: true）
```
## 3. ソースコード（Node.js / 約65行）
以下のコードをコピーして、PCの適当な場所に **`pi-local-mem.ts`** という名前で保存してください。
```javascript
/**
 * pi-local-mem.ts (ロバスト・ミニマム決定版)
 * 【概要】
 * プロジェクト（カレントディレクトリ）直下にのみ、独立した記憶領域を展開・管理するプラグイン。
 * PC全体に「一度だけ」インストールすれば、今後の全プロジェクトで完全自動で記憶を分離する。
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
 * 【3. 安全な融合作業（注意・免責事項）】
 * ローカルからグローバルへ知識を昇格・マージさせる作業は、AIの誤作動（ハルシネーション）を防ぐため、以下のステップを推奨：
 *   ① あなたが「プロジェクトの .pi-local-mem/MEMORY.md から、汎用的な知識を抜き出してテキストで整理し提出する」
 *   ② AIが提案した内容を人間が確認し、大元のグローバル記憶にコピペして追加する。
 *   ③ 本機能の起こしうるデータの分離は、あなたの【自己責任】で運用する。
 * 【4. アンインストール（削除）方法】
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
export default function (pi) {
  const currentDir = process.cwd();
  const localDir = path.join(currentDir, '.pi-local-mem');
  const configPath = path.join(localDir, 'pi_memory.json');
  // 1. 起動時にプロジェクト直下に自動的に隠しフォルダと全ファイルを展開（安全対策付き）
  if (!fs.existsSync(localDir)) {
    try {
      fs.mkdirSync(localDir, { recursive: true });
      fs.writeFileSync(path.join(localDir, 'MEMORY.md'), '# プロジェクト個別記憶\n\nここにこのプロジェクト特有の仕様・型定義・TODO・決定事項などを記録してください。\n', 'utf8');
      fs.writeFileSync(configPath, JSON.stringify({ injectLocal: true }, null, 2), 'utf8');
    } catch (err) {
      console.error(`⚠️ pi-local-mem: 初期化に失敗しました: ${err.message}`);
    }
  }
  // 2. 設定ファイルの安全な読み込み
  let config = { injectLocal: true };
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      console.warn('⚠️ pi-local-mem: 設定ファイルのパースに失敗したため、デフォルト(true)で起動します。');
    }
  }
  // 3. コンテキスト注入（ローカル記憶をAIの頭脳へ自動マージ）
  if (config.injectLocal !== false) {
    pi.on('before_agent_start', async (event, _ctx) => {
      const localFile = path.join(localDir, 'MEMORY.md');
      try {
        if (fs.existsSync(localFile)) {
          const content = fs.readFileSync(localFile, 'utf8').trim();
          if (content) {
            return { systemPrompt: event.systemPrompt + `\n\n### [PROJECT LOCAL MEMORY - 優先]\n${content}\n` };
          }
        }
      } catch (e) {
        // 読み込み失み込み失敗時は黙って何も注入しない（安全策）
      }
      return {};
    });
  }
  // 4. プロジェクト専用の書き込みツール
  pi.registerTool({
    name: 'write_local_memory',
    label: 'Write Local Memory',
    description: '現在のプロジェクト直下の .pi-local-mem/MEMORY.md に記憶を上書き保存するツール',
    parameters: Type.Object({
      content: Type.String(),
    }),
    async execute(_toolCallId, { content }) {
      try {
        if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
        fs.writeFileSync(path.join(localDir, 'MEMORY.md'), content, 'utf8');
        return { content: [{ type: 'text', text: '✅ プロジェクトローカル記憶に保存しました（.pi-local-mem/MEMORY.md）' }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `❌ 保存失敗: ${err.message}` }], isError: true };
      }
    }
  });
}
```
## 4. 運用ガイドライン
- **日常の開発**: プロジェクトごとに `pi` を起動して開発するだけ。プロジェクト固有の知識を `write_local_memory` ツールでその都度足元に蓄積し、グローバル記憶を汚すリスクをほぼゼロにできる。
- **安全な融合作業の第一人者としてのプロセス**: AIに丸取りさせるのではなく、「AIに書き出させる → 人間が取捨選択する → マージする」という手間を噛ませることで、大切なグローバル記憶を没収されることは100%防げる。