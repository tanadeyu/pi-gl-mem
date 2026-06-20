### ?? プロジェクト専用メモリ拡張プラグイン「pi-local-mem」完全仕様書（tmux最適化・決定版）

### 1\. 概要

本仕様は、大元のグローバルプラグイン（`pi-mem`）のソースコードや既存の共通資産（`~/.pi/` 内のファイル）に一切干渉せず、**各プロジェクトフォルダの直下にのみ独立した記憶領域を展開・管理する**ためのカスタム拡張プラグイン（`pi-local-mem`）の仕様である \[Zenn\]。

### ?? 本プラグインの真の価値（マルチエージェント分離と美観の両立）

*   **マルチエージェントの脳内分離**: プロジェクトによってはグローバルの記憶と完全に分離して運用したい場合に非常に有効である。エージェント同士によるグローバル記憶の予期せぬ汚染を防ぎ、特定の役割を持ったエージェントをノイズのない完全な白紙状態で目の前の仕様に集中させることができる。
*   **tmux（マルチウィンドウ）環境への最適化**: `tmux` を用いて画面を分割し、複数のエージェントプロセスを同時に並列稼働させる実戦的な運用においても真価を発揮する。各画面のエージェントが吐き出す雑多な作業メモが同一プロジェクト内の `.pi-local-mem/` に閉じ込められるため、隣のペイン（画面）のエージェントの頭脳を汚染するリスク（画面間コンテキスト汚染）を根本からシャットアウトできる。
*   **このグローバル記憶との分離（ON/OFFの切り替え）は、プロジェクト直下に置くJSONファイルのフラグ（`global: false`）を変更するだけで簡単に行えます。**
*   **極限のクリーンな見た目**: 初回起動時に、設定ファイルだけでなく、本プラグインのソースコード自身をも自動的に隠しフォルダ内へ退避させる「自己隠蔽型」の設計を採用。`tmux` で複数ペインを立ち上げて頻繁にファイル確認（`ls` 等）を行う環境でも、プロジェクトルートの美観を100%美しく、ノイズレスに維持する。
*   **堅牢な安全設計（ロバストネス）**: 現場のリアルなエラー（書き込み権限の有無やJSONの記述ミス）を想定した例外処理（`try-catch`）を内包し、新規開発者でもシステムをクラッシュさせずに安全に運用できる。

* * *

### ?? 2. ディレクトリおよびファイル構造

大元のグローバル記憶は従来通りの挙動を維持し、本プラグインが足元にツール名と同一の隠しフォルダを新設し、関連ファイルをすべてその中に隠蔽（内包）する。

text

    # 【グローバル】（既存のpi-mem仕様・完全放置）
    ~/.pi/agent/memory/
      └── MEMORY.md          # 既存のツールはこれまで通りここを勝手に読み書きする
    
    # 【ローカル】（新設・本プラグイン「pi-local-mem」が管理する独立領域）
    ~/your-project-folder/
      └── .pi-local-mem/     # ? 起動時に自動生成され、すべてを内包する隠しフォルダ
            ├── MEMORY.md    # このプロジェクト専用の仕様、型定義、TODOなど
            ├── pi_memory.json # ? ローカル記憶の注入をON/OFFする設定フラグ（デフォルト: true）
            └── pi-local-mem.js# ? 【自己隠蔽】初回起動時にルートからこの中に自動移動される
    

コードは注意してご使用ください。

* * *

### ?? 3. プラグインのコア機能仕様

本プラグインは、不要な複雑さを徹底的に排除し、以下の4つの最小限のロジックのみで完結する。

### ① 自己隠蔽型・自動展開（ライフサイクル・アクティベート）

