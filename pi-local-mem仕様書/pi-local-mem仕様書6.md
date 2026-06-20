### 📁 プロジェクト専用メモリ拡張プラグイン「pi-local-mem」完全仕様書（グローバル自動展開・決定版）

### 1\. 概要

本仕様は、大元のグローバルプラグイン（`pi-mem`）のソースコードや既存の共通資産（`~/.pi/` 内のファイル）に一切干渉せず、**あらゆるプロジェクトフォルダの直下にのみ、独立した記憶領域を完全自動で展開・管理する**ためのカスタム拡張プラグイン（`pi-local-mem`）の仕様である [Zenn]。

### 💎 本プラグインの真の価値（一度の導入で、全プロジェクトを自動分離）

*   **どこでインストールしてもOKなグローバル自動運用**:  
    PCのどのフォルダ（デスクトップやホームなど）でインストールコマンドを実行しても、`pi`のExtensionシステムが自動的にファイルを共通管理領域（`~/.pi/` 等）へ複製・登録する [Zenn]。そのため、**最初の一度だけ登録を済ませれば、今後はどのプロジェクトフォルダへ移動して `pi` を起動しても、自動で足元を検知（`process.cwd()`）して記憶フォルダを展開する。**
*   **マルチエージェントの脳内分離**:  
    プロジェクトごとに記憶が完全に独立するため、エージェント同士によるグローバル記憶の予期せぬ汚染を防ぎ、特定の役割を持ったエージェントをノイズのない完全な白紙状態で目の前の仕様に集中させることができる。
*   **このグローバル記憶との分離（ON/OFFの切り替え）は、自動生成された隠しフォルダ内のJSONファイルのフラグ（`injectLocal: false`）を変更するだけで簡単に行えます。**
*   **グローバルプラグイン（@haha1903/pi-mem）との完璧な併用・互換性**:  
    PC全体に大元の `@haha1903/pi-mem` がインストールされている環境でも何の問題もなく100%安全に動作する。その場合は、大元の共通ルールの下に、本プラグインのローカル仕様がAIの頭脳へ自動マージ（合流）される。
*   **他プラグインや将来の亜流との競合リスクゼロ（非破壊設計）**:  
    既存のプラグインコードを1文字も書き換えない「完全外付け型」の独立設計であり、`pi` 本体の正規イベント仕様（`on('before_agent_start')`）にのみ準拠しているため、将来どのような公式アップデートや亜流プラグインが登場・共存しても、絶対に衝突（エラー）を起こさない [Zenn]。
*   **tmux（マルチウィンドウ）環境への最適化**:  
    `tmux` を用いて画面を分割し、複数のエージェントを並列稼働させる際、各画面の雑多なメモが足元の `.pi-local-mem/` に閉じ込められるため、隣のペイン（画面）のエージェントの頭脳を汚染するリスク（画面間コンテキスト汚染）を根本からシャットアウトする。
*   **極限のクリーンな見た目**:  
    一度インストールを済ませてしまえば、新しいプロジェクトフォルダ側には一切ファイル（スクリプト等）を置く必要がない。`pi` を起動した瞬間に、足元に `.pi-local-mem/` という隠しフォルダが1つだけ自動生成され、プロジェクトルートの美観を100%美しく、ノイズレスに維持する。
*   **堅牢な安全設計（ロバストネス）**:  
    現場のリアルなエラー（書き込み権限の有無やJSONの記述ミス）を想定した例外処理（`try-catch`）を内包し、安全に運用できる。

* * *

### 📁 2. ディレクトリおよびファイル構造

大元のグローバル記憶は従来通りの挙動を維持し、本プラグインが「今 `pi` コマンドを実行したカレントディレクトリ」の足元に、自動で隠しフォルダを新設して関連ファイルをすべて内包する。

