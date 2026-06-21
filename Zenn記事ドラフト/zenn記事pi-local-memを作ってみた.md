---
title: "pi-local-mem でプロジェクトごとに記憶を分離する"
emoji: "🧠"
type: "tech"
topics: ["pi", "pi-coding-agent", "memory", "ai", "extension"]
published: false
---

# pi-local-mem でプロジェクトごとに記憶を分離する

## 背景
[pi-mem（@haha1903/pi-mem）](https://github.com/haha1903/pi-mem) で pi coding agent（以下 pi）に記憶を持たせられるようになりましたが、**記憶はPC全体で共有**されます。プロジェクトAの仕様がプロジェクトBの会話に混ざるのが気になる方もいるかもしれません。

そこで、将来的にマルチエージェント対応も見据えて、プロジェクトごとに独立した記憶として使えるようなものを考えてみました。

## 注意書き

**実験段階です。** 最低限の動作確認はしていますが、想定外の挙動や問題が発生する可能性があります。以下の点をご理解いただける方のみ、自己責任でお試しください：

- 本拡張の内容を事前に把握できる方
- サンドボックス環境（テスト用プロジェクト）で検証できる方
- 発生した問題に対して自己対処できる方
- プロジェクトの記憶が破損しても許容できる方

pi-mem と互換性がありますが、**別実装・独立動作**です。pi-mem のコードは一切使っていません。

## バージョン間の互換性について

本拡張の動作確認は以下の組み合わせでのみ行っています：

- pi 0.79.8
- @haha1903/pi-mem 1.0.1
- pi-local-mem.ts v1.0.0

pi、pi-mem、pi-local-mem のバージョンは互いに影響し合う可能性があります。特に pi 本体のアップデートで Extension API が変わった場合、動作しなくなることも考えられます。**この記事の内容は現時点（2026年6月）の限定動作**であり、将来のバージョンでの動作を保証しません。

運用する際は pi・pi-mem・pi-local-mem のバージョンを揃えておくことを推奨します。

## pi-mem との違い

| | pi-mem | pi-local-mem |
|---|---|---|
| 記憶の範囲 | PC全体（グローバル） | プロジェクトごと（ローカル） |
| インストール | `pi install @haha1903/pi-mem` | `pi install https://github.com/tanadeyu/pi-local-mem` |
| ツール名 | memory_write / memory_read | write_local_memory / read_local_memory |
| 保存先 | `~/.pi/agent/memory/` | `./.pi-local-mem/` |

**共存可能**です。両方入れるとグローバル記憶とローカル記憶が同時に使え、ツール名で書き分けられます。

## どうやって動いているか

pi-local-mem も pi-mem と同じ pi の Extension API を使っています。中身はいたってシンプルです：

1. **起動時に `./.pi-local-mem/` を自動生成**（なければ作るだけ）
2. **`before_agent_start` イベントで記憶をプロンプト末尾に追記**（文字列を足すだけ）
3. **4つのツールを提供**（AIが説明文を読んで使いこなす）

特に3つ目がポイントで、拡張機能側に「いつ呼ばれるか」の条件分岐を一切書かなくて良いのが pi の設計思想です。

## インストール

```bash
# インストール
pi install https://github.com/tanadeyu/pi-local-mem

# アンインストール
pi uninstall https://github.com/tanadeyu/pi-local-mem
```

たったこれだけです。GitHub上の package.json を参照して拡張機能をロードします。元ファイルの削除・移動制限はありません。`pi uninstall` しても `.pi-local-mem/` の既存データは削除されません。

**pi-mem と併用する場合**：両方インストールするときは `pi-mem → pi-local-mem` の順番になるよう注意してください。すでに pi-local-mem を入れていて後から pi-mem を追加する場合は、一度 `pi uninstall https://github.com/tanadeyu/pi-local-mem` してから pi-mem → pi-local-mem の順で入れ直すと確実です。順番が逆だとコンテキストの注入順序がおかしくなり、正しく動作しない可能性があります。

## 使い方

AIに「覚えておいて」と伝えるだけです。保存場所と記憶の種類を組み合わせて指定できます：

| 保存場所 | 記憶の種類 | こんな感じで |
|---|---|---|
| グローバル（PC全体） | 長期記憶 | 「グローバルの長期記憶として保存しておいて」 |
| グローバル（PC全体） | 日記 | 「今の対応をグローバルの日記に残しておいて」 |
| グローバル（PC全体） | ノート | 「この設定をグローバルのノートにまとめておいて」 |
| ローカル（このプロジェクト） | 長期記憶 | 「このプロジェクトの仕様を覚えておいて」 |
| ローカル（このプロジェクト） | 日記 | 「今の対応をプロジェクトの日記に残しておいて」 |
| ローカル（このプロジェクト） | ノート | 「この設定方法をプロジェクトのノートにまとめておいて」 |
| - | チェックリスト | 「やることリストに追加しておいて」 |

AIがツールの説明を読んで適切に保存してくれます。「ローカル」や「プロジェクト」と指定すればプロジェクト専用記憶（pi-local-mem）に、「グローバル」と指定すればPC全体の記憶（pi-mem）に振り分けられます。

保存した記憶は次回以降の会話でAIが自動で参照してくれます。ただしAIや状況によっては自動で参照しない場合もあるため、その場合は明示的に「〜について覚えてる？」と指定すると確実です。

## グローバルとローカルの住み分け

今回追加した内容は、あくまで**ローカル（プロジェクト内）の記憶**です。**グローバル（ユーザーレベル）の記憶**は従来から使わせてもらっている [pi-mem](https://github.com/haha1903/pi-mem) が担当します。

```
グローバル（PC全体）← pi-mem
ローカル（プロジェクトごと）← pi-local-mem（今回作成）
```

両方インストールすると並行して使え、AIが内容に応じて振り分けて保存してくれます。「このプロジェクトだけの設定」はローカル、「どのプロジェクトでも使いたい知識」はグローバル、という使い分けが自然にできます。

## 記憶領域の構成

```text
your-project/
  └─ .pi-local-mem/
      ├─ MEMORY_local.md            # 長期記憶
      ├─ SCRATCHPAD_local.md        # チェックリスト
      ├─ daily_local/YYYY-MM-DD.md  # 日次ログ
      ├─ notes_local/<file>.md      # ノート
      └─ pi_memory_local.json       # 設定
```

## 設定

`.pi-local-mem/pi_memory_local.json` で動作を変えられます：

```json
{"injectLocal": true, "injectGlobal": true}
```

- `injectGlobal: false` にすると pi-mem のグローバル記憶注入をオフにできます（実験的機能）
  - ただしコンテキストから完全に除外する処理ではなく、後段で「処理しないでください」とフィルタをかける方式です
  - マルチエージェント環境でのテストは行っていません
  - デフォルトは `true`（両方ON）で、通常はそのままで問題ありません
- pi-mem と pi-local-mem の packages 順序は pi-mem → pi-local-mem の順にしてください

## 環境

- OS: Windows 11 Pro（WSL2 Ubuntu 22.04.5 LTS）
- Node.js: v22.22.2 / npm: 10.9.7
- pi: 0.79.8
- @haha1903/pi-mem: 1.0.1（共存時）
- pi-local-mem.ts: v1.0.0

## ソースコード

GitHub で公開しています： [tanadeyu/pi-local-mem](https://github.com/tanadeyu/pi-local-mem)

TypeScript 1ファイル（約340行）で完結しているので、中身を読んでみると面白いかもしれません。「tool use」がどう動いているか実感できます。
