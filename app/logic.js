// TODOの親子関係・先行関係に関する純粋なロジック（UIに依存しない）
(function (root) {
  const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const byId = (todos, id) => todos.find((t) => t.id === id);

  /* ---------- 期限（日付のみ。その日の終わりが締切） ---------- */
  const DAY = 86400000;
  const DUE_HORIZON_DAYS = 7; // 期限のこの日数前から赤くなり始める

  // 'YYYY-MM-DD' を現地時間の0時の Date に。不正（存在しない日付含む）は null
  function parseDue(due) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof due === 'string' ? due : '');
    if (!m) return null;
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    const dt = new Date(y, mo - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? dt : null;
  }

  function dueEnd(due) {
    const d = parseDue(due);
    return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - 1 : NaN;
  }

  // 0（余裕）〜 1（期限切れ）。期限に近づくほど線形に増える
  function urgency(due, now = Date.now(), horizonDays = DUE_HORIZON_DAYS) {
    const end = dueEnd(due);
    if (Number.isNaN(end)) return 0;
    return Math.min(1, Math.max(0, 1 - (end - now) / (horizonDays * DAY)));
  }

  function dueLabel(due, now = Date.now()) {
    const d = parseDue(due);
    if (!d) return null;
    const n = new Date(now);
    const days = Math.round((d - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / DAY);
    if (days < 0) return { text: `${-days}日超過`, overdue: true };
    if (days === 0) return { text: '今日', overdue: false };
    if (days === 1) return { text: '明日', overdue: false };
    if (days < DUE_HORIZON_DAYS) return { text: `${days}日後`, overdue: false };
    return { text: `${d.getMonth() + 1}/${d.getDate()}`, overdue: false };
  }

  // 空文字・null は解除。不正な日付は拒否
  function setDue(todos, id, due) {
    const t = byId(todos, id);
    if (!t) return false;
    if (due == null || due === '') { t.due = null; return true; }
    if (!parseDue(due)) return false;
    t.due = due;
    return true;
  }

  /* ---------- タスク文(複数行可) ---------- */
  const TEXT_MAX = 1000;

  // 改行をLFに統一し、行末空白・前後の空行を除く。連続する空行は1つにまとめ、上限で切る
  function cleanText(s, max = TEXT_MAX) {
    if (typeof s !== 'string') return '';
    return s
      .replace(/\r\n?/g, '\n')
      .split('\n').map((l) => l.replace(/\s+$/, '')).join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, max);
  }

  /* ---------- リマインド(日時指定。'YYYY-MM-DDTHH:mm' の現地時刻) ---------- */
  const pad2 = (n) => String(n).padStart(2, '0');

  function parseRemind(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(typeof v === 'string' ? v : '');
    if (!m) return null;
    const [y, mo, d, h, mi] = m.slice(1).map(Number);
    const dt = new Date(y, mo - 1, d, h, mi);
    const ok = dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d &&
      dt.getHours() === h && dt.getMinutes() === mi;
    return ok ? dt : null;
  }

  function formatRemind(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function newTask(text, parentId = null) {
    return {
      id: uid(), text: cleanText(text), done: false, parentId, after: [], collapsed: false,
      due: null, remind: null, remindDone: false
    };
  }

  // 空文字・null は解除。設定し直すと未確認(鳴る前)に戻る。不正な日時は拒否
  function setRemind(todos, id, value) {
    const t = byId(todos, id);
    if (!t) return false;
    if (value == null || value === '') { t.remind = null; t.remindDone = false; return true; }
    if (!parseRemind(value)) return false;
    t.remind = value;
    t.remindDone = false;
    return true;
  }

  // none: 未設定・完了済み / pending: 時刻前 / ringing: 時刻を過ぎて未確認 / ack: 確認済み
  function remindState(t, now = Date.now()) {
    const d = parseRemind(t.remind);
    if (!d || t.done) return 'none';
    if (t.remindDone) return 'ack';
    return d.getTime() <= now ? 'ringing' : 'pending';
  }

  function ackRemind(todos, id) {
    const t = byId(todos, id);
    if (!t) return false;
    t.remindDone = true;
    return true;
  }

  function snoozeRemind(todos, id, minutes, now = Date.now()) {
    return setRemind(todos, id, formatRemind(now + minutes * 60000));
  }

  function remindLabel(v, now = Date.now()) {
    const d = parseRemind(v);
    if (!d) return null;
    const n = new Date(now);
    const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) -
      new Date(n.getFullYear(), n.getMonth(), n.getDate())) / DAY);
    const hm = `${d.getHours()}:${pad2(d.getMinutes())}`;
    if (days === 0) return `今日 ${hm}`;
    if (days === 1) return `明日 ${hm}`;
    return `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
  }

  // 素早く選ぶための候補。すでに過ぎた時刻は出さない
  function remindPresets(now = Date.now()) {
    const n = new Date(now);
    const list = [
      { label: '15分後', ms: now + 15 * 60000 },
      { label: '1時間後', ms: now + 60 * 60000 },
      { label: '今日 18:00', ms: new Date(n.getFullYear(), n.getMonth(), n.getDate(), 18, 0).getTime() },
      { label: '明日 9:00', ms: new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 9, 0).getTime() }
    ];
    return list.filter((p) => p.ms > now).map((p) => ({ label: p.label, value: formatRemind(p.ms) }));
  }

  function normalize(list) {
    const items = (Array.isArray(list) ? list : []).map((t) => ({
      id: String(t.id),
      text: String(t.text || ''),
      done: !!t.done,
      parentId: t.parentId != null ? String(t.parentId) : null,
      after: Array.isArray(t.after) ? t.after.map(String) : [],
      collapsed: !!t.collapsed,
      due: parseDue(t.due) ? String(t.due) : null,
      remind: parseRemind(t.remind) ? String(t.remind) : null,
      remindDone: !!t.remindDone && !!parseRemind(t.remind)
    }));
    const ids = new Set(items.map((t) => t.id));
    items.forEach((t) => {
      if (t.parentId && (!ids.has(t.parentId) || t.parentId === t.id)) t.parentId = null;
      t.after = [...new Set(t.after)].filter((p) => ids.has(p) && p !== t.id);
    });
    return flatten(items);
  }

  // 親→子の順に並べ直す（サブツリーが連続する配列になる）
  function flatten(todos) {
    const kids = new Map();
    todos.forEach((t) => {
      const k = t.parentId || null;
      if (!kids.has(k)) kids.set(k, []);
      kids.get(k).push(t);
    });
    const out = [];
    const seen = new Set();
    const walk = (p) => (kids.get(p) || []).forEach((t) => {
      if (seen.has(t.id)) return;
      seen.add(t.id);
      out.push(t);
      walk(t.id);
    });
    walk(null);
    // 親子ループなど異常データは根に戻す
    todos.forEach((t) => {
      if (!seen.has(t.id)) { t.parentId = null; seen.add(t.id); out.push(t); walk(t.id); }
    });
    return out;
  }

  function isDesc(todos, id, anc) {
    let c = byId(todos, id);
    let guard = 0;
    while (c && c.parentId && guard++ < 1000) {
      if (c.parentId === anc) return true;
      c = byId(todos, c.parentId);
    }
    return false;
  }

  const descendants = (todos, id) => todos.filter((t) => isDesc(todos, t.id, id));

  function depthOf(todos, t) {
    let d = 0;
    let c = t;
    while (c && c.parentId && d < 1000) { d++; c = byId(todos, c.parentId); }
    return d;
  }

  // a は b に（推移的に）依存しているか
  function dependsOn(todos, a, b, seen = new Set()) {
    const t = byId(todos, a);
    if (!t) return false;
    for (const p of t.after) {
      if (p === b) return true;
      if (!seen.has(p)) { seen.add(p); if (dependsOn(todos, p, b, seen)) return true; }
    }
    return false;
  }

  const isBlocked = (todos, t) =>
    t.after.some((p) => { const x = byId(todos, p); return x && !x.done; });

  // id を targetId の前/後/子に移動できるか（自分自身・自分の子孫へは不可）
  const canMove = (todos, id, targetId) =>
    id !== targetId && !isDesc(todos, targetId, id);

  // src を target の先行タスクにできるか（自己参照・重複・循環は不可）
  function canLink(todos, srcId, targetId) {
    const t = byId(todos, targetId);
    if (!t || srcId === targetId) return false;
    if (t.after.includes(srcId)) return false;
    return !dependsOn(todos, srcId, targetId);
  }

  // pos: 'before' | 'after' | 'child' | 'rootEnd'
  function moveTask(todos, id, targetId, pos) {
    const node = byId(todos, id);
    if (!node) return todos;
    if (pos !== 'rootEnd' && !canMove(todos, id, targetId)) return todos;
    const flat = flatten(todos);
    const subtree = new Set([id, ...descendants(flat, id).map((t) => t.id)]);
    const block = flat.filter((t) => subtree.has(t.id));
    const rest = flat.filter((t) => !subtree.has(t.id));
    let idx;
    if (pos === 'rootEnd') {
      node.parentId = null;
      idx = rest.length;
    } else {
      const target = byId(rest, targetId);
      if (!target) return todos;
      idx = rest.indexOf(target);
      if (pos === 'before') {
        node.parentId = target.parentId;
      } else {
        idx += 1;
        while (rest[idx] && isDesc(rest, rest[idx].id, targetId)) idx++;
        if (pos === 'child') { node.parentId = target.id; target.collapsed = false; }
        else node.parentId = target.parentId;
      }
    }
    rest.splice(idx, 0, ...block);
    return flatten(rest);
  }

  function linkTask(todos, srcId, targetId) {
    if (!canLink(todos, srcId, targetId)) return false;
    byId(todos, targetId).after.push(srcId);
    return true;
  }

  // 子は親の階層へ繰り上げ、他タスクの先行指定からも外す
  function removeTask(todos, id) {
    const t = byId(todos, id);
    if (!t) return todos;
    todos.forEach((c) => {
      if (c.parentId === id) c.parentId = t.parentId;
      c.after = c.after.filter((x) => x !== id);
    });
    return flatten(todos.filter((x) => x !== t));
  }

  // 先行タスクが未完了なら完了できない。親を完了すると子孫も完了にする。
  function toggleDone(todos, id) {
    const t = byId(todos, id);
    if (!t) return { ok: false };
    if (!t.done && isBlocked(todos, t)) return { ok: false, reason: 'blocked' };
    t.done = !t.done;
    if (t.done) descendants(todos, id).forEach((d) => { d.done = true; });
    return { ok: true };
  }

  const api = {
    uid, byId, normalize, flatten, isDesc, descendants, depthOf,
    dependsOn, isBlocked, canMove, canLink, moveTask, linkTask, removeTask, toggleDone,
    TEXT_MAX, cleanText, parseRemind, formatRemind, newTask, setRemind, remindState, ackRemind,
    snoozeRemind, remindLabel, remindPresets,DUE_HORIZON_DAYS, parseDue, dueEnd, urgency, dueLabel, setDue
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TodoLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