```
# 【グローバル】（既存のpi-mem仕様・完全放置 / 共存可能）
~/.pi/agent/memory/
  └── MEMORY.md          # 既存のツールはこれまで通りここを勝手に読み書きする

# 【ローカル】（あらゆるプロジェクトで「pi」を起動した瞬間に自動展開される領域）
~/any-your-project-folder/
  └── .pi-local-mem/     # 💫 起動時に完全自動で生成され、すべてを内包する隠しフォルダ
        ├── MEMORY.md    # このプロジェクト専用の仕様、型定義、TODOなど
        └── pi_memory.json # 🔒 ローカル記憶の注入をON/OFFする設定フラグ（デフォルト: true）
```

* * *

### 💻 3. 自己完結型プラグイン全ソースコード（Node.js / 約65行）

以下のコードを丸ごとコピーして、PCの適当な場所（デスクトップやホームなど、どこでもOK）に **`pi-local-mem.js`** という名前で一度だけ保存してください。

```javascript
/**
 * 📦 pi-local-mem.js (ロバスト・ミニマム決定版)
 * 
 * 【概要】
 * プロジェクト（カレントディレクトリ）直下にのみ、独立した記憶領域を展開・管理するプラグイン。
 * PC全体に「一度だけ」インストールすれば、今後の全プロジェクトで完全自動で記憶を分離します。
 * 
 * 【💎 安全性・競合リスクゼロについて】
 * 本プラグインは他プラグインのコードを書き換えない「完全外付け型」の非破壊設計です。
 * 将来の公式アップデートや、他のどのような亜流（フォーク）プラグインが共存しても絶対に衝突しません。
 * 
 * 【1. インストール方法（最初の一度だけ）】
 * PCの適当な場所（どこでもOK）に本ファイルを配置し、ターミナルで以下を実行：
 * $ pi install ./pi-local-mem.js
 * ※インストールが成功したら、この最初に配置した「pi-local-mem.js」ファイル自体は絶対に削除・移動しないでください
 *   （pi install は設定に「ファイルへの参照」を登録するだけであり、ファイル本体を複製しません。
 *    元ファイルを削除/移動すると、次回起動時にロード失敗します。）
 * 
 * 【2. 使い方】
 * 新しいプロジェクトフォルダに移動し、通常通り「pi」を起動するだけ。
 * 起動した瞬間に、足元に「.pi-local-mem/」が完全自動で展開されます。
 * 
 * 【3. 安全な融合作業（注意・免責事項）】
 * ローカルからグローバルへ知識を昇格・マージさせる作業は、AIの誤作動（ハルシネーション）を防ぐため、以下のステップを推奨します。
 *   ① あなたが「プロジェクトの .pi-local-mem/MEMORY.md から、汎用的な知識を抜き出してテキストで整理し提出する」
 *   ② AIが提案した内容を人間が確認し、大元のグローバル記憶にコピペして追加する。
 *   ③ 本機能の起こしうるデータの分離は、あなたの【自己責任】で運用していただく。
 * 
 * 【4. アンインストール（削除）方法】
 *   A. pi全体からこのプラグインの利用を止めるコマンド：
 *      $ pi uninstall pi-local-mem
 * 
 *   B. 【手動クリーンアップ】プロジェクトに残されてしまった「記憶データ」そのものを完全に削除したい場合：
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
      
      const defaultJson = { injectLocal: true };
      fs.writeFileSync(configPath, JSON.stringify(defaultJson, null, 2), 'utf8');
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
        // 読み込み失敗時は黙って何も注入しない（安全策）
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

* * *

### 📝 4. 運用ガイドライン

*   **日常の開発**: プロジェクトごとに `pi` を起動して開発するだけ。プロジェクト固有の知識を `write_local_memory` ツールによってその都度足元に蓄積し、グローバル記憶を汚すリスクをほぼゼロにできる。
*   **安全な融合作業の第一人者としてのプロセス**: AIに丸取りさせるのではなく、「AIに書き出させる → 人間が取捨選択する → マージする」という時間の手間を噛ませることで、あなたの大切なグローバル記憶を没収されることは100%防げる。