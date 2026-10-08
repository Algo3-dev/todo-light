# テスト戦略

## テストフレームワーク

- Node.js 組み込みの `node:test` + `node:assert`(追加依存なし)
- 対象は `app/logic.js` と `app/layout.js`(UI非依存の純粋ロジック)。テストは同名の `app/*.test.js` に置く
- `main.js` / `index.html` は Electron / DOM 依存のため自動テスト対象外(手動確認)
- TDD(探索 → Red → Green → Refactoring)で進める

## 実行コマンド

```
node --test app/*.test.js
```

ディレクトリ指定(`node --test app`)は `main.js` まで実行され electron 未解決で失敗するため、必ず glob で指定する。

## カバレッジ方針

目標値はここを正本とする(グローバル設定には書かない)。

- `app/logic.js`: 行・分岐とも 90% 以上を目標(`node --test --experimental-test-coverage app/*.test.js` で計測。現状 行99.4% / 分岐98.0%)
- UI / メインプロセス: 目標値なし(手動確認)

## モック方針

- `logic.js` は純粋関数のためモック不要。入力の `todos` 配列を直接組み立てる
- ファイルI/O・Electron API は `logic.js` に持ち込まない
