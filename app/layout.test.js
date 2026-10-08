const test = require('node:test');
const assert = require('node:assert/strict');
const Lay = require('./layout.js');

const WA = { x: 0, y: 0, width: 1920, height: 1040 };
const M = Lay.MARGIN;
const size = (k) => Lay.SIZES[k];

test('SIZES: 小 < 中 < 大 で、最小サイズ以上', () => {
  const { s, m, l } = Lay.SIZES;
  assert.ok(s.width < m.width && m.width < l.width);
  assert.ok(s.height < m.height && m.height < l.height);
  assert.ok(s.width >= Lay.MIN.width && s.height >= Lay.MIN.height);
});

test('fitSize: 作業領域に収まるよう縮め、最小サイズは割らない', () => {
  assert.deepEqual(Lay.fitSize(size('m'), WA), size('m'));
  const small = Lay.fitSize(size('l'), { x: 0, y: 0, width: 600, height: 600 });
  assert.equal(small.width, size('l').width); // 幅は収まるので縮めない
  assert.equal(small.height, 600 - M * 2);
  const tiny = Lay.fitSize(size('m'), { x: 0, y: 0, width: 320, height: 300 });
  assert.equal(tiny.width, Lay.MIN.width); // 余白を削っても最小サイズは確保
  assert.equal(tiny.height, Lay.MIN.height);
  const smaller = Lay.fitSize(size('m'), { x: 0, y: 0, width: 250, height: 200 });
  assert.deepEqual(smaller, { width: 250, height: 200 }); // 最小サイズより小さい作業領域なら領域いっぱい
});

test('cornerBounds: 4隅に余白付きで配置する', () => {
  const s = size('m');
  assert.deepEqual(Lay.cornerBounds(WA, 'tl', s), { x: M, y: M, ...s });
  assert.deepEqual(Lay.cornerBounds(WA, 'tr', s), { x: 1920 - s.width - M, y: M, ...s });
  assert.deepEqual(Lay.cornerBounds(WA, 'bl', s), { x: M, y: 1040 - s.height - M, ...s });
  assert.deepEqual(Lay.cornerBounds(WA, 'br', s), {
    x: 1920 - s.width - M, y: 1040 - s.height - M, ...s
  });
});

test('cornerBounds: 作業領域のオフセット(セカンダリ画面・タスクバー)を反映する', () => {
  const wa = { x: -1920, y: 40, width: 1920, height: 1000 };
  const b = Lay.cornerBounds(wa, 'tl', size('s'));
  assert.equal(b.x, -1920 + M);
  assert.equal(b.y, 40 + M);
});

test('cornerBounds: 大きすぎるサイズは作業領域に収める', () => {
  const wa = { x: 0, y: 0, width: 800, height: 600 };
  const b = Lay.cornerBounds(wa, 'br', size('l'));
  assert.equal(b.x + b.width, 800 - M);
  assert.equal(b.y + b.height, 600 - M);
});

test('cornerBounds: 不正な角は左上扱い', () => {
  assert.deepEqual(Lay.cornerBounds(WA, 'xx', size('s')), Lay.cornerBounds(WA, 'tl', size('s')));
});

test('detectCorner: 隅に居れば角を返し、離れていれば null', () => {
  for (const c of Lay.CORNERS) {
    assert.equal(Lay.detectCorner(Lay.cornerBounds(WA, c, size('m')), WA), c);
  }
  const moved = { ...Lay.cornerBounds(WA, 'tl', size('m')), x: 300 };
  assert.equal(Lay.detectCorner(moved, WA), null);
});

test('detectCorner: 数pxの誤差は許容する', () => {
  const b = Lay.cornerBounds(WA, 'br', size('m'));
  assert.equal(Lay.detectCorner({ ...b, x: b.x + 5, y: b.y - 5 }, WA), 'br');
});

test('detectSize: 大中小を判定し、手動リサイズなら null', () => {
  for (const k of ['s', 'm', 'l']) {
    assert.equal(Lay.detectSize({ x: 0, y: 0, ...size(k) }, WA), k);
  }
  assert.equal(Lay.detectSize({ x: 0, y: 0, width: 341, height: 500 }, WA), null);
});

test('nearestCorner: ウィンドウ中心の象限で決まる', () => {
  assert.equal(Lay.nearestCorner({ x: 10, y: 10, width: 300, height: 300 }, WA), 'tl');
  assert.equal(Lay.nearestCorner({ x: 1500, y: 10, width: 300, height: 300 }, WA), 'tr');
  assert.equal(Lay.nearestCorner({ x: 10, y: 800, width: 300, height: 200 }, WA), 'bl');
  assert.equal(Lay.nearestCorner({ x: 1500, y: 800, width: 300, height: 200 }, WA), 'br');
});

test('resizeAnchored: 最寄りの角を固定したままサイズ変更する', () => {
  const tl = Lay.cornerBounds(WA, 'tl', size('m'));
  const big = Lay.resizeAnchored(tl, WA, 'l');
  assert.deepEqual(big, { x: tl.x, y: tl.y, ...size('l') });

  const br = Lay.cornerBounds(WA, 'br', size('m'));
  const small = Lay.resizeAnchored(br, WA, 's');
  assert.equal(small.x + small.width, br.x + br.width);
  assert.equal(small.y + small.height, br.y + br.height);
  assert.deepEqual([small.width, small.height], [size('s').width, size('s').height]);
});

test('resizeAnchored: 拡大で画面外にはみ出す場合は引き戻す', () => {
  const nearEdge = { x: 1700, y: 900, ...size('s') };
  const r = Lay.resizeAnchored(nearEdge, WA, 'l');
  assert.ok(r.x >= 0 && r.x + r.width <= WA.width);
  assert.ok(r.y >= 0 && r.y + r.height <= WA.height);
});

test('fitInside: 画面外のウィンドウを作業領域へ戻す', () => {
  const lost = { x: 5000, y: -400, width: 380, height: 560 };
  const r = Lay.fitInside(lost, WA);
  assert.deepEqual(r, { x: 1920 - 380, y: 0, width: 380, height: 560 });
});

test('fitInside: 既に収まっていれば変更しない', () => {
  const ok = { x: 100, y: 100, width: 380, height: 560 };
  assert.deepEqual(Lay.fitInside(ok, WA), ok);
});

test('fitInside: 作業領域より大きければ縮める', () => {
  const r = Lay.fitInside({ x: 0, y: 0, width: 4000, height: 3000 }, WA);
  assert.equal(r.width, 1920);
  assert.equal(r.height, 1040);
});

test('SHORTCUTS: 全アクションにキーが割り当てられ、重複しない', () => {
  const keys = [
    ...Object.values(Lay.SHORTCUTS.corners),
    ...Object.values(Lay.SHORTCUTS.sizes),
    Lay.SHORTCUTS.toggle
  ];
  assert.equal(new Set(keys).size, keys.length);
  for (const c of Lay.CORNERS) assert.ok(Lay.SHORTCUTS.corners[c]);
  for (const k of Object.keys(Lay.SIZES)) assert.ok(Lay.SHORTCUTS.sizes[k]);
});
