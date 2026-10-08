// ベース背景色のパレットと色の導出（UIにも Electron にも依存しない純粋ロジック）
// パネル背景は「上側(明るめ)→下側(暗め)」の2色のグラデーション。文字色は明色固定なので暗色のみ扱う。
(function (root) {
  const PALETTE = [
    { id: 'navy', name: 'ネイビー', top: [22, 28, 46], bottom: [10, 12, 24] }, // 従来の配色
    { id: 'black', name: 'ブラック', top: [26, 26, 30], bottom: [7, 7, 9] },
    { id: 'slate', name: 'スレート', top: [38, 44, 54], bottom: [16, 20, 28] },
    { id: 'indigo', name: 'インディゴ', top: [34, 32, 80], bottom: [14, 12, 42] },
    { id: 'purple', name: 'パープル', top: [56, 28, 76], bottom: [26, 10, 42] },
    { id: 'wine', name: 'ワイン', top: [62, 24, 36], bottom: [30, 8, 16] },
    { id: 'cocoa', name: 'ココア', top: [54, 40, 30], bottom: [26, 18, 12] },
    { id: 'forest', name: 'フォレスト', top: [20, 48, 36], bottom: [8, 24, 18] },
    { id: 'teal', name: 'ティール', top: [16, 52, 56], bottom: [6, 26, 30] }
  ];
  const DEFAULT_BASE = 'navy';
  const HEX = /^#[0-9a-fA-F]{6}$/;

  const byId = (id) => PALETTE.find((p) => p.id === id);
  const isValidBase = (v) => typeof v === 'string' && (!!byId(v) || HEX.test(v));

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  function hexToHsl(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return [((h * 60) + 360) % 360, s, l];
  }

  function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
      : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [r, g, b].map((v) => Math.round((v + m) * 255));
  }

  // 任意の色から、色相を保ったまま暗く読みやすい上下2色を作る（明るい色を選んでも文字が読める）
  function deriveBase(hex) {
    const [h, s, l] = hexToHsl(hex);
    const topL = clamp(0.08 + l * 0.14, 0.09, 0.19);
    const topS = Math.min(s, 0.55);
    return {
      top: hslToRgb(h, topS, topL),
      bottom: hslToRgb(h, topS * 0.95, topL * 0.5)
    };
  }

  // パレットID または #rrggbb を {top, bottom} に。不正値は既定色
  function resolveBase(v) {
    if (typeof v === 'string' && HEX.test(v)) return deriveBase(v);
    const p = byId(v) || byId(DEFAULT_BASE);
    return { top: p.top, bottom: p.bottom };
  }

  const cssTriple = (rgb) => rgb.join(', ');

  function swatchGradient(v) {
    const { top, bottom } = resolveBase(v);
    return `linear-gradient(160deg, rgb(${cssTriple(top)}), rgb(${cssTriple(bottom)}))`;
  }

  const api = { PALETTE, DEFAULT_BASE, isValidBase, deriveBase, resolveBase, cssTriple, swatchGradient };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GadgetTheme = api;
})(typeof window !== 'undefined' ? window : globalThis);
