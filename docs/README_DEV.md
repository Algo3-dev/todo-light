# 開発者向けREADME

## アーキテクチャ

Electron の標準的な 3 層構成。UI から OS 機能へは `preload.js` の `contextBridge` 経由でのみアクセスする(`contextIsolation: true` / `nodeIntegration: false`)。

```
index.html (renderer: 描画・D&D・編集)
   │ window.TodoLogic  ← logic.js (純粋ロジック。UI非依存)
   │ window.api        ← preload.js (contextBridge)
   ▼ IPC
main.js (main: ウィンドウ・トレイ・設定/タスクの永続化)
   └─ %APPDATA%\todo-gadget\todo-data.json
```

(drawio 図は未作成。必要になったら `docs/` に追加してここへリンクする)

## 技術スタック(具体バージョン)

- Electron 33.4.11(`TodoGadget.bat` の `VER` が正本。`%LOCALAPPDATA%\TodoGadget\runtime` に展開)
  - **Electron を更新するときは `VER` と `SHA256` を必ずセットで変える。** 値は `https://github.com/electron/electron/releases/download/v<VER>/SHASUMS256.txt` の `electron-v<VER>-win32-x64.zip` の行。実ファイルの `sha256sum` とも突き合わせること
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
│  ├─ *.test.js      logic.js / layout.js の単体テスト(配布物には含めない)
│  ├─ index.html     UI(CSS/JSインライン)
│  └─ package.json
├─ TodoGadget.bat    起動(初回にElectron自動DL) / TodoGadget.vbs: 窓なし起動
├─ AddToStartup.bat / RemoveFromStartup.bat
├─ scripts/          build.bat(品質ゲート) / dist.bat(配布ZIP)
├─ config/
├─ docs/
├─ AGENTS.md         AIエージェント向けルールの正本
├─ README.md         利用者向け
├─ LICENSE           MIT
├─ .gitattributes    bat/vbs を CRLF に固定
└─ VERSION
```
