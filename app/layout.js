// ウィンドウの位置・サイズ計算（UIにも Electron にも依存しない純粋ロジック）
(function (root) {
  const MARGIN = 24;
  const MIN = { width: 300, height: 280 };
  const SIZES = {
    s: { width: 300, height: 380 },
    m: { width: 380, height: 560 },
    l: { width: 480, height: 760 }
  };
  // 角は「縦 + 横」の2文字: t=top, b=bottom, l=left, r=right
  const CORNERS = ['tl', 'tr', 'bl', 'br'];

  // グローバルショートカット（修飾キー + 下記キー）。Q E / Z C は画面の4隅と同じ並び
  const SHORTCUTS = {
    modifier: 'Control+Alt',
    corners: { tl: 'Q', tr: 'E', bl: 'Z', br: 'C' },
    sizes: { s: '1', m: '2', l: '3' },
    toggle: 'Space',
    collapse: 'M'
  };

  // 作業領域に収まるサイズへ（最小サイズは作業領域の範囲内で確保）
  function fitSize(size, wa, margin = MARGIN) {
    const fit = (v, avail, min, full) => Math.max(Math.min(v, avail - margin * 2), Math.min(min, full, v));
    return {
      width: fit(size.width, wa.width, MIN.width, wa.width),
      height: fit(size.height, wa.height, MIN.height, wa.height)
    };
  }

  function cornerBounds(wa, corner, size, margin = MARGIN) {
    const c = CORNERS.includes(corner) ? corner : 'tl';
    const { width, height } = fitSize(size, wa, margin);
    return {
      x: c[1] === 'l' ? wa.x + margin : wa.x + wa.width - width - margin,
      y: c[0] === 't' ? wa.y + margin : wa.y + wa.height - height - margin,
      width,
      height
    };
  }

  function detectCorner(b, wa, tol = 12) {
    return CORNERS.find((c) => {
      const t = cornerBounds(wa, c, b);
      return Math.abs(t.x - b.x) <= tol && Math.abs(t.y - b.y) <= tol;
    }) || null;
  }

  function detectSize(b, wa, tol = 4) {
    return Object.keys(SIZES).find((k) => {
      const s = fitSize(SIZES[k], wa);
      return Math.abs(s.width - b.width) <= tol && Math.abs(s.height - b.height) <= tol;
    }) || null;
  }

  function nearestCorner(b, wa) {
    const v = b.y + b.height / 2 < wa.y + wa.height / 2 ? 't' : 'b';
    const h = b.x + b.width / 2 < wa.x + wa.width / 2 ? 'l' : 'r';
    return v + h;
  }

  // 作業領域の内側に引き戻す（画面外に消えたウィンドウの救出用）
  function fitInside(b, wa) {
    const width = Math.min(b.width, wa.width);
    const height = Math.min(b.height, wa.height);
    const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
    return {
      x: clamp(b.x, wa.x, wa.x + wa.width - width),
      y: clamp(b.y, wa.y, wa.y + wa.height - height),
      width,
      height
    };
  }

  // タイトルバーだけ表示する高さ。ネイティブ背景は枠なし、透過ガラスは外周余白(10px×2)が付く
  const collapsedHeight = (native) => 52 + (native ? 0 : 22);

  // 最寄りの角を固定したまま任意サイズへ変える
  function resizeAnchoredTo(b, wa, size) {
    const { width, height } = fitSize(size, wa);
    const c = nearestCorner(b, wa);
    return fitInside({
      x: c[1] === 'l' ? b.x : b.x + b.width - width,
      y: c[0] === 't' ? b.y : b.y + b.height - height,
      width,
      height
    }, wa);
  }

  const resizeAnchored = (b, wa, sizeKey) => resizeAnchoredTo(b, wa, SIZES[sizeKey]);

  /* ---------- ショートカットの割り当て（他アプリと競合したら代替キーへ） ---------- */
  const SHORTCUT_IDS = [...CORNERS, ...Object.keys(SIZES), 'toggle', 'collapse'];

  const shortcutKeys = () => ({
    ...SHORTCUTS.corners, ...SHORTCUTS.sizes,
    toggle: SHORTCUTS.toggle, collapse: SHORTCUTS.collapse
  });

  // 通常キー → Shift 付き →（数字なら）テンキー の順に試す
  function shortcutCandidates(key) {
    const m = SHORTCUTS.modifier;
    return [`${m}+${key}`, `${m}+Shift+${key}`, ...(/^\d$/.test(key) ? [`${m}+num${key}`] : [])];
  }

  // tryRegister(id, accelerator) が true を返した最初の候補を採用。全滅なら null
  function resolveShortcuts(tryRegister) {
    const keys = shortcutKeys();
    const out = {};
    SHORTCUT_IDS.forEach((id) => {
      out[id] = shortcutCandidates(keys[id]).find((acc) => tryRegister(id, acc)) || null;
    });
    return out;
  }

  // 画面表示用。標準の修飾キー(Ctrl+Alt)は省く
  function shortcutLabel(acc) {
    if (!acc) return '–';
    return acc.replace(SHORTCUTS.modifier + '+', '').replace(/^num(\d)$/, 'Num$1');
  }

  const api = {
    MARGIN, MIN, SIZES, CORNERS, SHORTCUTS,
    fitSize, cornerBounds, detectCorner, detectSize, nearestCorner, fitInside,
    collapsedHeight, resizeAnchoredTo, resizeAnchored,
    SHORTCUT_IDS, shortcutCandidates, resolveShortcuts, shortcutLabel
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GadgetLayout = api;
})(typeof window !== 'undefined' ? window : globalThis);
