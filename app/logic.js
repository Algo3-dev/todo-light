// TODOの親子関係・先行関係に関する純粋なロジック（UIに依存しない）
(function (root) {
  const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const byId = (todos, id) => todos.find((t) => t.id === id);

  function normalize(list) {
    const items = (Array.isArray(list) ? list : []).map((t) => ({
      id: String(t.id),
      text: String(t.text || ''),
      done: !!t.done,
      parentId: t.parentId != null ? String(t.parentId) : null,
      after: Array.isArray(t.after) ? t.after.map(String) : [],
      collapsed: !!t.collapsed
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
    dependsOn, isBlocked, canMove, canLink, moveTask, linkTask, removeTask, toggleDone
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TodoLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