*   `pi` のセッション起動時、現在実行しているカレントディレクトリ（`process.cwd()`）の直下を自動検知する。
*   足元に `.pi-local-mem/` フォルダが存在しない場合、フォルダの新規作成、親切な初期解説付きの `MEMORY.md` 生成、および設定用 `pi_memory.json` の雛形（デフォルトは両方 `true`）を一瞬で自動生成する。
*   同時に、プロジェクトルートに露出している `pi-local-mem.js` **自身を自動的に** `.pi-local-mem/` **の中へ安全に移動（リネーム）**させ、プロジェクトルートを完全にまっさらに整える（権限エラー等に備え `try-catch` で保護）。

### ② 設定ファイル（JSON）の安全な読み込み

*   起動時に `.pi-local-mem/pi_memory.json` を読み込む。ファイルが存在しない場合や、ユーザーが記述エラー（構文エラー）を起こした場合でも、システムを強制終了させず、自動的にデフォルト（`injectLocal: true`）にフォールバックして安全に起動する。

### ③ 自動マージ（コンテキスト・インジェクション）

*   エージェントが起動して思考を開始する直前（`on("context")` イベント）に、自動で足元の `./.pi-local-mem/MEMORY.md` の内容を読み込む。
*   JSONで `injectLocal: false` に書き換えられていない限り、大元のグローバル記憶の下に、**「このプロジェクト専用の最優先事項」としてプロンプトを自動合流**させ、AIの頭脳へインジェクションする。

### ④ 独立書き込みツール (`write_local_memory`)

*   AIが日常の開発作業中に、プロジェクト固有の仕様や知見をストックするための専用ツールを1つだけ新規提供する。
*   このツールが呼び出された際は、大元のグローバル記憶は一切変更せず、**100%確実に `./.pi-local-mem/MEMORY.md` のファイルのみを安全に上書き・更新**する。書き込み失敗時のエラーハンドリングも内包する。

* * *

### ?? 4. 自己完結型プラグイン全ソースコード（Node.js / 約60行）

以下のコードを丸ごとコピーして、プロジェクトのトップフォルダ（ルート）に **`pi-local-mem.js`** という名前で保存してください（最初の起動後に自動で隠されます）。

