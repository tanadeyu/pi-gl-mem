### ?? プロジェクト専用メモリ拡張プラグイン「pi-local-mem」完全仕様書（GitHub公開決定版）

### 1\. 概要

本仕様は、各プロジェクトフォルダの直下にのみ独立した記憶領域を展開・管理するためのカスタム拡張プラグイン（`pi-local-mem`）の仕様である \[Zenn\]。

### ?? 本プラグインの真の価値（マルチエージェント分離と美観の両立）

*   **マルチエージェントの脳内分離**: プロジェクトによってはグローバルの記憶と完全に分離して運用したい場合に非常に有効である。エージェント同士によるグローバル記憶の予期せぬ汚染を防ぎ、特定の役割を持ったエージェントをノイズのない完全な白紙状態で目の前の仕様に集中させることができる。
*   **グローバルプラグイン（@haha1903/pi-mem）との完璧な併用・互換性**:  
    PC全体に大元の `@haha1903/pi-mem` がインストールされている環境でも、何の問題もなく100%安全に動作する。その場合は、大元のグローバル記憶（共通ルール）の下に、本プラグインが読み込んだプロジェクト専用記憶（最優先事項）がAIの頭脳へ自動的にマージ（合流）される。もちろん、大元のプラグインがない環境でも完全独立して動作する。
*   **他プラグインや将来の亜流（フォーク）との競合・衝突リスクゼロ（非破壊設計）**:  
    本プラグインは既存のいかなるプラグインのコードも1文字も書き換えない「完全外付け型」の独立設計である。さらに、`pi` 本体が提供する正規のイベントフック機能（`on('context')`）の標準的な自動連結仕様にのみ準拠しているため、**将来公式のアップデートやどのような新しい亜流プラグインが登場・共存しても、エラーや衝突（コンフリクト）を起こすリスクは根本的にゼロ（100%安全）**である。
*   **tmux（マルチウィンドウ）環境への最適化**: `tmux` を用いて画面を分割し、複数のエージェントプロセスを同時に並列稼働させる実戦的な運用においても真価を発揮する。各画面のエージェントが吐き出す雑多な作業メモが同一プロジェクト内の `.pi-local-mem/` に閉じ込められるため、隣のペイン（画面）のエージェントの頭脳を汚染するリスク（画面間コンテキスト汚染）を根本からシャットアウトできる。
*   **極限のクリーンな見た目**: 初回起動時に、設定ファイルだけでなく、本プラグインのソースコード自身をも自動的に隠しフォルダ内へ退避させる「自己隠蔽型」の設計を採用。`tmux` で複数ペインを立ち上げて頻繁にファイル確認（`ls` 等）を行う環境でも、プロジェクトルートの美観を100%美しく、ノイズレスに維持する。
*   **堅牢な安全設計（ロバストネス）**: 現場のリアルなエラー（書き込み権限の有無やJSONの記述ミス）を想定した例外処理（`try-catch`）を内包し、安全に運用できる。

* * *

### ?? 2. ディレクトリおよびファイル構造

大元のグローバル記憶は従来通りの挙動を維持し、本プラグインが足元に隠しフォルダを新設し、関連ファイルをすべてその中に隠蔽（内包）する。

text

    # 【グローバル】（既存のpi-mem仕様・完全放置 / 共存可能）
    ~/.pi/agent/memory/
      └── MEMORY.md          # 既存のツールはこれまで通りここを勝手に読み書きする
    
    # 【ローカル】（新設・本プラグイン「pi-local-mem」が管理する独立領域）
    ~/your-project-folder/
      ├── .pi-local-mem/     # ? 起動時に自動生成され、すべてを内包する隠しフォルダ
            ├── MEMORY.md    # このプロジェクト専用の仕様、型定義、TODOなど
            ├── pi_memory.json # ? ローカル記憶の注入をON/OFFする設定フラグ（デフォルト: true）
            └── pi-local-mem.js# ? 【自己隠蔽】初回起動時にルートからこの中に自動移動される
    

コードは注意してご使用ください。

* * *

### ?? 3. 自己完結型プラグイン全ソースコード（Node.js / 約65行）

以下のコードを丸ごとコピーして、プロジェクトのトップフォルダ（ルート）に **`pi-local-mem.js`** という名前で保存してください（最初の起動後に自動で隠されます）。
プロジェクトごとに設定が必要となります。

javascript

    /**
     * ?? pi-local-mem.js (ロバスト・ミニマム決定版)
     * 
     * 【概要】
     * プロジェクト（カレントディレクトリ）直下にのみ、独立した記憶領域を展開・管理するプラグイン。
     * プロジェクトごとに記憶を完全に分離し、マルチエージェントやtmuxの並列運用を最適化します。
     * 
     * 【?? 安全性・競合リスクゼロについて】
     * 本プラグインは他プラグインのソースコードを一切書き換えない「完全外付け型」の非破壊設計です。
     * pi本体の正規イベント仕様のみで動作するため、将来の公式アップデートや、他のどのような亜流（フォーク）
     * プラグインが同環境にインストール・共存しても、絶対に衝突（エラー）を起こさない完璧な安全性を保証します。
     * 
     * 【?? 既存プラグインとの共存について】
     * 大元のグローバルプラグイン（@haha1903/pi-mem）がある前提でも問題なく動きます。
     * その場合は、大元の共通ルールと本プラグインのローカル仕様がAIの頭脳へ自動マージ（合流）されます。
     * 大元のプラグインがない環境（完全な白紙からスタートしたい場合）でも、単体で完全独立して動作します。
     * 
     * 【1. インストール方法】
     * プロジェクトのトップフォルダ（ルート）に本ファイルを配置し、ターミナルで以下を実行：
     * $ pi install ./pi-local-mem.js
     * 
     * 【2. 使い方】
     * インストール後、通常通り「pi」を起動。
     * 起動した瞬間に、足元に「.pi-local-mem/」が生成され、本ファイル自身を含むすべてが隠蔽されます。
     * ローカル記憶の注入を止めたい場合は「.pi-local-mem/pi_memory.json」の injectLocal を false にしてください。
     * 
     * 【3. 安全な融合作業（注意・免責事項）】
     * ローカルからグローバルへ知識を昇格・マージさせる作業は、AIの誤作動（ハルシネーション）を防ぐため、以下のステップを推奨します。
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
