/* CIRP Compliance Command Centre - UI layer. Pure logic lives in logic.js (window.CIRP). */
(function () {
  'use strict';
  var C = window.CIRP;
  var LS = 'cirpTrackerV3', LS_OLD = 'cirpTrackerV2';
  var $ = function (id) { return document.getElementById(id); };

  var SEED = [];
  var S = { caseName: '', commencement: '', lead: 3, checkDate: '', apiUrl: '', apiKey: '', autoSync: '1',
            heroOn: null, rev: 0, dirty: false, removed: [], tasks: [] };
  var filter = 'all', editingId = null, syncTimer = null, syncing = false;

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function today() { return C.toISO(new Date()); }
  function fmt(s) {
    if (!s) return '';
    return new Date(s + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function toast(msg) {
    var el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
    $('toasts').appendChild(el); setTimeout(function () { el.remove(); }, 4200);
  }
  function check() { return C.okDate(S.checkDate) || today(); }
  function ctx() { return C.context(S.tasks, S.commencement); }

  /* ---------- persistence ---------- */
  function seedById() { return new Map(SEED.map(function (s) { return [Number(s.id), s]; })); }
  function slim(t, sb) {
    var s = sb.get(Number(t.id));
    if (!s) return { id: t.id, title: t.title, rule: t.rule, mandate: t.mandate, timeline: t.timeline, status: t.status, actual: t.actual,
                     manualTarget: t.manualTarget, after: t.after, days: t.days, notes: t.notes, custom: true };
    var o = { id: t.id, status: t.status, actual: t.actual, manualTarget: t.manualTarget, notes: t.notes };
    var sa = C.isNum(s.after) ? Number(s.after) : null, sd = C.isNum(s.days) ? Number(s.days) : null;
    if (t.after !== sa || t.days !== sd) { o.after = t.after; o.days = t.days; }
    return o;
  }
  function exportTasks(withDue) {
    var sb = seedById(), c = ctx();
    return S.tasks.map(function (t) {
      var o = slim(t, sb);
      if (withDue) { o.title = t.title; o.rule = t.rule; o.due = C.due(c, t).date || ''; }
      return o;
    });
  }
  function exportState() {
    return { case: S.caseName, commencement: S.commencement, lead: S.lead, removed: S.removed, tasks: exportTasks(true) };
  }
  function persist() {
    try {
      localStorage.setItem(LS, JSON.stringify({ v: 3, caseName: S.caseName, commencement: S.commencement, lead: S.lead,
        apiUrl: S.apiUrl, apiKey: S.apiKey, autoSync: S.autoSync, heroOn: S.heroOn, rev: S.rev, dirty: S.dirty,
        removed: S.removed, tasks: exportTasks(false) }));
    } catch (e) { toast('Browser storage is unavailable or full. Download a backup to keep your changes.'); }
  }
  function save() { S.dirty = true; persist(); scheduleSync(); }
  function loadLocal() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { raw = null; }
    if (raw && raw.v === 3) return raw;
    try { // migrate V2 (an array of tasks)
      var old = JSON.parse(localStorage.getItem(LS_OLD) || 'null');
      if (Array.isArray(old)) return { v: 3, tasks: old, migrated: true };
    } catch (e) { /* ignore */ }
    return null;
  }

  /* ---------- rendering ---------- */
  var BASIS = { manual: 'Manual date', actual: 'From performed date of linked step', projected: 'Projected — linked step not performed yet' };

  function render() {
    var c = ctx(), chk = check(), q = $('search').value.trim().toLowerCase();
    var rows = S.tasks.filter(function (t) {
      var u = C.urgency(c, t, chk)[0];
      var match = !q || (t.title + ' ' + t.rule + ' ' + t.mandate + ' ' + (t.notes || '')).toLowerCase().indexOf(q) >= 0;
      var ok = filter === 'all' || (filter === 'urgent' && ['Overdue', 'Due today', 'Immediate', 'High priority'].indexOf(u) >= 0) ||
        (filter === 'open' && t.status !== 'Completed') || (filter === 'done' && t.status === 'Completed');
      return match && ok;
    });
    $('tbody').innerHTML = rows.map(function (t) { return rowHtml(t, c, chk); }).join('') ||
      '<tr><td colspan="7" class="muted" style="padding:28px;text-align:center">No milestones match these filters.</td></tr>';

    var st = C.stats(c, S.tasks, chk, S.lead);
    $('percent').textContent = Math.round(st.done / (st.total || 1) * 100) + '%';
    $('progress').style.width = (st.done / (st.total || 1) * 100) + '%';
    $('doneCount').textContent = st.done + ' of ' + st.total + ' tasks complete';
    $('health').textContent = st.overdue ? 'Action required' : st.open ? 'Tracking active' : 'All clear';
    $('mOver').textContent = st.overdue; $('mSoon').textContent = st.soon; $('mWeek').textContent = st.week; $('mDone').textContent = st.done;
    $('mSoonLabel').textContent = 'Due within ' + S.lead + ' day' + (S.lead === 1 ? '' : 's');

    var pri = S.tasks.filter(function (t) { return t.status !== 'Completed' && t.status !== 'On Hold'; })
      .map(function (t) { return { t: t, n: C.remaining(c, t, chk) }; })
      .filter(function (x) { return x.n !== null && x.n <= 7; })
      .sort(function (a, b) { return a.n - b.n; }).slice(0, 5);
    $('priority').innerHTML = pri.map(function (x) {
      var n = x.n, d = C.due(c, x.t).date;
      return '<div class="timelineItem"><div class="timelineIcon">' + (n < 0 ? '🚨' : n <= 3 ? '⚠️' : '📅') + '</div><div><strong>' + esc(x.t.title) + '</strong><p>' +
        fmt(d) + ' · ' + (n < 0 ? Math.abs(n) + ' days overdue' : n === 0 ? 'Due today' : n + ' days left') + ' · ' + esc(x.t.rule) + '</p></div></div>';
    }).join('') || '<div class="muted">No dated deadlines in the next 7 days.</div>';

    $('caseLine').textContent = (S.caseName ? S.caseName + ' · ' : '') + (S.commencement ? 'CIRP commenced ' + fmt(S.commencement) : 'Enter the commencement date to calculate the timeline');
    $('lastRefreshed').textContent = new Date().toLocaleString('en-IN');
    updateMascot();
  }

  function rowHtml(t, c, chk) {
    var di = C.due(c, t), n = C.remaining(c, t, chk), u = C.urgency(c, t, chk), late = C.lateness(c, t);
    var cls = t.status === 'Completed' ? 'task-completed' : (n !== null && n < 0 && t.status !== 'On Hold' ? 'task-overdue' : '');
    var dueTxt = di.date ? fmt(di.date) : (S.commencement ? 'Event-dependent date' : 'Set commencement date');
    var sub = esc(t.timeline || 'Manual date') + (BASIS[di.basis] ? ' · ' + BASIS[di.basis] : '');
    if (di.outer && di.basis !== 'outer') sub += '<br>Outer limit: ' + fmt(di.outer);
    var left = t.status === 'Completed' ? '—' : n === null ? '—' : n < 0 ? '<span style="color:var(--red)">' + Math.abs(n) + ' days late</span>' : n === 0 ? 'Today' : n + ' days';
    var kind = t.kind ? '<div><span class="chip">' + esc(t.kind) + '</span></div>' : '';
    var notes = t.notes ? '<div class="subline">📝 ' + esc(t.notes) + '</div>' : '';
    var opts = C.STATUSES.map(function (s) { return '<option' + (t.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('');
    return '<tr class="' + cls + '" data-id="' + t.id + '"><td><div class="tasktitle">' + esc(t.title) + '</div><div class="subline">' + esc(t.rule) + '</div><div class="subline">' + esc(t.mandate) + '</div>' + kind + notes + '</td>' +
      '<td><strong>' + dueTxt + '</strong><div class="subline">' + sub + '</div></td><td>' + left + '</td>' +
      '<td><div class="dateCell"><input class="dateInput" type="date" data-act="actual" aria-label="Date performed for ' + esc(t.title) + '" value="' + esc(t.actual) + '"><small>' +
        (t.actual ? 'Performed ' + fmt(t.actual) + (late ? ' · ' + late + ' day' + (late === 1 ? '' : 's') + ' late' : '') : 'Enter actual date') + '</small></div></td>' +
      '<td><span class="pill ' + u[1] + '">' + u[0] + '</span></td>' +
      '<td><select class="statusSelect" data-act="status" aria-label="Status for ' + esc(t.title) + '">' + opts + '</select></td>' +
      '<td><div class="rowActions"><button class="smallbtn" type="button" data-act="edit">Edit</button><button class="smallbtn danger" type="button" data-act="remove" aria-label="Remove">×</button></div></td></tr>';
  }

  /* ---------- task actions ---------- */
  function find(id) { return S.tasks.find(function (t) { return Number(t.id) === Number(id); }); }

  function setStatus(id, s) {
    var t = find(id); if (!t) return;
    t.status = s;
    if (s === 'Completed' && !t.actual) t.actual = today();
    if (s !== 'Completed' && t.actual && s === 'Pending') { /* keep the performed date; user may be correcting */ }
    save(); render(); toast('Status saved. Check the performed date and correct it if needed.');
  }
  function setActual(id, v) {
    var t = find(id); if (!t) return;
    var d = C.okDate(v);
    if (v && !d) { toast('That is not a valid date.'); render(); return; }
    t.actual = d;
    if (d) t.status = 'Completed'; else if (t.status === 'Completed') t.status = 'Pending';
    save(); render();
    toast(d ? 'Performed on ' + fmt(d) + '. Linked dates were recalculated.' : 'Performed date cleared; task reopened.');
  }
  function removeTask(id) {
    var t = find(id); if (!t) return;
    if (!confirm('Remove "' + t.title + '" from this tracker?' + (t.custom ? '' : '\n(You can bring it back with "Reset register".)'))) return;
    S.tasks = S.tasks.filter(function (x) { return x !== t; });
    S.tasks.forEach(function (x) { if (Number(x.after) === Number(id)) { x.after = null; x.days = null; } });
    if (!t.custom && S.removed.indexOf(Number(id)) < 0) S.removed.push(Number(id));
    save(); render();
  }

  /* ---------- modal ---------- */
  function openModal(t) {
    editingId = t ? Number(t.id) : null;
    var seeded = t && !t.custom;
    $('modalTitle').textContent = t ? 'Edit task' : 'Add a task';
    $('fTitle').value = t ? t.title : ''; $('fRule').value = t ? t.rule : '';
    $('fTitle').disabled = $('fRule').disabled = !!seeded;
    $('fTarget').value = t ? (t.manualTarget || '') : ''; $('fActual').value = t ? t.actual : '';
    $('fStatus').innerHTML = C.STATUSES.map(function (s) { return '<option>' + s + '</option>'; }).join('');
    $('fStatus').value = t ? t.status : 'Pending';
    $('fAfter').innerHTML = '<option value="">No linked task</option>' + S.tasks.filter(function (x) { return !t || x.id !== t.id; })
      .map(function (x) { return '<option value="' + x.id + '">' + esc(x.title) + '</option>'; }).join('');
    $('fAfter').value = t && C.isNum(t.after) ? String(t.after) : '';
    $('fDays').value = t && C.isNum(t.days) ? t.days : '';
    $('fNotes').value = t ? (t.notes || '') : '';
    $('taskModal').classList.add('open');
    setTimeout(function () { (seeded ? $('fTarget') : $('fTitle')).focus(); }, 50);
  }
  function closeModal() { $('taskModal').classList.remove('open'); }
  function saveModal(e) {
    e.preventDefault();
    var title = $('fTitle').value.trim(); if (!title) return;
    var tv = $('fTarget').value, av = $('fActual').value;
    var target = C.okDate(tv), actual = C.okDate(av);
    if ((tv && !target) || (av && !actual)) { toast('Please enter valid dates.'); return; }
    var after = $('fAfter').value === '' ? null : Number($('fAfter').value);
    var days = $('fDays').value === '' ? null : Math.max(0, Math.round(Number($('fDays').value)));
    if (after !== null && days === null) days = 0;
    if (after === null) days = null;
    var t = editingId ? find(editingId) : null;
    var newId = t ? t.id : Math.max(0, Math.max.apply(null, S.tasks.map(function (x) { return Number(x.id) || 0; })), 1000) + 1;
    if (after !== null && C.wouldCreateCycle(S.tasks, newId, after)) { toast('That link would create a loop. Choose another task.'); return; }
    var status = actual ? 'Completed' : $('fStatus').value;
    if (status === 'Completed' && !actual) actual = today();
    if (!t) { t = { id: newId, mandate: 'User-added milestone', timeline: 'Manual date', kind: 'Custom', custom: true }; S.tasks.push(t); }
    if (t.custom) { t.title = title; t.rule = $('fRule').value.trim() || 'Manual'; }
    Object.assign(t, { manualTarget: target, actual: actual, status: status, after: after, days: days, notes: $('fNotes').value.trim() });
    save(); closeModal(); render(); toast('Task saved. Linked dates were recalculated.');
  }

  /* ---------- alerts, calendar, backup ---------- */
  function requestAlerts() {
    if (!('Notification' in window)) { toast('This browser does not support notifications.'); return; }
    Notification.requestPermission().then(function (p) { toast(p === 'granted' ? 'Alerts enabled while this tracker is open.' : 'Notifications were not enabled.'); });
  }
  function checkAlerts() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var c = ctx(), chk = check();
    S.tasks.forEach(function (t) {
      if (t.status === 'Completed' || t.status === 'On Hold') return;
      var d = C.due(c, t).date, n = d ? C.diffDays(d, chk) : null;
      var key = 'cirp_alert_' + t.id + '_' + d + '_' + chk;
      if (n !== null && n <= S.lead && !sessionStorage.getItem(key)) {
        new Notification(n < 0 ? 'Overdue: ' + Math.abs(n) + ' day(s)' : n === 0 ? 'Compliance deadline today' : 'Deadline in ' + n + ' day' + (n === 1 ? '' : 's'), { body: t.title + ' · ' + t.rule });
        try { sessionStorage.setItem(key, '1'); } catch (e) { /* ignore */ }
      }
    });
  }
  function download(name, data, type) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: type })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  }
  function exportICS() {
    var ics = C.buildICS(S.tasks, ctx(), { lead: S.lead, caseName: S.caseName });
    if (ics.indexOf('BEGIN:VEVENT') < 0) { toast('No dated open milestones to export yet. Enter the commencement date first.'); return; }
    download('cirp-compliance-calendar.ics', ics, 'text/calendar');
  }
  function backup() {
    var b = { app: 'cirp-tracker', v: 3, exportedAt: new Date().toISOString(), case: S.caseName, commencement: S.commencement, lead: S.lead, removed: S.removed, tasks: exportTasks(true) };
    download('cirp-tracker-backup-' + today() + '.json', JSON.stringify(b, null, 2), 'application/json');
  }
  function restore(ev) {
    var f = ev.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var b = C.parseBackup(JSON.parse(r.result));
        if (!confirm('Replace the current data with this backup?')) return;
        S.removed = Array.isArray(b.removed) ? b.removed.map(Number) : [];
        S.tasks = C.mergeTasks(SEED, b.tasks, S.removed);
        if (b.case !== undefined) S.caseName = String(b.case || '');
        if (b.commencement !== undefined) S.commencement = C.okDate(b.commencement);
        if (b.lead !== undefined && [1, 3, 7].indexOf(Number(b.lead)) >= 0) S.lead = Number(b.lead);
        syncInputs(); save(); render(); toast('Backup restored.');
      } catch (e) { toast('Could not read that backup file.'); }
      ev.target.value = '';
    };
    r.readAsText(f);
  }
  function resetRegister() {
    if (!confirm('Reset all milestones to the reviewed register? Statuses, performed dates, notes and custom tasks will be erased.')) return;
    S.removed = []; S.tasks = C.mergeTasks(SEED, []); save(); render(); toast('Register restored to defaults.');
  }

  /* ---------- server sync ---------- */
  function setSync(msg, cls) { var el = $('syncStatus'); el.textContent = msg; el.className = 'syncStatus' + (cls ? ' ' + cls : ''); }
  function api(path, opts) {
    var ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 70000);
    var headers = { Accept: 'application/json' };
    if (opts && opts.body) headers['Content-Type'] = 'application/json';
    if (S.apiKey) headers['X-API-Key'] = S.apiKey;
    return fetch(S.apiUrl.replace(/\/+$/, '') + path, Object.assign({}, opts, { headers: headers, cache: 'no-store', signal: ctl.signal }))
      .then(function (r) { return r.json().catch(function () { return null; }).then(function (data) { return { r: r, data: data }; }); })
      .finally(function () { clearTimeout(to); });
  }
  function validUrl(u) { return /^https:\/\//i.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(u); }
  function scheduleSync() {
    clearTimeout(syncTimer);
    if (S.apiUrl && S.autoSync === '1' && validUrl(S.apiUrl)) syncTimer = setTimeout(function () { syncNow(false); }, 2000);
  }
  function applyRemote(srv) {
    var st = srv.state || {};
    S.removed = Array.isArray(st.removed) ? st.removed.map(Number) : [];
    S.tasks = C.mergeTasks(SEED, st.tasks, S.removed);
    S.caseName = String(st.case || ''); S.commencement = C.okDate(st.commencement);
    if ([1, 3, 7].indexOf(Number(st.lead)) >= 0) S.lead = Number(st.lead);
    S.rev = srv.rev; S.dirty = false; syncInputs(); persist(); render();
  }
  function push(baseRev) {
    return api('/api/state', { method: 'PUT', body: JSON.stringify({ base_rev: baseRev, state: exportState() }) }).then(function (p) {
      if (p.r.status === 409) throw new Error('The server changed while syncing. Press Sync now again.');
      if (p.r.status === 401) throw new Error('Access key rejected by the server.');
      if (!p.r.ok) throw new Error('Upload failed (HTTP ' + p.r.status + ')');
      S.rev = p.data.rev; S.dirty = false; persist();
      setSync('Synced · server revision ' + S.rev + ' · ' + new Date().toLocaleTimeString('en-IN'), 'ok');
    });
  }
  function syncNow(manual) {
    if (syncing) return Promise.resolve();
    if (!S.apiUrl) { if (manual) toast('Enter your Render service URL first.'); return Promise.resolve(); }
    if (!validUrl(S.apiUrl)) { setSync('Use the full https:// URL of your server.', 'err'); return Promise.resolve(); }
    syncing = true; setSync('Syncing… (a free Render service can take about a minute to wake up)'); $('btnSync').disabled = true;
    return api('/api/state').then(function (g) {
      if (g.r.status === 401) throw new Error('Access key rejected by the server.');
      if (!g.r.ok || !g.data) throw new Error('Server answered HTTP ' + g.r.status + '. Is this the right URL?');
      var srv = g.data;
      if (srv.rev === 0) return push(0);
      if (srv.rev === S.rev) {
        if (S.dirty) return push(srv.rev);
        setSync('Up to date · server revision ' + S.rev, 'ok'); return null;
      }
      if (!S.dirty) { applyRemote(srv); setSync('Loaded newer data from the server (revision ' + srv.rev + ').', 'ok'); return null; }
      if (confirm('The server has newer data (revision ' + srv.rev + ') and you also have unsynced changes here.\n\nOK = keep THIS device\'s data and overwrite the server.\nCancel = load the server\'s data and discard local changes.')) return push(srv.rev);
      applyRemote(srv); setSync('Loaded the server\'s data.', 'ok'); return null;
    }).catch(function (e) {
      var m = e.name === 'AbortError' ? 'Timed out. The server may still be waking up; try again.' : /Failed to fetch|NetworkError/i.test(e.message) ? 'Could not reach the server (offline, wrong URL, or blocked by CORS).' : e.message;
      setSync('Sync failed: ' + m, 'err'); if (manual) toast('Sync failed. ' + m);
    }).finally(function () { syncing = false; $('btnSync').disabled = false; });
  }
  function probeSameOrigin() {
    if (S.apiUrl || !/^https?:$/.test(location.protocol)) return Promise.resolve();
    var ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 4000);
    return fetch('health', { cache: 'no-store', signal: ctl.signal }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.status === 'ok') { S.apiUrl = location.origin; $('apiUrl').value = S.apiUrl; persist(); } })
      .catch(function () { /* static hosting: no server */ }).finally(function () { clearTimeout(to); });
  }

  /* ---------- 3D companion ---------- */
  var heroLoaded = false, lastMascot = '';
  function applyHero() {
    var on = S.heroOn === null ? window.innerWidth > 700 : !!S.heroOn;
    var dock = $('mascot3D-dock');
    dock.style.display = on ? '' : 'none';
    $('btnHero').textContent = '🦸 Hero: ' + (on ? 'on' : 'off'); $('btnHero').setAttribute('aria-pressed', String(on));
    if (on && !heroLoaded) {
      heroLoaded = true;
      import('./hero3d.js').then(function () { lastMascot = ''; updateMascot(); }).catch(function () {
        dock.style.display = 'none'; heroLoaded = false; toast('The 3D companion could not load (needs internet access and WebGL). The tracker works without it.');
      });
    }
  }
  function updateMascot() {
    var c = ctx(), chk = check(), late = 0, soon = 0, done = 0;
    S.tasks.forEach(function (t) {
      if (t.status === 'Completed') { done++; return; }
      if (t.status === 'On Hold') return;
      var n = C.remaining(c, t, chk);
      if (n === null) return; if (n < 0) late++; else if (n <= 3) soon++;
    });
    var mood = 'greeting', message = 'Namaste! I’m your CIRP hero. Let’s keep every milestone on track.';
    if (late) { mood = 'worried'; message = late + ' overdue task' + (late === 1 ? ' needs' : 's need') + ' attention. Please verify the legal deadline.'; }
    else if (soon) { mood = 'thinking'; message = soon + ' deadline' + (soon === 1 ? ' is' : 's are') + ' close. Let’s prepare the next step.'; }
    else if (S.tasks.length && done === S.tasks.length) { mood = 'happy'; message = 'All tracked tasks are complete. Mission accomplished!'; }
    else if (done) { mood = 'happy'; message = 'Great progress: ' + done + ' task' + (done === 1 ? ' is' : 's are') + ' complete.'; }
    var key = mood + '|' + message; if (key === lastMascot) return; lastMascot = key;
    window.dispatchEvent(new CustomEvent('cirp:mascot-mood', { detail: { mood: mood, message: message, late: late, soon: soon, done: done } }));
  }

  /* ---------- wiring ---------- */
  function syncInputs() {
    $('caseName').value = S.caseName; $('baseDate').value = S.commencement; $('leadDays').value = String(S.lead);
    $('checkDate').value = S.checkDate; $('apiUrl').value = S.apiUrl; $('apiKey').value = S.apiKey; $('autoSync').value = S.autoSync;
  }
  function wire() {
    $('caseName').addEventListener('input', function () { S.caseName = this.value.trim(); save(); render(); });
    $('baseDate').addEventListener('change', function () {
      var v = C.okDate(this.value); if (this.value && !v) { toast('Invalid date.'); this.value = S.commencement; return; }
      S.commencement = v; save(); render(); toast(v ? 'Timeline recalculated from ' + fmt(v) + '.' : 'Commencement date cleared.');
    });
    $('leadDays').addEventListener('change', function () { S.lead = Number(this.value); save(); render(); });
    $('checkDate').addEventListener('change', function () { S.checkDate = C.okDate(this.value); render(); });
    $('search').addEventListener('input', render);
    document.querySelector('.tabs').addEventListener('click', function (e) {
      var b = e.target.closest('.tab'); if (!b) return; filter = b.dataset.filter;
      document.querySelectorAll('.tab').forEach(function (x) { x.classList.toggle('active', x === b); }); render();
    });
    var tb = $('tbody');
    tb.addEventListener('change', function (e) {
      var tr = e.target.closest('tr'); if (!tr) return; var id = tr.dataset.id, act = e.target.dataset.act;
      if (act === 'status') setStatus(id, e.target.value); else if (act === 'actual') setActual(id, e.target.value);
    });
    tb.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; var tr = b.closest('tr'); if (!tr) return;
      if (b.dataset.act === 'edit') openModal(find(tr.dataset.id)); else if (b.dataset.act === 'remove') removeTask(tr.dataset.id);
    });
    $('btnAdd').addEventListener('click', function () { openModal(null); });
    $('btnAlerts').addEventListener('click', requestAlerts);
    $('btnICS').addEventListener('click', exportICS);
    $('btnHero').addEventListener('click', function () { S.heroOn = !(S.heroOn === null ? window.innerWidth > 700 : S.heroOn); persist(); applyHero(); });
    $('btnBackup').addEventListener('click', backup);
    $('btnRestore').addEventListener('click', function () { $('uploadJSON').click(); });
    $('uploadJSON').addEventListener('change', restore);
    $('btnReset').addEventListener('click', resetRegister);
    $('btnSync').addEventListener('click', function () { syncNow(true); });
    $('apiUrl').addEventListener('change', function () { S.apiUrl = this.value.trim().replace(/\/+$/, ''); persist(); if (S.apiUrl) syncNow(true); });
    $('apiKey').addEventListener('change', function () { S.apiKey = this.value; persist(); });
    $('autoSync').addEventListener('change', function () { S.autoSync = this.value; persist(); });
    $('taskForm').addEventListener('submit', saveModal);
    $('btnModalClose').addEventListener('click', closeModal); $('btnModalCancel').addEventListener('click', closeModal);
    $('taskModal').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    window.addEventListener('beforeunload', function () { persist(); });
  }

  function init() {
    wire();
    var saved = loadLocal();
    if (saved) {
      S.caseName = saved.caseName || ''; S.commencement = C.okDate(saved.commencement);
      S.lead = [1, 3, 7].indexOf(Number(saved.lead)) >= 0 ? Number(saved.lead) : 3;
      S.apiUrl = saved.apiUrl || ''; S.apiKey = saved.apiKey || ''; S.autoSync = saved.autoSync === '0' ? '0' : '1';
      S.heroOn = typeof saved.heroOn === 'boolean' ? saved.heroOn : null; S.rev = Number(saved.rev) || 0;
      S.dirty = !!saved.dirty || !!saved.migrated; S.removed = Array.isArray(saved.removed) ? saved.removed.map(Number) : [];
    }
    S.checkDate = '';
    fetch('tasks_seed.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (seed) {
        SEED = seed; S.tasks = C.mergeTasks(SEED, saved ? saved.tasks : [], S.removed);
        syncInputs(); persist(); render(); applyHero(); setInterval(checkAlerts, 60000); checkAlerts();
        return probeSameOrigin();
      })
      .then(function () { $('apiUrl').value = S.apiUrl; if (S.apiUrl && S.autoSync === '1') return syncNow(false); })
      .catch(function (e) {
        $('tbody').innerHTML = '<tr><td colspan="7" style="padding:28px;text-align:center;color:var(--red)">Could not load the milestone register (' + esc(e.message) +
          '). Serve this folder over http(s) (GitHub Pages / Render / <code>python -m http.server</code>); opening index.html directly from disk blocks it.</td></tr>';
      });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
