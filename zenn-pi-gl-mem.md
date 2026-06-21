# pi-gl-mem を作ってみました

## 動作確認環境
- **OS**: Windows 11 Pro（WSL2 / Ubuntu 24.04）
- **pi 本体**: v0.79.8 / **Node.js**: v24.17.0 / **TypeScript**: 5.x

## はじめに

**pi** はターミナルで動くAIコーディングエージェントですが、会話を終えると記憶を引き継げません。一度伝えても次回起動すると忘れてしまいます。

**pi-gl-mem** は pi に「記憶」を追加する拡張機能です。

## なぜ pi-mem ではなく pi-gl-mem なのか

既存の pi-mem はグローバル記憶を提供しますが、個人的に直したい点がありました。

| 課題 | pi-mem | pi-gl-mem |
|------|--------|-----------|
| グローバル記憶の管理 | 複数ファイル構成で煩雑 | **MEMORY.md 1ファイルに統一** |
| ローカル記憶の分離 | プロジェクト混在リスク | **./.pi-gl-mem/ で完全分離** |
| サブディレクトリ対応 | 非対応（cwd固定） | **上方向探索で自動認識** |
| 未初期化の安全性 | エラーになることがある | **早期returnで何もしない** |
| マルチエージェント | 考慮されていない | 注意喚起あり（後述） |

pi-gl-mem はこれらの課題をすべて解決しつつ、**依存ゼロ**（pi-mem 不要）で動作します。pi-mem の仕様を参考にしていますが、コードの依存は一切ありません。

## できること — 安全設計

**未初期化のプロジェクトでは何もしません。** ツール自体が登録されないため、AIが誤って呼び出すことも、エラーでクラッシュすることもありません。

その上で、pi-gl-mem を入れると**2つの記憶領域**が使えます。

> 💡 **マルチエージェント運用の場合**: グローバル記憶は1つのエージェントだけONにし、他はOFFにして使うことを推奨します（`pi_gl_settings.json` で `injectGlobal` を調整）。プロジェクト内では同時に1つの pi だけ起動してください。複数プロセスで同じファイルに書き込むと競合の原因になります。

| 記憶 | 保存先 | ファイル数 | 用途 |
|------|--------|-----------|------|
| 🌐 グローバル | `~/.pi/agent/pi-gl-mem/MEMORY.md` | **1ファイル** | PC全体の共通知識 |
| 📁 ローカル | `./.pi-gl-mem/` | 4ファイル | プロジェクト固有の情報 |

## こんな場面で便利

| シーン | グローバル／ローカル | 例 |
|--------|-------------------|-----|
| プロジェクトごとにテストフレームワークが違う | 📁 ローカル | 「このプロジェクトではvitest」 |
| 自分のコーディングルールを徹底したい | 🌐 グローバル | 「命名はcamelCase、any禁止」 |
| 日次ログで作業を習慣化 | 📁 ローカル | 「今日やったことを日記に書いて」 |
| PC全体の設定を統一 | 🌐 グローバル | 「TypeScriptはstrictモード必須」 |

## 使い方

### インストール
```bash
pi install https://github.com/tanadeyu/pi-gl-mem
```
`pi install` は GitHub からクローンし `~/.pi/agent/settings.json` の packages に追記。pi 起動時に自動ロードされます。packages の**後ろにある拡張ほど優先**されるため、必要に応じて順序を調整してください。

### アンインストール
```bash
pi uninstall https://github.com/tanadeyu/pi-gl-mem
rm -rf ./.pi-gl-mem   # データも残るので不要なら削除
```

### 初期化（プロジェクトごとに1回）
```bash
pi-gl-mem-init   # Y/N確認 → .pi-gl-mem/ を作成
```

```
your-project/.pi-gl-mem/
  ├── MEMORY.md           # 長期記憶（自動ロード）
  ├── SCRATCHPAD.md       # チェックリスト（手動read）
  ├── daily/              # 日次ログ（今日+昨日を自動ロード）
  ├── notes/              # ノート類（手動read）
  └── pi_gl_settings.json # 設定
```

