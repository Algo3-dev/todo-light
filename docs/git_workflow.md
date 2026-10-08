# git管理方針

## ブランチ方針

- 個人開発のため `main` を基本とし、大きな変更のみ作業ブランチ(`feature/xxx`)を切る

## コミットメッセージ規約

- 1行目は日本語の要約(命令形でなく体言止めでも可)。必要なら空行の後に詳細
- 接頭辞: `feat:` / `fix:` / `refactor:` / `test:` / `docs:` / `chore:`

## バージョニング

`VERSION` に現在のSemVerを記載し、gitタグの元とする。

- `app/package.json` の `version` は `VERSION` と一致させる
