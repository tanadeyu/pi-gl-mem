# 設計思想とpi-core / pi-mem / pi-local-mem 連携
## この文書の位置づけ
pi 拡張機能の設計思想を整理する。コード解説（pi-local-mem解説書.md）や配布方法（パッケージ配布の方法.md）とは別に、**「なぜこの方式なのか」** に焦点を当てる。
## pi 拡張の基本設計：tool use パラダイム
従来のプラグイン方式（VSCode等）：
```
イベント発生 → プラグイン内で if/switch 判定 → 処理実行
```
pi 拡張：
```
開発者が { 道具の名前, 説明書, 実装 } を登録 → AI が説明書を読んで適宜呼ぶ
```
**拡張機能側に判断ロジックが一切不要**なのが最大の特徴。AI（LLM）が持つ「文章を読んで理解し適切な行動を選ぶ」能力に全面依存する。判断はすべてAIの推論エンジン内で行われ、コード上の条件分岐は存在しない。
### なぜ初見のツールを使いこなせるのか
pi-core は registerTool で定義された `description` と `parameters` を、LLM のネイティブ形式（OpenAI tools API / Claude tool use）に翻訳して送信する。LLM はこの説明文を**読んで**初見のツールでも即座に使い方を理解する（ゼロショット）。write_local_memory を初めて実装した当日から問題なく動作するのは、説明文が日本語で書かれているからに過ぎない。
## 2段階方式：推論 → 実行
```
第1段階（AIの頭の中）:
  「タスクが完了した。Local Log Rule に従い daily に記録すべきだ」
  → write_local_memory(target="daily", content="...") を呼ぼう
  ↓
第2段階（ツール実行）:
  pi-core が LLM から返ってきた JSON を受け取り
  → 対応する execute() を呼び出す
  → ファイル保存
```
拡張機能側は第2段階の `execute()` だけを実装する。第1段階の判断材料として `description` に使い方のルールを書いておくことが、拡張機能開発者の仕事になる。
## systemPrompt アペンド方式
pi-mem も pi-local-mem も「記憶をAIに読ませる」方法は**同じ**: `before_agent_start` イベントで `event.systemPrompt` の末尾に文字列を追記するだけ。
| 拡張機能 | タグ | 記憶の種類 |
|---|---|---|
| pi-mem | `<pi-mem-injected>` | PC全体のグローバル記憶 |
| pi-local-mem | `### [PROJECT LOCAL MEMORY - 優先]` | プロジェクト固有のローカル記憶 |
複雑なマージやデータ構造変換は一切行わず、読めたファイルをそのまま末尾にアペンドする。コンテキストウインドウの制約には「何を inject するか」の設定（injectLocal / injectGlobal）で対応する。
### 2つの記憶の住み分け
両方を同時運用しても混乱しない理由：
- **タグが異なる**ので視覚的に区別がつく
- **ツール名が異なる**（memory_write vs write_local_memory）ので、AIが「どこに書くべきか」を迷わない
- **順序が明確**: packages配列の順序で末尾に積まれ、後ろほど優先度が高い
## グローバル記憶の遮断（injectGlobal）
pi-local-mem の特徴的な機能。pi-mem が注入する `<pi-mem-injected>` タグを含むメッセージを、`context` イベントの後段フィルタで除去する。
パッケージ順（pi-mem → pi-local-mem）とイベント実行順に依存するが、情報の出どころをタグで特定してフィルタする方式はシンプルで追跡しやすい。シングルエージェント運用では `false` にする実益はほぼないが、マルチエージェントや機密分離が必要な場面で効く。
## tool use がもたらす「書かなくていい」ロジック
| 従来必要だったこと | pi 拡張では |
|---|---|
| イベントの種類で条件分岐 | AI が判断するので不要 |
| ツールの使い方をハードコード | description に書くだけでAIが読む |
| 引数バリデーション | typebox で自動生成（LLM側で適切な値を選ぶ） |
| エラーハンドリング | 各 execute 内で完結。本体に影響させない |
拡張機能開発者は「どのような道具を、どんな説明で渡すか」に集中でき、**「いつ呼ばれるか・どう使われるか」を制御する必要がない**。
## pi-local-mem 設計判断のポイント
| 判断 | 選択した方式 | 理由 |
|---|---|---|
| pi-mem への依存 | ゼロ（コピー持参） | 将来の互換性問題を回避 |
| ファイル操作 | 同期（fs.readFileSync） | 非同期より堅牢・性能影響ゼロ |
| パストラバーサル対策 | path.basename() | note のファイル名だけサニタイズ |
| 設定ファイルパース失敗 | デフォルト値で続行 | 設定ミスで拡張全体が止まらない |
| セッションID取得失敗 | `'--------'` で代替 | 記録を止めない |
## 全体連携図
```
pi 起動
  │
  ├─ pi-core: 拡張機能をロード
  │   ├─ pi-mem （グローバル記憶担当）
  │   └─ pi-local-mem（ローカル記憶担当）
  │
  ├─ before_agent_start イベント
  │   ├─ pi-mem: グローバル記憶を systemPrompt 末尾にアペンド
  │   └─ pi-local-mem: ローカル記憶を systemPrompt 末尾にアペンド
  │
  ├─ 会話中、必要に応じてツール呼び出し
  │   ├─ memory_write / memory_read（グローバル）
  │   ├─ write_local_memory / read_local_memory（ローカル）
  │   └─ local_scratchpad / search_local_memory（ローカル）
  │
  └─ context イベント（injectGlobal:false 時のみ）
      └─ pi-local-mem: <pi-mem-injected> を含むメッセージを除去
```
## 付録：用語整理
| 用語 | 意味（この文書での定義） |
|---|---|
| pi-core | pi 本体。拡張機能のロード・LLMとの通信・ツール実行を司る |
| pi-mem | グローバル記憶拡張。PC全体の記憶を管理 |
| pi-local-mem | ローカル記憶拡張。プロジェクト固有の記憶を管理 |
| tool use | LLMがツール定義を読んで呼び出す仕組み |
| systemPrompt chaining | 複数の拡張機能が順に systemPrompt を拡張していく方式 |
