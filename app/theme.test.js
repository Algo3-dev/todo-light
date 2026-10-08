const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('./theme.js');

// 相対輝度(WCAG)。文字色 #eaf4ff との可読性の目安に使う
const lum = ([r, g, b]) => {
  const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const isRgb = (a) => Array.isArray(a) && a.length === 3 && a.every((v) => Number.isInteger(v) && v >= 0 && v <= 255);

test('PALETTE: IDは一意で、色は0〜255の整数RGB、名前がある', () => {
  const ids = T.PALETTE.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(T.PALETTE.length >= 8);
  for (const p of T.PALETTE) {
    assert.ok(p.name);
    assert.ok(isRgb(p.top) && isRgb(p.bottom), p.id);
  }
});

test('PALETTE: 全色が暗色(明色の文字が読める)で、下側ほど暗い', () => {
  for (const p of T.PALETTE) {
    assert.ok(lum(p.top) < 0.08, p.id + ' top');
    assert.ok(lum(p.bottom) < lum(p.top), p.id + ' bottom darker');
  }
});

test('既定はネイビーで、従来の配色(22,28,46 / 10,12,24)と一致する', () => {
  assert.equal(T.DEFAULT_BASE, 'navy');
  const navy = T.PALETTE.find((p) => p.id === 'navy');
  assert.deepEqual(navy.top, [22, 28, 46]);
  assert.deepEqual(navy.bottom, [10, 12, 24]);
});

test('isValidBase: パレットIDと #rrggbb のみ有効', () => {
  assert.equal(T.isValidBase('navy'), true);
  assert.equal(T.isValidBase('#a1B2c3'), true);
  for (const bad of ['', 'nope', '#abc', '#12345', '#1234567', 'a1b2c3', null, undefined, 123, {}]) {
    assert.equal(T.isValidBase(bad), false, String(bad));
  }
});

test('deriveBase: 任意の色から、暗く読みやすい上下2色を作る', () => {
  for (const hex of ['#ffffff', '#000000', '#ff0000', '#ffff00', '#00ffff', '#808080', '#c0a020']) {
    const d = T.deriveBase(hex);
    assert.ok(isRgb(d.top) && isRgb(d.bottom), hex);
    assert.ok(lum(d.top) < 0.1, hex + ' 暗色に収まる');
    assert.ok(lum(d.bottom) <= lum(d.top), hex + ' 下側が暗い');
  }
});

test('deriveBase: 色相を保つ(赤系は赤成分が最大)', () => {
  const d = T.deriveBase('#ff2020');
  assert.ok(d.top[0] > d.top[1] && d.top[0] > d.top[2]);
});

test('deriveBase: 黒を選んでも真っ黒の一歩手前まで持ち上げる(最低限の明度)', () => {
  const d = T.deriveBase('#000000');
  assert.ok(Math.max(...d.top) >= 12);
});

test('resolveBase: IDも#hexも解決し、不正値は既定へ', () => {
  const navy = T.PALETTE.find((p) => p.id === 'navy');
  assert.deepEqual(T.resolveBase('wine'), { top: T.PALETTE.find((p) => p.id === 'wine').top, bottom: T.PALETTE.find((p) => p.id === 'wine').bottom });
  assert.deepEqual(T.resolveBase('#336699'), T.deriveBase('#336699'));
  assert.deepEqual(T.resolveBase('garbage'), { top: navy.top, bottom: navy.bottom });
  assert.deepEqual(T.resolveBase(undefined), { top: navy.top, bottom: navy.bottom });
});

test('cssTriple: rgba() に埋め込める "r, g, b" 形式', () => {
  assert.equal(T.cssTriple([22, 28, 46]), '22, 28, 46');
});

test('swatchGradient: パレット表示用の linear-gradient 文字列', () => {
  assert.match(T.swatchGradient('navy'), /^linear-gradient\(160deg, rgb\(22, 28, 46\), rgb\(10, 12, 24\)\)$/);
  assert.match(T.swatchGradient('#336699'), /^linear-gradient\(160deg, rgb\(\d+, \d+, \d+\), rgb\(\d+, \d+, \d+\)\)$/);
});

test('deriveBase: 色相の全区間(赤・黄・緑・水・青・紫)で、元の色相の成分が優位になる', () => {
  const dominant = {
    '#ff0000': (t) => t[0] > t[1] && t[0] > t[2],
    '#ffff00': (t) => t[0] > t[2] && t[1] > t[2] && Math.abs(t[0] - t[1]) <= 2,
    '#00ff00': (t) => t[1] > t[0] && t[1] > t[2],
    '#00ffff': (t) => t[1] > t[0] && t[2] > t[0] && Math.abs(t[1] - t[2]) <= 2,
    '#0000ff': (t) => t[2] > t[0] && t[2] > t[1],
    '#ff00ff': (t) => t[0] > t[1] && t[2] > t[1] && Math.abs(t[0] - t[2]) <= 2,
    '#ff0080': (t) => t[0] > t[2] && t[2] > t[1] // 赤紫寄り
  };
  for (const [hex, ok] of Object.entries(dominant)) {
    assert.ok(ok(T.deriveBase(hex).top), hex + ' ' + T.deriveBase(hex).top);
  }
});

test('deriveBase: 無彩色(グレー)は無彩色のまま', () => {
  const t = T.deriveBase('#808080').top;
  assert.equal(t[0], t[1]);
  assert.equal(t[1], t[2]);
});
