# 開発者向けREADME

## アーキテクチャ

Electron の標準的な 3 層構成。UI から OS 機能へは `preload.js` の `contextBridge` 経由でのみアクセスする(`contextIsolation: true` / `nodeIntegration: false`)。

```
index.html (renderer: 描画・D&D・編集)
   │ window.TodoLogic     ← logic.js (親子・先行・期限の純粋ロジック。UI非依存)
   │ window.GadgetLayout  ← layout.js (位置・サイズ・ショートカット解決の純粋ロジック)
   │ window.GadgetTheme   ← theme.js (ベース色パレットと色の導出の純粋ロジック)
   │ window.api        ← preload.js (contextBridge)
   ▼ IPC
main.js (main: ウィンドウ・トレイ・グローバルショートカット・設定/タスクの永続化)
   │ layout.js / theme.js を require して位置・サイズの計算と設定値の検証を行う
   ├─ %APPDATA%\Todo Gadget\todo-data.json   (タスク・設定)
   └─ %APPDATA%\Todo Gadget\shortcuts.log     (ショートカットの割り当て結果)
```

(drawio 図は未作成。必要になったら `docs/` に追加してここへリンクする)

## 名称の扱い

- 製品名(画面上の表記)は **TODO LIGHT**(大文字・太字)。ウィンドウタイトル・ヘッダー・トレイのツールチップ・README が対象
- 次の識別子は互換性のため旧名のまま変えない
  - `app/package.json` の `productName`(`Todo Gadget`): Electron が保存先 `%APPDATA%\Todo Gadget\` とログイン項目名を決めるため。変えると既存のタスク・設定が読めなくなる
  - `TodoGadget.bat` / `.vbs` / `TodoGadget.exe`、`%LOCALAPPDATA%\TodoGadget\runtime`、配布ZIP名 `TodoGadget-<VER>.zip`、スタートアップの `TodoGadget.lnk`

## 技術スタック(具体バージョン)

- Electron 44.7.0(`TodoGadget.bat` の `VER` が正本。`%LOCALAPPDATA%\TodoGadget\runtime` に展開)
  - インストール済みの Electron のバージョンは `runtime\electron.version` に記録する。`VER` と異なる(または記録が無い)と、次回起動時に取得し直す。旧版が起動中なら、ダウンロードせず終了を案内して中止する
  - **Electron を更新するときは `VER` と `SHA256` を必ずセットで変える。** 値は `https://github.com/electron/electron/releases/download/v<VER>/SHASUMS256.txt` の `electron-v<VER>-win32-x64.zip` の行。実ファイルの `sha256sum` とも突き合わせること(GitHub API の asset の `digest` も独立した照合に使える)。更新後は、隔離環境(`--user-data-dir` を別フォルダに指定。**本物の保存先 `%APPDATA%\Todo Gadget` を使わないこと**)で、画面描画・サイズ変更・背景素材・ショートカット登録・トレイの互換性を確認する
  - `TodoGadget.bat` の PowerShell は、モジュール由来のコマンド(`Get-FileHash` 等)に頼らず .NET を直接使う。PowerShell 7 から起動された環境では `PSModulePath` が引き継がれ、Windows PowerShell 5.1 が非互換のモジュールを拾って `Get-FileHash` が使えなくなる実例があった(検証が常に失敗して初回起動できなくなる)。bat のダウンロード行を変えたら、行を取り出して正しい/誤ったハッシュの両方で実行し、終了コード 0 / 2 を確認すること
  - `.bat` / `.vbs` は `.gitattributes` で CRLF に固定している(LF だけの bat は `goto` / ラベルが誤動作することがある)。編集後に改行が LF になっていないか注意
- 素の JavaScript(ビルド工程・バンドラなし)
- テスト: Node.js 組み込みの `node:test`(開発時のみ。配布物には不要)

## プロジェクト構成

```
TodoGadget-light/
├─ app/
│  ├─ main.js        Electronメインプロセス(ウィンドウ/トレイ/保存/IPC)
│  ├─ preload.js     contextBridgeでwindow.apiを公開
│  ├─ logic.js       親子・先行関係・期限(緊急度)の純粋ロジック(UMD。Node/ブラウザ両対応)
│  ├─ layout.js      ウィンドウの隅配置・サイズ・折りたたみ高さ・画面内への引き戻しの純粋ロジックとショートカット定義(UMD)
│  ├─ theme.js       ベース背景色のパレットと、任意色から暗く読みやすい2色を導出する純粋ロジック(UMD)
│  ├─ *.test.js      logic.js / layout.js / theme.js の単体テスト(配布物には含めない)
│  ├─ index.html     UI(CSS/JSインライン。ヘッダーの外観・配置ポップオーバー)
│  └─ package.json
├─ TodoGadget.bat    起動(初回にElectron自動DL) / TodoGadget.vbs: 窓なし起動
├─ AddToStartup.bat / RemoveFromStartup.bat
├─ scripts/          build.bat(品質ゲート) / dist.bat(配布ZIP)
├─ config/
├─ docs/
├─ README.md         利用者向け
├─ LICENSE           MIT
├─ .gitattributes    bat/vbs を CRLF に固定
└─ VERSION
```
