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
    id: '1', text: '', done: false, parentId: null, after: [], collapsed: false, due: null,
    remind: null, remindDone: false
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

/* ---------- 期限 ---------- */
const at = (y, mo, d, h = 12, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

test('normalize: due は YYYY-MM-DD のみ受け付け、不正値は null', () => {
  const r = L.normalize([
    mk('a', { due: '2026-10-08' }), mk('b', { due: '2026-02-30' }),
    mk('c', { due: 'tomorrow' }), mk('d', { due: 20261008 }), mk('e')
  ]);
  assert.deepEqual(r.map((t) => t.due), ['2026-10-08', null, null, null, null]);
});

test('dueEnd: 期限日の終わり(23:59:59.999)。不正値は NaN', () => {
  assert.equal(L.dueEnd('2026-10-08'), new Date(2026, 9, 8, 23, 59, 59, 999).getTime());
  assert.ok(Number.isNaN(L.dueEnd(null)));
  assert.ok(Number.isNaN(L.dueEnd('2026-13-01')));
});

test('urgency: 7日より先は0、近づくほど増え、期限切れは1', () => {
  assert.equal(L.urgency('2026-10-20', at(2026, 10, 8)), 0);
  assert.equal(L.urgency('2026-10-15', at(2026, 10, 8)), 0); // ちょうど7日以上先
  const d4 = L.urgency('2026-10-12', at(2026, 10, 8));
  const d1 = L.urgency('2026-10-09', at(2026, 10, 8));
  const d0 = L.urgency('2026-10-08', at(2026, 10, 8));
  assert.ok(d4 > 0 && d4 < d1 && d1 < d0 && d0 < 1);
  assert.equal(L.urgency('2026-10-07', at(2026, 10, 8)), 1);
});

test('urgency: 期限なし・不正値は0', () => {
  assert.equal(L.urgency(null, at(2026, 10, 8)), 0);
  assert.equal(L.urgency('xxx', at(2026, 10, 8)), 0);
});

test('dueLabel: 今日・明日・N日後・日付・N日超過', () => {
  const now = at(2026, 10, 8, 15);
  assert.deepEqual(L.dueLabel('2026-10-08', now), { text: '今日', overdue: false });
  assert.deepEqual(L.dueLabel('2026-10-09', now), { text: '明日', overdue: false });
  assert.deepEqual(L.dueLabel('2026-10-12', now), { text: '4日後', overdue: false });
  assert.deepEqual(L.dueLabel('2026-10-20', now), { text: '10/20', overdue: false });
  assert.deepEqual(L.dueLabel('2026-10-06', now), { text: '2日超過', overdue: true });
  assert.equal(L.dueLabel(null, now), null);
});

test('setDue: 設定・解除ができ、不正値や不明IDは拒否', () => {
  const todos = [mk('a')];
  assert.equal(L.setDue(todos, 'a', '2026-10-08'), true);
  assert.equal(L.byId(todos, 'a').due, '2026-10-08');
  assert.equal(L.setDue(todos, 'a', 'bad'), false);
  assert.equal(L.byId(todos, 'a').due, '2026-10-08');
  assert.equal(L.setDue(todos, 'a', ''), true);
  assert.equal(L.byId(todos, 'a').due, null);
  assert.equal(L.setDue(todos, 'zzz', '2026-10-08'), false);
});

test('cleanText: 改行コードをLFに統一し前後の空白・空行を除く', () => {
  assert.equal(L.cleanText('  a\r\nb\rc  '), 'a\nb\nc');
  assert.equal(L.cleanText('\n\n a \n\n'), 'a');
});

test('cleanText: 各行の行末空白を除き、連続する空行は1つにまとめる', () => {
  assert.equal(L.cleanText('a  \n\n\n\nb'), 'a\n\nb');
});

test('cleanText: 空・非文字列は空文字、上限を超えたら切り詰める', () => {
  assert.equal(L.cleanText(null), '');
  assert.equal(L.cleanText('   '), '');
  assert.equal(L.cleanText('abcdef', 3), 'abc');
  assert.equal(L.TEXT_MAX, 1000);
});

/* ---------- リマインド ---------- */
const ts = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

test('parseRemind: 正しい日時のみ Date、不正・存在しない日時は null', () => {
  assert.equal(L.parseRemind('2026-10-08T09:30').getTime(), ts(2026, 10, 8, 9, 30));
  assert.equal(L.parseRemind('2026-02-30T09:30'), null);
  assert.equal(L.parseRemind('2026-10-08T25:00'), null);
  assert.equal(L.parseRemind('2026-10-08'), null);
  assert.equal(L.parseRemind(null), null);
});

test('formatRemind: ローカル時刻を YYYY-MM-DDTHH:mm にする(0埋め)', () => {
  assert.equal(L.formatRemind(ts(2026, 1, 2, 3, 4)), '2026-01-02T03:04');
});

test('newTask: 全フィールドを持つ。文は cleanText を通す', () => {
  const t = L.newTask('  hi \r\n', 'p1');
  assert.match(t.id, /^t/);
  assert.deepEqual({ ...t, id: 'x' }, {
    id: 'x', text: 'hi', done: false, parentId: 'p1', after: [], collapsed: false,
    due: null, remind: null, remindDone: false
  });
  assert.equal(L.newTask('a').parentId, null);
});

test('normalize: remind / remindDone を保持し、不正な remind は捨てる', () => {
  const [a, b] = L.normalize([
    { id: 'a', remind: '2026-10-08T09:30', remindDone: 1 },
    { id: 'b', remind: 'bad', remindDone: true }
  ]);
  assert.equal(a.remind, '2026-10-08T09:30');
  assert.equal(a.remindDone, true);
  assert.equal(b.remind, null);
  assert.equal(b.remindDone, false);
});

test('setRemind: 設定すると未確認に戻る。空は解除、不正は拒否', () => {
  const todos = [mk('a', { remind: null, remindDone: true })];
  assert.equal(L.setRemind(todos, 'a', '2026-10-08T09:30'), true);
  assert.equal(todos[0].remind, '2026-10-08T09:30');
  assert.equal(todos[0].remindDone, false);
  assert.equal(L.setRemind(todos, 'a', 'bad'), false);
  assert.equal(todos[0].remind, '2026-10-08T09:30');
  assert.equal(L.setRemind(todos, 'a', ''), true);
  assert.equal(todos[0].remind, null);
  assert.equal(L.setRemind(todos, 'zzz', ''), false);
});

test('remindState: none / pending / ringing / ack、完了済みは none', () => {
  const now = ts(2026, 10, 8, 10, 0);
  const t = (extra) => mk('a', { remind: null, remindDone: false, ...extra });
  assert.equal(L.remindState(t(), now), 'none');
  assert.equal(L.remindState(t({ remind: '2026-10-08T10:30' }), now), 'pending');
  assert.equal(L.remindState(t({ remind: '2026-10-08T10:00' }), now), 'ringing');
  assert.equal(L.remindState(t({ remind: '2026-10-08T09:00' }), now), 'ringing');
  assert.equal(L.remindState(t({ remind: '2026-10-08T09:00', remindDone: true }), now), 'ack');
  assert.equal(L.remindState(t({ remind: '2026-10-08T09:00', done: true }), now), 'none');
});

test('ackRemind / snoozeRemind: 確認で止まり、スヌーズで N 分後に再設定', () => {
  const now = ts(2026, 10, 8, 23, 50);
  const todos = [mk('a', { remind: '2026-10-08T23:00', remindDone: false })];
  L.ackRemind(todos, 'a');
  assert.equal(todos[0].remindDone, true);
  assert.equal(L.snoozeRemind(todos, 'a', 20, now), true);
  assert.equal(todos[0].remind, '2026-10-09T00:10');
  assert.equal(todos[0].remindDone, false);
  assert.equal(L.snoozeRemind(todos, 'zzz', 5, now), false);
});

test('remindLabel: 今日 / 明日 / それ以外は M/D', () => {
  const now = ts(2026, 10, 8, 10, 0);
  assert.equal(L.remindLabel('2026-10-08T15:05', now), '今日 15:05');
  assert.equal(L.remindLabel('2026-10-09T09:00', now), '明日 9:00');
  assert.equal(L.remindLabel('2026-10-20T09:00', now), '10/20 9:00');
  assert.equal(L.remindLabel('2026-10-07T09:00', now), '10/7 9:00');
  assert.equal(L.remindLabel('bad', now), null);
});

test('remindPresets: 過ぎた時刻の候補は出さない', () => {
  const am = L.remindPresets(ts(2026, 10, 8, 10, 0)).map((p) => p.value);
  assert.deepEqual(am, ['2026-10-08T10:15', '2026-10-08T11:00', '2026-10-08T18:00', '2026-10-09T09:00']);
  const pm = L.remindPresets(ts(2026, 10, 8, 19, 0)).map((p) => p.value);
  assert.deepEqual(pm, ['2026-10-08T19:15', '2026-10-08T20:00', '2026-10-09T09:00']);
});
