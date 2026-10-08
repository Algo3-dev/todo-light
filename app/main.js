const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const dataFile = () => path.join(app.getPath('userData'), 'todo-data.json');

const os = require('os');

const defaults = {
  todos: [],
  settings: { opacity: 0.82, alwaysOnTop: false, bounds: null, material: 'acrylic' }
};

// Windows 11 22H2 (build 22621) 以降ならOS標準のアクリル/マイカが使える
const isWin11 =
  process.platform === 'win32' &&
  parseInt(os.release().split('.')[2] || '0', 10) >= 22621;
const MATERIALS = ['transparent', 'acrylic', 'mica'];
let nativeBlur = false; // 起動時に設定から決定

function loadData() {
  try {
    const raw = JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
    return {
      todos: Array.isArray(raw.todos) ? raw.todos : [],
      settings: { ...defaults.settings, ...(raw.settings || {}) }
    };
  } catch {
    return JSON.parse(JSON.stringify(defaults));
  }
}

// 一時ファイルに書いてから置き換える(書き込み途中のクラッシュでデータを壊さない)
function saveData(data) {
  const file = dataFile();
  const tmp = file + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  } catch (e) {
    console.error('save failed', e);
  }
}

// 連続操作(ドラッグ・入力・スライダー)での書き込みを間引く。終了時は flushSave で確定する
let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 300);
}
function flushSave() {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  saveData(data);
}

let data;
let win = null;
let tray = null;

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const b = data.settings.bounds || {
    width: 380,
    height: 560,
    x: workArea.x + workArea.width - 380 - 24,
    y: workArea.y + 24
  };

  const glass = nativeBlur
    ? { backgroundMaterial: data.settings.material, backgroundColor: '#00000000', hasShadow: true }
    : process.platform === 'darwin'
      ? { transparent: true, vibrancy: 'under-window', backgroundColor: '#00000000', hasShadow: false }
      : { transparent: true, backgroundColor: '#00000000', hasShadow: false };

  win = new BrowserWindow({
    ...b,
    minWidth: 300,
    minHeight: 280,
    frame: false,
    resizable: true,
    skipTaskbar: true,
    alwaysOnTop: !!data.settings.alwaysOnTop,
    ...glass,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');

  const persistBounds = () => {
    if (!win || win.isDestroyed()) return;
    data.settings.bounds = win.getBounds();
    scheduleSave();
  };
  let t;
  const debounced = () => { clearTimeout(t); t = setTimeout(persistBounds, 400); };
  win.on('move', debounced);
  win.on('resize', debounced);
}

// 最前面の変更はここに集約(トレイ・フッターのスイッチ共通)
function setPin(on) {
  data.settings.alwaysOnTop = !!on;
  win.setAlwaysOnTop(data.settings.alwaysOnTop, 'floating');
  saveData(data);
  win.webContents.send('settings-changed', data.settings);
}

function toggleWindow() {
  if (!win) return;
  if (win.isVisible()) win.hide();
  else { win.show(); win.focus(); }
}

function buildTray() {
  // 16x16 の単色アイコンをコードで生成（外部画像ファイル不要）
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x - 7.5, dy = y - 7.5;
      const inside = dx * dx + dy * dy <= 49;
      buf[i] = 120; buf[i + 1] = 220; buf[i + 2] = 255;
      buf[i + 3] = inside ? 230 : 0;
    }
  }
  const icon = nativeImage.createFromBuffer(buf, { width: size, height: size });
  tray = new Tray(icon);
  tray.setToolTip('Todo Gadget');
  const menu = Menu.buildFromTemplate([
    { label: '表示 / 非表示', click: toggleWindow },
    ...(isWin11 ? [{
      label: '背景（変更すると再起動）',
      submenu: [
        ['transparent', '透過ガラス（ぼかしなし・常に透ける）'],
        ['acrylic', 'アクリル（ぼかし・非アクティブ時は単色化）'],
        ['mica', 'マイカ（壁紙の色味）']
      ].map(([id, label]) => ({
        label,
        type: 'radio',
        checked: data.settings.material === id,
        click: () => {
          if (data.settings.material === id) return;
          data.settings.material = id;
          saveData(data);
          app.releaseSingleInstanceLock();
          app.relaunch();
          app.exit(0);
        }
      }))
    }] : []),
    {
      label: '常に最前面',
      type: 'checkbox',
      checked: !!data.settings.alwaysOnTop,
      click: (item) => setPin(item.checked)
    },
    {
      label: 'ログイン時に起動',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked })
    },
    { type: 'separator' },
    { label: '終了', click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
  tray.on('click', toggleWindow);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });

  app.whenReady().then(() => {
    data = loadData();
    if (!MATERIALS.includes(data.settings.material)) data.settings.material = 'acrylic';
    nativeBlur = isWin11 && data.settings.material !== 'transparent';
    createWindow();
    buildTray();

    ipcMain.handle('load', () => ({ ...data, env: { nativeBlur } }));
    ipcMain.on('save-todos', (_e, todos) => { data.todos = todos; scheduleSave(); });
    ipcMain.on('set-opacity', (_e, v) => { data.settings.opacity = v; scheduleSave(); });
    ipcMain.on('set-pin', (_e, on) => setPin(on));
    ipcMain.on('hide', () => win.hide());
    ipcMain.on('quit', () => app.quit());
  });

  app.on('before-quit', flushSave);

  app.on('window-all-closed', (e) => e.preventDefault());
}