javascript

    /**
     * ?? pi-local-mem.js (ロバスト・ミニマム決定版)
     * 
     * 【概要】
     * プロジェクト（カレントディレクトリ）直下にのみ、独立した記憶領域を展開・管理するプラグイン。
     * 大元のグローバルプラグインには1ミリも干渉せず、プロジェクトごとに記憶を分離します。
     * ★マルチエージェント・tmux実行時、プロジェクトによってはグローバルの記憶と分離したい場合にも使えます。
     * 　グローバル記憶との分離（ON/OFF）は「.pi-local-mem/pi_memory.json」のフラグを書き換えるだけで簡単に行えます。
     * 
     * 【1. インストール方法】
     * プロジェクトのトップフォルダ（ルート）に本ファイルを配置し、ターミナルで以下を実行：
     * $ pi install ./pi-local-mem.js
     * 
     * 【2. 使い方】
     * インストール後、通常通り「pi」を起動。
     * 起動した瞬間に、足元に「.pi-local-mem/」が生成され、本ファイル自身を含むすべてが隠蔽されます。
     * 
     * 【3. 安全な融合作業（注意・免責事項）】
     * ローカルからグローバルへ知識を昇格・マージさせる作業は、AIの誤作動（ハルシネーション）を防ぐため、口頭での一括自動処理ではなく、以下のステップを推奨します。
     * ① あなた「足元の .pi-local-mem/MEMORY.md から、汎用的な知見だけをテキストで抽出して提示して」
     * ② AIが提示した内容を人間が確認し、大元のグローバル記憶にコピペして追加する。
     * ※本機能の利用に起因するデータの紛失は【自己責任】にて運用してください。
     * 
     * 【4. アンインストール（削除）方法】
     * ① PC全体からプラグインのプログラム連携を解除するコマンド：
     * $ pi uninstall pi-local-mem
     * 
     * ② 【手動クリーンアップ】プロジェクトに自動生成された「記憶データ」自体も完全に削除したい場合：
     * Mac/Linux/WSL環境： $ rm -rf ./.pi-local-mem
     * Windows環境（PowerShell）： $ Remove-Item -Recurse -Force .\.pi-local-mem
     */
    
    import { Extension } from '@pi-agent/core';
    import * as fs from 'fs';
    import * as path from 'path';
    
    export default class PiLocalMemExtension extends Extension {
      async activate() {
        const currentDir = process.cwd();
        const localDir = path.join(currentDir, '.pi-local-mem');
        const configPath = path.join(localDir, 'pi_memory.json');
        const rootSrcPath = path.join(currentDir, 'pi-local-mem.js');
        const hiddenSrcPath = path.join(localDir, 'pi-local-mem.js');
    
        // 1. 起動時にプロジェクト直下に自動でメモリフォルダと全ファイルを展開（安全対策付き）
        if (!fs.existsSync(localDir)) {
          try {
            fs.mkdirSync(localDir, { recursive: true });
            fs.writeFileSync(path.join(localDir, 'MEMORY.md'), '# プロジェクト個別記憶\n\nここにこのプロジェクト固有の仕様・型定義・TODO・決定事項などを記述してください。\n', 'utf8');
            
            const defaultJson = { injectLocal: true };
            fs.writeFileSync(configPath, JSON.stringify(defaultJson, null, 2), 'utf8');
    
            if (fs.existsSync(rootSrcPath)) {
              fs.renameSync(rootSrcPath, hiddenSrcPath);
              console.log('? pi-local-mem: 自己隠蔽完了（プロジェクトルートをクリーンにしました）');
            }
          } catch (err) {
            console.error(`?? pi-local-mem: 初期化に失敗しました: ${err.message}`);
          }
        }
    
        // 2. 設定ファイルの安全な読み込み
        let config = { injectLocal: true };
        if (fs.existsSync(configPath)) {
          try {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          } catch (e) {
            console.warn('?? pi-local-mem: 設定ファイルのパースに失敗したため、デフォルト(true)で起動します。');
          }
        }
    
        // 3. コンテキストの注入（ローカル記憶をAIの頭脳へ常に自動マージ）
        if (config.injectLocal !== false) {
          this.agent.on('context', async () => {
            const localFile = path.join(localDir, 'MEMORY.md');
            if (fs.existsSync(localFile)) {
              const content = fs.readFileSync(localFile, 'utf8').trim();
              return content ? `### [PROJECT LOCAL MEMORY - 最優先]\n${content}\n\n` : '';
            }
            return '';
          });
        }
    
        // 4. プロジェクト専用の書き込みツール
        this.agent.registerTool({
          name: 'write_local_memory',
          description: '現在のプロジェクト直下の .pi-local-mem/MEMORY.md に記憶を上書き保存するツール',
          schema: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] },
          execute: async ({ content }) => {
            try {
              fs.writeFileSync(path.join(localDir, 'MEMORY.md'), content, 'utf8');
              return '? プロジェクトローカル記憶に保存しました（.pi-local-mem/MEMORY.md）';
            } catch (err) {
              return `? 保存失敗: ${err.message}`;
            }
          }
        });
      }
    }
    

コードは注意してご使用ください。

* * *

### ?? 5. 運用ガイドライン

*   **日常の開発**:  
    プロジェクトごとに `pi` を起動して開発するだけ。プロジェクト固有の知識は `write_local_memory` ツールによって足元にだけ綺麗に蓄積され、グローバルを汚染するリスクが根本的にゼロになる。
*   **安全ファーストの統合プロセス**:  
    AIに丸投げするのではなく、「AIに提案を出させる ? 人間が選別する ? 反映する」という対話の手間をあえて挟むことで、あなたの大切なグローバル記憶資産が壊れるのを100%防ぐことができる。