> 📌 **注意**: `.gitignore` への追記は推奨しますが、自動では変更しません。必要に応じて手動で追加してください。

```
echo ".pi-gl-mem/" >> .gitignore
```

> 📌 **注意**: git の操作（add/commit/push等）はユーザーが明示的に指示するまで実行しないでください。ファイル編集・作成のみ行い、git操作はユーザー指示を待つこと。

`pi_gl_settings.json` では各プロジェクトの設定を管理します。

```json
{"injectLocal": true, "injectGlobal": true}
```

| 設定 | 初期値 | 意味 |
|------|--------|------|
| `injectLocal` | `true` | ローカル記憶をAIに読ませる |
| `injectGlobal` | `true` | グローバル記憶をAIに読ませる |

`false` にすると該当の記憶が注入されなくなります。マルチエージェント時はグローバルを1つだけONにするなどの調整に使います。

## グローバルとローカルの使い分け

```
「PC全体で覚えておいて: テストはvitest」→ 🌐 グローバル
「このプロジェクトで覚えておいて: DBはSQLite」→ 📁 ローカル
「覚えておいて」→ AIが文脈から自動判断
```

## ツール一覧と保存先マッピング

pi-gl-mem は6ツールを提供します。

| あなたの指示 | AIが呼ぶツール | 保存先 |
|------------|---------------|--------|
| 「覚えておいて」 | `write_local_memory(target="long_term")` | `.pi-gl-mem/MEMORY.md` |
| 「日記に書いて」 | `write_local_memory(target="daily")` | `.pi-gl-mem/daily/YYYY-MM-DD.md` |
| 「ノートに保存して」 | `write_local_memory(target="note")` | `.pi-gl-mem/notes/*.md` |
| 「やることリストに追加」 | `local_scratchpad(action="add")` | `.pi-gl-mem/SCRATCHPAD.md` |
| 「PC全体で覚えておいて」 | `write_global_memory(...)` | `~/.pi/agent/pi-gl-mem/MEMORY.md` |
| 「読み取って」 | `read_local_memory(...)` | 各種ファイル |
| 「探して」 | `search_local_memory(query=...)` | `.pi-gl-mem/**/*.md` |

## 技術的なポイント

```typescript
// 上方向探索: サブディレクトリからでも親の記憶を認識
while (currentDir !== path.dirname(currentDir)) {
  if (fs.existsSync(path.join(currentDir, '.pi-gl-mem'))) break;
  currentDir = path.dirname(currentDir);
}
// グローバルは os.homedir() で物理パスを取得（~ のまま使わない）
const globalDir = path.join(os.homedir(), '.pi', 'agent', 'pi-gl-mem');
// 未初期化プロジェクトでは早期return（ツールも注入も一切しない）
if (!fs.existsSync(localDir)) { return; }
```

TypeScript 1ファイル・約400行で完結。他拡張への依存はゼロです。

### 設計のこだわり
| 項目 | 内容 |
|------|------|
| **ゼロ依存** | 他拡張の関数を一切importしない。必要な関数はすべてコピー持参 |
| **安全設計** | 未初期化プロジェクトでは何もしない（クラッシュしない） |
| **上方向探索** | サブディレクトリから起動しても親の記憶を自動認識 |
| **変更に強い** | append 追記方式。上書きは明示的に mode=overwrite 指定 |
| **git 安心** | init 時に .gitignore 追記を推奨表示（自動変更はしない） |

## まとめ
- ✅ グローバルとローカル、2階層の記憶を提供
- ✅ インストール1コマンド、初期化1コマンド
- ✅ 他拡張に依存しない自己完結設計
- ✅ 安全設計（未初期化では何もしない）

**リンク**: [github.com/tanadeyu/pi-gl-mem](https://github.com/tanadeyu/pi-gl-mem)
インストール: `pi install https://github.com/tanadeyu/pi-gl-mem`

---

*ライセンス: MIT License / v1.0.0 (2026-06-21) / pi-mem の仕様を参考にしていますがコードの依存は一切ありません。単独で動きます。*
