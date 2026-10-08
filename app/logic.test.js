const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

const mk = (id, extra = {}) => ({
  id, text: id, done: false, parentId: null, after: [], collapsed: false, ...extra
});
const ids = (todos) => todos.map((t) => t.id);

test('uid: t から始まり重複しない', () => {
  const a = L.uid();
  const b = L.uid();
  assert.match(a, /^t/);
  assert.notEqual(a, b);
});

test('normalize: 非配列は空配列', () => {
  assert.deepEqual(L.normalize(null), []);
  assert.deepEqual(L.normalize(undefined), []);
});

test('normalize: 欠損フィールドを補完し型を揃える', () => {
  const [t] = L.normalize([{ id: 1 }]);
  assert.deepEqual(t, {
    id: '1', text: '', done: false, parentId: null, after: [], collapsed: false
  });
});

test('normalize: 存在しない親・自己親は根に戻す', () => {
  const r = L.normalize([mk('a', { parentId: 'zzz' }), mk('b', { parentId: 'b' })]);
  assert.equal(L.byId(r, 'a').parentId, null);
  assert.equal(L.byId(r, 'b').parentId, null);
});

test('normalize: after は重複・不明ID・自己参照を除く', () => {
  const r = L.normalize([mk('a', { after: ['b', 'b', 'x', 'a'] }), mk('b')]);
  assert.deepEqual(L.byId(r, 'a').after, ['b']);
});

test('normalize: 親子ループは根に戻して全件残す', () => {
  const r = L.normalize([mk('a', { parentId: 'b' }), mk('b', { parentId: 'a' })]);
  assert.equal(r.length, 2);
  assert.ok(r.some((t) => t.parentId === null));
});

test('flatten: 親の直後に子が連続する並びになる', () => {
  const r = L.flatten([mk('a'), mk('c', { parentId: 'a' }), mk('b'), mk('d', { parentId: 'a' })]);
  assert.deepEqual(ids(r), ['a', 'c', 'd', 'b']);
});

test('isDesc / descendants / depthOf', () => {
  const todos = [mk('a'), mk('b', { parentId: 'a' }), mk('c', { parentId: 'b' }), mk('d')];
  assert.equal(L.isDesc(todos, 'c', 'a'), true);
  assert.equal(L.isDesc(todos, 'a', 'c'), false);
  assert.equal(L.isDesc(todos, 'd', 'a'), false);
  assert.deepEqual(ids(L.descendants(todos, 'a')), ['b', 'c']);
  assert.equal(L.depthOf(todos, L.byId(todos, 'c')), 2);
  assert.equal(L.depthOf(todos, L.byId(todos, 'a')), 0);
});

test('dependsOn: 推移的な依存を検出する', () => {
  const todos = [mk('a'), mk('b', { after: ['a'] }), mk('c', { after: ['b'] })];
  assert.equal(L.dependsOn(todos, 'c', 'a'), true);
  assert.equal(L.dependsOn(todos, 'a', 'c'), false);
  assert.equal(L.dependsOn(todos, 'nope', 'a'), false);
});

test('dependsOn: 循環データでも停止する', () => {
  const todos = [mk('a', { after: ['b'] }), mk('b', { after: ['a'] }), mk('c')];
  assert.equal(L.dependsOn(todos, 'a', 'c'), false);
});

test('isBlocked: 未完了の先行がある間だけ true', () => {
  const todos = [mk('a'), mk('b', { after: ['a'] })];
  const b = L.byId(todos, 'b');
  assert.equal(L.isBlocked(todos, b), true);
  L.byId(todos, 'a').done = true;
  assert.equal(L.isBlocked(todos, b), false);
});

test('canMove: 自分自身・自分の子孫へは不可', () => {
  const todos = [mk('a'), mk('b', { parentId: 'a' }), mk('c')];
  assert.equal(L.canMove(todos, 'a', 'a'), false);
  assert.equal(L.canMove(todos, 'a', 'b'), false);
  assert.equal(L.canMove(todos, 'b', 'c'), true);
});

test('canLink: 自己参照・重複・循環・不明IDは不可', () => {
  const todos = [mk('a'), mk('b', { after: ['a'] })];
  assert.equal(L.canLink(todos, 'a', 'a'), false);
  assert.equal(L.canLink(todos, 'a', 'b'), false); // 重複
  assert.equal(L.canLink(todos, 'b', 'a'), false); // 循環
  assert.equal(L.canLink(todos, 'a', 'zzz'), false);
  assert.equal(L.canLink([mk('a'), mk('c')], 'a', 'c'), true);
});

