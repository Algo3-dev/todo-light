# コーディング規約

## 命名規則

- 変数・関数は camelCase、定数は UPPER_SNAKE_CASE(例: `MATERIALS`)
- CSS クラスは小文字のケバブ/単語(例: `drop-child`, `rel-pred`)
- タスクのフィールド: `id` / `text` / `done` / `parentId` / `after`(先行タスクID配列) / `collapsed`

## コメント方針

- 既存コードに合わせ、日本語で「なぜ」を簡潔に書く。自明な処理には書かない
- 仕様の根拠(例: 循環禁止、子の繰り上げ)は該当関数の直前に1行で書く

## エラー処理

- 永続化(`loadData` / `saveData`)は失敗してもアプリを落とさず、既定値で継続する
- ロジック関数は例外を投げず、不正な操作は `false` / 変更なしの値を返して拒否する(`canMove` / `canLink`)
- 保存データは `normalize` で必ず正規化してから使う(壊れた親子・先行参照を除去)

## 禁止事項

- `logic.js` に DOM / Electron / Node 固有 API を持ち込まない(UMD でテスト可能に保つ)
- renderer から `nodeIntegration` や `remote` で OS 機能に直接触れない。必ず `preload.js` の `window.api` 経由にする
- ユーザー入力を `innerHTML` に埋め込まない(`textContent` を使う)
- `Content-Security-Policy` を緩めない
