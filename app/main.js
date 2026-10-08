const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const Lay = require('./layout.js');

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
let collapsed = false; // タイトルバーだけ表示中
let expandedHeight = 0;
let tray = null;

function createWindow() {
  // 保存済み位置は、モニター構成が変わっても画面内へ引き戻す（見えなくなる事故の予防）
  const saved = data.settings.bounds;
  const b = saved
    ? Lay.fitInside(saved, screen.getDisplayMatching(saved).workArea)
    : Lay.cornerBounds(screen.getPrimaryDisplay().workArea, 'tr', Lay.SIZES.m);

  const glass = nativeBlur
    ? { backgroundMaterial: data.settings.material, backgroundColor: '#00000000', hasShadow: true }
    : process.platform === 'darwin'
      ? { transparent: true, vibrancy: 'under-window', backgroundColor: '#00000000', hasShadow: false }
      : { transparent: true, backgroundColor: '#00000000', hasShadow: false };

  win = new BrowserWindow({
    ...b,
    minWidth: Lay.MIN.width,
    minHeight: Lay.MIN.height,
    frame: false,
    resizable: true,
    maximizable: false, // ヘッダーのダブルクリックで最大化されるのを防ぐ
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
    const b = win.getBounds();
    if (collapsed) b.height = expandedHeight; // 折りたたみ中の高さは保存しない
    data.settings.bounds = b;
    scheduleSave();
  };
  let t;
  let u;
  const onBoundsChanged = () => {
    clearTimeout(t); t = setTimeout(persistBounds, 400);
    clearTimeout(u); u = setTimeout(sendLayout, 60);
  };
  win.on('move', onBoundsChanged);
  win.on('resize', onBoundsChanged);
}

/* ---------- 位置・サイズのプリセット ---------- */
const currentArea = () => screen.getDisplayMatching(win.getBounds()).workArea;

function layoutState() {
  const bounds = win.getBounds();
  const workArea = currentArea();
  return {
    bounds,
    workArea,
    corner: Lay.detectCorner(bounds, workArea),
    size: Lay.detectSize(bounds, workArea)
  };
}

function sendLayout() {
  if (win && !win.isDestroyed()) win.webContents.send('layout-changed', layoutState());
}

// 隠れていても・最小化されていても、操作したら必ず手前に出す
function reveal() {
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
}

// タイトルバーだけにする / 元に戻す（最寄りの角を固定。アプリは終了せず常駐のまま）
function setCollapsed(on) {
  if (!win || on === collapsed) return;
  reveal();
  const b = win.getBounds();
  const wa = currentArea();
  const h = Lay.collapsedHeight(nativeBlur);
  if (on) {
    expandedHeight = b.height;
    collapsed = true;
    win.setMinimumSize(Lay.MIN.width, h);
    win.setResizable(false);
    win.setBounds(Lay.resizeAnchoredTo(b, wa, { width: b.width, height: h }));
  } else {
    collapsed = false;
    win.setResizable(true);
    win.setMinimumSize(Lay.MIN.width, Lay.MIN.height);
    win.setBounds(Lay.resizeAnchoredTo(b, wa, { width: b.width, height: expandedHeight }));
  }
  win.webContents.send('collapsed-changed', collapsed);
  sendLayout();
}
const toggleCollapse = () => setCollapsed(!collapsed);

function snapTo(corner) {
  if (!win || !Lay.CORNERS.includes(corner)) return;
  reveal();
  win.setBounds(Lay.cornerBounds(currentArea(), corner, win.getBounds()));
  sendLayout();
}

function setSizePreset(key) {
  if (!win || !Lay.SIZES[key]) return;
  setCollapsed(false);
  reveal();
  win.setBounds(Lay.resizeAnchored(win.getBounds(), currentArea(), key));
  sendLayout();
}

// 実際に割り当たったキー（id → アクセラレータ。競合で全滅なら null）。画面・トレイの表示にも使う
let shortcutMap = {};

function registerShortcuts() {
  const handlers = { toggle: toggleWindow, collapse: toggleCollapse };
  Lay.CORNERS.forEach((c) => { handlers[c] = () => snapTo(c); });
  Object.keys(Lay.SIZES).forEach((k) => { handlers[k] = () => setSizePreset(k); });

  const tryRegister = (acc, fn) => {
    try { return globalShortcut.register(acc, fn); } catch { return false; }
  };
  // 他アプリと競合したキーは Shift 付き等の代替へ自動で切り替える
  shortcutMap = Lay.resolveShortcuts((id, acc) => tryRegister(acc, handlers[id]));

  // 数字キーのサイズ指定は、テンキーからも使えるようにする
  Object.keys(Lay.SIZES).forEach((k) => {
    const alias = `${Lay.SHORTCUTS.modifier}+num${Lay.SHORTCUTS.sizes[k]}`;
    if (shortcutMap[k] !== alias) tryRegister(alias, handlers[k]);
  });

  // 競合の調査用に結果を残す
  try {
    fs.writeFileSync(path.join(app.getPath('userData'), 'shortcuts.log'),
      JSON.stringify({ at: new Date().toISOString(), shortcuts: shortcutMap }, null, 2), 'utf8');
  } catch { /* ログ失敗は無視 */ }
}

// 背景素材の変更は再起動が必要。旧プロセスがキーを握ったまま新プロセスが起動すると
// ショートカットが全滅するので、再起動の前に必ず解除する
function setMaterial(id) {
  if (!isWin11 || !MATERIALS.includes(id) || data.settings.material === id) return;
  data.settings.material = id;
  saveData(data);
  globalShortcut.unregisterAll();
  app.releaseSingleInstanceLock();
  app.relaunch();
  app.exit(0);
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
  tray.setToolTip('TODO Light');
  const menu = Menu.buildFromTemplate([
    { label: '表示 / 非表示', accelerator: shortcutMap.toggle || undefined, registerAccelerator: false, click: toggleWindow },
    { label: 'タイトルバーだけにする / 戻す', accelerator: shortcutMap.collapse || undefined, registerAccelerator: false, click: toggleCollapse },
    {
      label: '位置',
      submenu: [['tl', '左上'], ['tr', '右上'], ['bl', '左下'], ['br', '右下']].map(([c, label]) => ({
        label,
        accelerator: shortcutMap[c] || undefined,
        registerAccelerator: false,
        click: () => snapTo(c)
      }))
    },
    {
      label: 'サイズ',
      submenu: [['s', '小'], ['m', '中'], ['l', '大']].map(([k, label]) => ({
        label,
        accelerator: shortcutMap[k] || undefined,
        registerAccelerator: false,
        click: () => setSizePreset(k)
      }))
    },
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
        click: () => setMaterial(id)
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
    registerShortcuts();
    buildTray(); // トレイのメニューに実際のキーを表示するため、登録の後

    ipcMain.handle('load', () => ({
      ...data,
      env: { nativeBlur, win11: isWin11, material: data.settings.material, shortcuts: shortcutMap }
    }));
    ipcMain.on('set-material', (_e, id) => setMaterial(id));
    ipcMain.handle('layout-state', () => layoutState());
    ipcMain.on('toggle-collapse', toggleCollapse);
    ipcMain.on('snap', (_e, corner) => snapTo(corner));
    ipcMain.on('size-preset', (_e, key) => setSizePreset(key));
    ipcMain.on('save-todos', (_e, todos) => { data.todos = todos; scheduleSave(); });
    ipcMain.on('set-opacity', (_e, v) => { data.settings.opacity = v; scheduleSave(); });
    ipcMain.on('set-pin', (_e, on) => setPin(on));
    ipcMain.on('hide', () => win.hide());
    ipcMain.on('quit', () => app.quit());
  });

  app.on('before-quit', flushSave);
  app.on('will-quit', () => globalShortcut.unregisterAll());

  app.on('window-all-closed', (e) => e.preventDefault());
}