test('linkTask: 成功時は after に追加、失敗時は false', () => {
  const todos = [mk('a'), mk('b')];
  assert.equal(L.linkTask(todos, 'a', 'b'), true);
  assert.deepEqual(L.byId(todos, 'b').after, ['a']);
  assert.equal(L.linkTask(todos, 'b', 'a'), false);
});

test('moveTask before: 同じ階層で対象の前へ', () => {
  const r = L.moveTask([mk('a'), mk('b'), mk('c')], 'c', 'a', 'before');
  assert.deepEqual(ids(r), ['c', 'a', 'b']);
});

test('moveTask after: 対象の子孫の後ろへ置く', () => {
  const todos = [mk('a'), mk('a1', { parentId: 'a' }), mk('b'), mk('c')];
  const r = L.moveTask(todos, 'c', 'a', 'after');
  assert.deepEqual(ids(r), ['a', 'a1', 'c', 'b']);
  assert.equal(L.byId(r, 'c').parentId, null);
});

test('moveTask child: 対象の子になり折りたたみを解除する', () => {
  const todos = [mk('a', { collapsed: true }), mk('b')];
  const r = L.moveTask(todos, 'b', 'a', 'child');
  assert.equal(L.byId(r, 'b').parentId, 'a');
  assert.equal(L.byId(r, 'a').collapsed, false);
});

test('moveTask: サブツリーごと移動する', () => {
  const todos = [mk('a'), mk('a1', { parentId: 'a' }), mk('b')];
  const r = L.moveTask(todos, 'a', 'b', 'after');
  assert.deepEqual(ids(r), ['b', 'a', 'a1']);
});

test('moveTask rootEnd: 最上位の末尾へ', () => {
  const todos = [mk('a'), mk('a1', { parentId: 'a' }), mk('b')];
  const r = L.moveTask(todos, 'a1', null, 'rootEnd');
  assert.deepEqual(ids(r), ['a', 'b', 'a1']);
  assert.equal(L.byId(r, 'a1').parentId, null);
});

test('moveTask: 子孫への移動・不明IDは変更なし', () => {
  const todos = [mk('a'), mk('b', { parentId: 'a' })];
  assert.equal(L.moveTask(todos, 'a', 'b', 'child'), todos);
  assert.equal(L.moveTask(todos, 'zzz', 'a', 'before'), todos);
  assert.equal(L.moveTask(todos, 'a', 'zzz', 'before'), todos);
});

test('removeTask: 子は一つ上の階層へ、先行指定からも外れる', () => {
  const todos = [
    mk('a'), mk('b', { parentId: 'a' }), mk('c', { parentId: 'b' }),
    mk('d', { after: ['b'] })
  ];
  const r = L.removeTask(todos, 'b');
  assert.deepEqual(ids(r), ['a', 'c', 'd']);
  assert.equal(L.byId(r, 'c').parentId, 'a');
  assert.deepEqual(L.byId(r, 'd').after, []);
});

test('removeTask: 不明IDは変更なし', () => {
  const todos = [mk('a')];
  assert.equal(L.removeTask(todos, 'zzz'), todos);
});

test('toggleDone: ブロック中は完了できない', () => {
  const todos = [mk('a'), mk('b', { after: ['a'] })];
  assert.deepEqual(L.toggleDone(todos, 'b'), { ok: false, reason: 'blocked' });
  assert.equal(L.byId(todos, 'b').done, false);
});

test('toggleDone: 先行完了後は完了でき、再度押すと未完了に戻る', () => {
  const todos = [mk('a', { done: true }), mk('b', { after: ['a'] })];
  assert.deepEqual(L.toggleDone(todos, 'b'), { ok: true });
  assert.equal(L.byId(todos, 'b').done, true);
  L.toggleDone(todos, 'b');
  assert.equal(L.byId(todos, 'b').done, false);
});

test('toggleDone: 親を完了にすると子孫も完了', () => {
  const todos = [mk('a'), mk('b', { parentId: 'a' }), mk('c', { parentId: 'b' })];
  L.toggleDone(todos, 'a');
  assert.ok(todos.every((t) => t.done));
});

test('toggleDone: 不明IDは ok:false', () => {
  assert.deepEqual(L.toggleDone([], 'x'), { ok: false });
});
