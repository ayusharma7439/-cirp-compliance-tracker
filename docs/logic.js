/* CIRP Tracker - pure logic (no DOM). Works in the browser (window.CIRP) and Node (module.exports). */
(function (root) {
  'use strict';
  var ISO = /^\d{4}-\d{2}-\d{2}$/;
  var STATUSES = ['Pending', 'In Progress', 'Completed', 'On Hold'];

  function p2(n) { return String(n).padStart(2, '0'); }
  function toISO(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function parse(s) { return new Date(s + 'T12:00:00'); } // local noon: immune to DST edges
  /** Returns the same string if it is a real calendar date (YYYY-MM-DD), else ''. */
  function okDate(s) {
    if (typeof s !== 'string' || !ISO.test(s)) return '';
    var d = parse(s);
    return isNaN(d) || toISO(d) !== s ? '' : s;
  }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + Number(n)); return toISO(d); }
  function diffDays(a, b) { return Math.round((parse(a) - parse(b)) / 864e5); } // a - b
  function isNum(v) { return v !== null && v !== undefined && v !== '' && !isNaN(Number(v)); }

  /** Merge the shipped register (seed) with the user's saved data (current or legacy format). */
  function mergeTasks(seed, saved, removed) {
    saved = Array.isArray(saved) ? saved : [];
    var gone = new Set((removed || []).map(Number));
    seed = seed.filter(function (s) { return !gone.has(Number(s.id)); });
    var byId = new Map(saved.map(function (t) { return [Number(t.id), t]; }));
    var seedIds = new Set(seed.map(function (s) { return Number(s.id); }).concat(Array.from(gone)));
    var out = seed.map(function (s) {
      var u = byId.get(Number(s.id)) || {};
      var hasAfter = Object.prototype.hasOwnProperty.call(u, 'after');
      return Object.assign({}, s, {
        id: Number(s.id),
        status: STATUSES.indexOf(u.status) >= 0 ? u.status : 'Pending',
        actual: okDate(u.actual),
        manualTarget: okDate(u.manualTarget),
        after: hasAfter ? (isNum(u.after) ? Number(u.after) : null) : (isNum(s.after) ? Number(s.after) : null),
        days: hasAfter && u.days !== undefined ? (isNum(u.days) ? Number(u.days) : null) : (isNum(s.days) ? Number(s.days) : null),
        notes: typeof u.notes === 'string' ? u.notes : '',
        custom: false
      });
    });
    saved.forEach(function (u) {
      var id = Number(u.id);
      if (!id || seedIds.has(id) || !u.title) return;
      var legacyDep = isNum(u.dependsOn) ? Number(u.dependsOn) : null;
      var after = Object.prototype.hasOwnProperty.call(u, 'after') ? (isNum(u.after) ? Number(u.after) : null) : legacyDep;
      out.push({
        id: id, title: String(u.title), rule: String(u.rule || 'Manual'),
        mandate: String(u.mandate || 'User-added milestone'), timeline: String(u.timeline || 'Manual date'), kind: 'Custom',
        status: STATUSES.indexOf(u.status) >= 0 ? u.status : 'Pending',
        actual: okDate(u.actual), manualTarget: okDate(u.manualTarget || u.target),
        after: after, days: isNum(u.days) ? Number(u.days) : (after !== null ? 0 : null),
        notes: typeof u.notes === 'string' ? u.notes : '', custom: true
      });
    });
    return out;
  }

  function context(tasks, commencement) {
    return { byId: new Map(tasks.map(function (t) { return [Number(t.id), t]; })), T: okDate(commencement) };
  }

  /** Effective due date of a task. basis: manual | actual | projected | model | outer | ''. */
  function due(ctx, t, seen) {
    seen = seen || new Set();
    if (t.manualTarget) return { date: t.manualTarget, basis: 'manual', outer: ctx.T && isNum(t.outer) ? addDays(ctx.T, t.outer) : '' };
    var outerDate = ctx.T && isNum(t.outer) ? addDays(ctx.T, Number(t.outer)) : '';
    var date = '', basis = '';
    if (isNum(t.after) && isNum(t.days) && !seen.has(t.id)) {
      seen.add(t.id);
      var par = ctx.byId.get(Number(t.after));
      if (par) {
        if (par.actual) { date = addDays(par.actual, t.days); basis = 'actual'; }
        else {
          var pi = due(ctx, par, seen);
          if (pi.date) { date = addDays(pi.date, t.days); basis = 'projected'; }
        }
      }
    }
    if (!date && ctx.T && isNum(t.offset)) { date = addDays(ctx.T, t.offset); basis = 'model'; }
    if (!date && outerDate) { date = outerDate; basis = 'outer'; }
    if (date && outerDate && date > outerDate) { date = outerDate; basis = 'outer'; } // statutory outer limits never slide
    return { date: date, basis: basis, outer: outerDate };
  }

  function remaining(ctx, t, check) { var d = due(ctx, t).date; return d ? diffDays(d, check) : null; }

  function lateness(ctx, t) { // days a performed task was late vs its due date (0 if on time / unknown)
    var d = due(ctx, t).date;
    return t.actual && d && t.actual > d ? diffDays(t.actual, d) : 0;
  }

  function urgency(ctx, t, check) {
    if (t.status === 'Completed') return lateness(ctx, t) ? ['Done late', 'p-amber'] : ['Completed', 'p-green'];
    if (t.status === 'On Hold') return ['On hold', 'p-blue'];
    var n = remaining(ctx, t, check);
    if (n === null) return ['Date needed', 'p-blue'];
    if (n < 0) return ['Overdue', 'p-red'];
    if (n === 0) return ['Due today', 'p-red'];
    if (n <= 3) return ['Immediate', 'p-red'];
    if (n <= 7) return ['High priority', 'p-amber'];
    if (n <= 15) return ['Upcoming', 'p-blue'];
    return ['On track', 'p-green'];
  }

  function stats(ctx, tasks, check, lead) {
    var done = tasks.filter(function (t) { return t.status === 'Completed'; }).length;
    var open = tasks.filter(function (t) { return t.status !== 'Completed'; });
    var s = { total: tasks.length, done: done, open: open.length, overdue: 0, soon: 0, week: 0 };
    open.forEach(function (t) {
      if (t.status === 'On Hold') return;
      var n = remaining(ctx, t, check);
      if (n === null) return;
      if (n <= 0) s.overdue++; else if (n <= lead) s.soon++; else if (n <= 7) s.week++;
    });
    return s;
  }

  function wouldCreateCycle(tasks, taskId, parentId) {
    var byId = new Map(tasks.map(function (t) { return [Number(t.id), t]; }));
    var cur = byId.get(Number(parentId)), seen = new Set();
    while (cur) {
      if (Number(cur.id) === Number(taskId) || seen.has(cur.id)) return true;
      seen.add(cur.id);
      cur = isNum(cur.after) ? byId.get(Number(cur.after)) : null;
    }
    return false;
  }

  function icsEscape(s) {
    return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }
  function fold(line) { // RFC 5545: lines max 75 octets; fold with CRLF + space
    var out = [], enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null, cur = '', len = 0;
    for (var ch of line) {
      var l = enc ? enc.encode(ch).length : 1;
      if (len + l > (out.length ? 74 : 75)) { out.push(cur); cur = ''; len = 0; }
      cur += ch; len += l;
    }
    out.push(cur);
    return out.join('\r\n ');
  }
  function stamp(now) { return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }

  function buildICS(tasks, ctx, opts) {
    opts = opts || {};
    var now = opts.now || new Date(), lead = Number(opts.lead || 3), cn = opts.caseName ? opts.caseName + ': ' : '';
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CIRP Compliance Tracker//EN', 'CALSCALE:GREGORIAN'];
    tasks.forEach(function (t) {
      if (t.status === 'Completed') return;
      var d = due(ctx, t).date;
      if (!d) return;
      var d0 = d.replace(/-/g, ''), d1 = addDays(d, 1).replace(/-/g, '');
      L.push('BEGIN:VEVENT', 'UID:cirp-' + t.id + '-' + d0 + '@compliance-tracker', 'DTSTAMP:' + stamp(now),
        'DTSTART;VALUE=DATE:' + d0, 'DTEND;VALUE=DATE:' + d1,
        'SUMMARY:' + icsEscape(cn + t.title), 'DESCRIPTION:' + icsEscape(t.rule + ' | ' + t.mandate),
        'BEGIN:VALARM', 'TRIGGER:-P' + lead + 'D', 'ACTION:DISPLAY', 'DESCRIPTION:Compliance deadline reminder', 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }

  /** Accept a current-format backup ({tasks:[...]}) or a legacy array of tasks. */
  function parseBackup(obj) {
    if (Array.isArray(obj)) return { tasks: obj };
    if (obj && Array.isArray(obj.tasks)) return obj;
    throw new Error('Not a CIRP tracker backup');
  }

  var api = { STATUSES: STATUSES, okDate: okDate, addDays: addDays, diffDays: diffDays, toISO: toISO, mergeTasks: mergeTasks,
    context: context, due: due, remaining: remaining, lateness: lateness, urgency: urgency, stats: stats,
    wouldCreateCycle: wouldCreateCycle, buildICS: buildICS, parseBackup: parseBackup, isNum: isNum };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CIRP = api;
})(typeof window !== 'undefined' ? window : globalThis);
