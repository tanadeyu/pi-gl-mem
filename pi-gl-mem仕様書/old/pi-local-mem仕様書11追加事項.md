# pi-local-mem 仕様書11 v1.1.0 変更計画

## 設計方針

| # | 項目 | 決定内容 |
|---|------|----------|
| 1 | .pi-local-mem/ がない場合 | 一切の処理を行わない（注入なし・ツールなし） |
| 2 | 存在確認方法 | cwd から上方向に上限なしで探索（git準拠） |
| 3 | 初回セットアップ | `pi-local-mem-init.sh`（シェルスクリプトのみ）。Y/N 確認あり。AIはスクリプト実行を指示する形 |
| 4 | アンインストール後 | `pi uninstall` 後も .pi-local-mem/ は残る。不要なら手動削除 |
| 5 | 次期バージョン | **v1.1.0** |
| 6 | npm 公開 | 検討中。無料・誰でも可能・公開者の責任リスクはほぼゼロ |

## pi-local-mem.ts の変更点

1. **auto-create 削除**: 初回起動時の .pi-local-mem/ 自動生成を削除
2. **上探索ロジック追加**: cwd から .pi-local-mem/ を上方向に上限なしで探索
3. **pi-local-mem-init ツール追加**: 削除（シェルスクリプトのみに。AIは「bash pi-local-mem-init.sh 実行して」と指示）
4. **全ツールに存在チェック追加**: .pi-local-mem/ がない場合は「先に init してください」とエラー
5. **注入も存在時のみ**: before_agent_start の注入は .pi-local-mem/ がある場合のみ実行

## ファイル構成（npm 公開時）

```
@tanadeyu/pi-local-mem/
├── package.json          # 名前・pi.extensions 設定
├── pi-local-mem.ts       # 本体（全機能内蔵）
└── pi-local-mem-init.sh  # シェルスクリプト（オプション）
```

## 最低限のテスト計画

テストは手動で実施（自動テスト環境なし）。作業量少なめ。WSL内完結で行う。

### 準備: npm link（ローカルリンク）
```bash
cd /mnt/c/projects/pi-local-mem
npm link
# ローカルに @tanadeyu/pi-local-mem がリンクされる（実際の公開なし）
pi install npm:@tanadeyu/pi-local-mem
# 以後 pi 再起動で動作確認可能
# ソース編集→pi再起動で即テスト（リンクなので自動反映）
```

### テスト1: init 動作確認
```bash
mkdir /tmp/test-init && cd /tmp/test-init
# .pi-local-mem/ がない状態で pi 起動 → 何も起きない
# AIに「pi-local-mem-init 実行して」と指示
# または bash pi-local-mem-init.sh を実行 → .pi-local-mem/ 作成
ls .pi-local-mem/  # daily_local/ notes_local/ MEMORY_local.md 等確認
```

### テスト2: 上探索確認
```bash
mkdir -p /tmp/test-search/sub/dir
cd /tmp/test-search && bash pi-local-mem-init.sh  # init
cd sub/dir && pi 起動  # 上に .pi-local-mem/ があるので認識
cd /tmp && pi 起動     # 上にないので何もしない
```

### テスト3: v1.0.0 互換性確認
既存の .pi-local-mem/ があるプロジェクトで pi 起動 → 従来通り動作

### テスト4: uninstall 後
```bash
pi uninstall npm:@tanadeyu/pi-local-mem
# .pi-local-mem/ が残っていることを確認
rm -rf .pi-local-mem/   # 手動削除できることを確認
```

テスト時間: 約15分
