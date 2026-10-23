/**
 * @file store.js
 * Application state, localStorage persistence (always wrapped in try/catch),
 * JSON backup/restore, CSV import/export and the built-in sample data.
 * Depends on PM.math and PM.model.
 */
(function (root) {
  'use strict';

  var PM = root.PM = root.PM || {};
  var M = PM.math, Mo = PM.model;
  var S = PM.store = {};

  var KEY = 'sachetguard.v1';
  var ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;
  var NAME_MAX = 40;
  var DESC_MAX = 600;
  var TASK_TYPES = ['replacement', 'inspection', 'lubrication', 'cleaning', 'check'];
  var THEME_KEY = 'sachetguard.theme';
  var PRES_KEY = 'sachetguard.presentation';
  var listeners = [];
  var memory = {};            // fallback when localStorage is blocked
  S.storageOK = true;
  S.state = null;

  /* ---------------- safe storage ---------------- */
  function read(key) {
    try { var v = root.localStorage.getItem(key); return v === null ? (memory[key] || null) : v; }
    catch (e) { S.storageOK = false; return memory[key] || null; }
  }
  function write(key, val) {
    memory[key] = val;
    try { root.localStorage.setItem(key, val); }
    catch (e) { S.storageOK = false; }
  }
  /** Read a small per-viewer preference (theme, presentation mode). */
  S.getPref = function (name) { return read(name === 'theme' ? THEME_KEY : PRES_KEY); };
  /** Save a small per-viewer preference. */
  S.setPref = function (name, v) { write(name === 'theme' ? THEME_KEY : PRES_KEY, v); };

  /* ---------------- helpers ---------------- */
  /** Short unique id. */
  S.uid = function () { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function today() { var d = new Date(); return d.toISOString().slice(0, 10); }
  function daysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

  /* ---------------- sample data ---------------- */
  function rec(h, type) { return { id: S.uid(), hours: h, type: type || 'failure' }; }

  /**
   * Build the pre-loaded demonstration state. Failure hours come from the project
   * brief; all costs are realistic Naira figures for a small Makurdi sachet plant.
   * @returns {object} A complete state object.
   */
  S.sampleState = function () {
    var st = S.blankState();
    st.isSample = true;
    var c = st.components;
    c.bearing.records = [1420, 1580, 1650, 1710, 1900, 2050].map(function (h) { return rec(h); });
    c.motor.records = [5200, 6800, 7400].map(function (h) { return rec(h); }).concat([rec(6000, 'suspension')]);
    c.sealer.records = [600, 750, 820, 900, 1050, 1150].map(function (h) { return rec(h); });
    c.bearing.inputs = { hoursSince: 1100, tempC: 72, vibMms: 2.1, lastMaint: daysAgo(40) };
    c.motor.inputs = { hoursSince: 2200, tempC: 70, vibMms: 0.6, lastMaint: daysAgo(55) };
    c.sealer.inputs = { hoursSince: 400, tempC: 158, vibMms: 0.5, lastMaint: daysAgo(6) };
    Object.keys(c).forEach(function (id) { S.refitInto(c[id]); });
    st.validation = [
      { id: S.uid(), comp: 'bearing', hours: 1480, date: '2026-01-18', note: 'Sample: bearing seized' },
      { id: S.uid(), comp: 'bearing', hours: 1790, date: '2026-03-22', note: 'Sample: bearing noise then failure' },
      { id: S.uid(), comp: 'motor', hours: 6500, date: '2026-06-09', note: 'Sample: winding burnt out' },
      { id: S.uid(), comp: 'sealer', hours: 700, date: '2026-02-11', note: 'Sample: element burnt out' },
      { id: S.uid(), comp: 'sealer', hours: 470, date: '2026-05-14', note: 'Sample: element failed early after a power surge' },
      { id: S.uid(), comp: 'sealer', hours: 980, date: '2026-08-27', note: 'Sample: element open circuit' }
    ];
    return st;
  };

  /** An empty state: default settings and components with no data and no model. */
  S.blankState = function () {
    var comps = {};
    Mo.COMPONENTS.forEach(function (m) { comps[m.id] = Mo.defaultComponent(m.id, m); });
    return { version: 1, isSample: false, settings: Mo.defaultSettings(), components: comps, validation: [] };
  };

  /* ---------------- fitting ---------------- */
  /**
   * Fit the Weibull model into a component record from its records.
   * @param {object} comp Component record (modified in place when the fit succeeds).
   * @returns {object} The result of PM.math.fitWeibullMRR.
   */
  S.refitInto = function (comp) {
    var res = M.fitWeibullMRR(comp.records);
    comp.lastFit = res.ok ? { beta: res.beta, eta: res.eta, r2: res.r2, failures: res.failures, suspensions: res.suspensions } : null;
    if (res.ok) comp.params = { beta: res.beta, eta: res.eta, r2: res.r2, source: 'fit' };
    return res;
  };

  /* ---------------- init / persistence ---------------- */
  /** Merge a loaded object onto defaults so missing fields never crash the app. */
  function normalise(raw) {
    var base = S.blankState();
    if (!raw || typeof raw !== 'object') return base;
    function merge(dst, src) {
      Object.keys(dst).forEach(function (k) {
        if (src && src[k] !== undefined) {
          if (dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])) merge(dst[k], src[k]);
          else dst[k] = src[k];
        }
      });
    }
    merge(base.settings, raw.settings);
    var rawComps = raw.components && typeof raw.components === 'object' ? raw.components : {};
    var legacy = raw.settings && raw.settings.schedule && raw.settings.schedule.intervals; // older backups kept intervals in settings
    var loaded = {};
    Object.keys(rawComps).forEach(function (id) {
      var r = rawComps[id];
      if (!r || typeof r !== 'object' || !ID_RE.test(id)) return;
      var name = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, NAME_MAX) : Mo.meta(id).name;
      var kind = Mo.KINDS[r.kind] ? r.kind : (Mo.KINDS[id] ? id : 'general');
      var d = Mo.defaultComponent(id, { name: name, kind: kind, vibration: typeof r.vibration === 'boolean' ? r.vibration : undefined,
        part: typeof r.part === 'string' && r.part.trim() ? r.part.trim().slice(0, NAME_MAX) : undefined });
      merge(d.inputs, r.inputs);
      merge(d.costs, r.costs);
      if (Array.isArray(r.records)) {
        d.records = r.records.filter(function (x) { return x && x.hours > 0 && (x.type === 'failure' || x.type === 'suspension'); })
          .map(function (x) { return { id: x.id || S.uid(), hours: Number(x.hours), type: x.type }; });
      }
      if (r.params && r.params.beta > 0 && r.params.eta > 0) {
        d.params = { beta: Number(r.params.beta), eta: Number(r.params.eta), r2: r.params.r2, source: r.params.source === 'manual' ? 'manual' : 'fit', stale: !!r.params.stale };
      }
      if (r.lastFit) d.lastFit = r.lastFit;
      if (typeof r.description === 'string') d.description = r.description.slice(0, DESC_MAX);
      if (typeof r.limitsSource === 'string') d.limitsSource = r.limitsSource.slice(0, 200);
      if (r.tempLimits && typeof r.tempLimits === 'object') {
        var tl = { warn: Number(r.tempLimits.warn), alarm: Number(r.tempLimits.alarm), warnK: Number(r.tempLimits.warnK), alarmK: Number(r.tempLimits.alarmK) };
        if (Mo.validLimits(tl)) d.tempLimits = tl;
      }
      if (Array.isArray(r.tasks)) {
        var tasks = r.tasks.filter(function (t) { return t && typeof t.task === 'string' && t.interval > 0; })
          .map(function (t, n) { return { id: String(t.id || 't' + n), task: t.task.slice(0, 80), type: TASK_TYPES.indexOf(t.type) >= 0 ? t.type : 'check', interval: Number(t.interval) }; });
        if (tasks.length) d.tasks = tasks;
      } else if (legacy) d.tasks = Mo.defaultTasks(kind, legacy);
      loaded[id] = d;
    });
    if (Object.keys(loaded).length) base.components = loaded;
    if (Array.isArray(raw.validation)) {
      base.validation = raw.validation.filter(function (v) { return v && v.hours > 0 && base.components[v.comp]; })
        .map(function (v) { return { id: v.id || S.uid(), comp: v.comp, hours: Number(v.hours), date: S.cleanDate(v.date), note: String(v.note || '') }; });
    }
    base.isSample = !!raw.isSample;
    return base;
  }

  /** Load saved state, or the sample data on first run. */
  S.init = function () {
    var txt = read(KEY), st = null;
    if (txt) { try { st = normalise(JSON.parse(txt)); } catch (e) { st = null; } }
    S.state = st || S.sampleState();
    S.save();
    return S.state;
  };

  /** Persist the state. */
  S.save = function () { write(KEY, JSON.stringify(S.state)); };

  /** Subscribe to state changes. */
  S.subscribe = function (fn) { listeners.push(fn); };
  /** Notify subscribers. @param {string} [why] hint such as 'input' or 'structure'. */
  S.emit = function (why) { listeners.forEach(function (fn) { fn(why || 'change'); }); };

  /** Save then notify. */
  S.commit = function (why) { S.save(); S.emit(why); };

  /**
   * Set a value by dotted path, e.g. "settings.vibration.bounds.A" or
   * "components.motor.inputs.tempC". Does not emit; call S.commit afterwards.
   */
  S.setPath = function (path, value) {
    var parts = path.split('.'), o = S.state;
    for (var i = 0; i < parts.length - 1; i++) { o = o[parts[i]]; if (!o) return false; }
    o[parts[parts.length - 1]] = value;
    return true;
  };
  /** Get a value by dotted path. */
  S.getPath = function (path) {
    var o = S.state, parts = path.split('.');
    for (var i = 0; i < parts.length; i++) { if (o === undefined || o === null) return undefined; o = o[parts[i]]; }
    return o;
  };

  /* ---------------- records ---------------- */
  /** Add a failure/suspension record to a component, refitting automatically if the model came from data. */
  S.addRecord = function (compId, hours, type) {
    var c = S.state.components[compId];
    c.records.push({ id: S.uid(), hours: Number(hours), type: type === 'suspension' ? 'suspension' : 'failure' });
    S.afterRecordChange(c);
  };
  /** Delete a record by id. */
  S.deleteRecord = function (compId, id) {
    var c = S.state.components[compId];
    c.records = c.records.filter(function (r) { return r.id !== id; });
    S.afterRecordChange(c);
  };
  /** Edit a record's fields. */
  S.updateRecord = function (compId, id, patch) {
    var c = S.state.components[compId];
    c.records.forEach(function (r) { if (r.id === id) Object.assign(r, patch); });
    S.afterRecordChange(c, 'records');
  };
  /** Refit silently when the current model was fitted from data. */
  S.afterRecordChange = function (c, why) {
    if (c.params && c.params.source === 'fit') {
      var res = S.refitInto(c);
      if (!res.ok) c.params.stale = true; // records no longer support a fit; keep the old model but flag it
    } else if (!c.params) S.refitInto(c);
    S.commit(why || 'structure');
  };
  /** Enter beta and eta by hand. */
  S.setManualParams = function (compId, beta, eta) {
    S.state.components[compId].params = { beta: beta, eta: eta, source: 'manual' };
    S.commit('structure');
  };

  /* ---------------- components ---------------- */
  /** All component records, in the order they were created. */
  S.comps = function () { return Object.keys(S.state.components).map(function (id) { return S.state.components[id]; }); };
  /** Component record by id, or a placeholder for an id that no longer exists. */
  S.meta = function (id) { return S.state.components[id] || { id: id, name: 'Removed part', part: 'part', kind: 'general', vibration: false }; };
  /** Clean a typed part name: trimmed, single-spaced, limited length. */
  S.cleanName = function (v) { return String(v || '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX); };

  /**
   * Create a component.
   * @param {{name:string, kind:string, vibration?:boolean}} o
   * @returns {string} The new component id.
   */
  S.addComponent = function (o) {
    var id, name = S.cleanName(o.name) || 'New part';
    do { id = 'c' + S.uid(); } while (S.state.components[id]);
    S.state.components[id] = Mo.defaultComponent(id, { name: name, kind: o.kind, part: name, vibration: o.vibration, description: String(o.description || '').trim().slice(0, DESC_MAX) });
    S.state.components[id].tempLimits = Mo.startingLimits(S.state.components[id], S.state.settings); // a new part starts with its own, editable limits
    S.commit('structure');
    return id;
  };

  /**
   * Edit a component's name, type and vibration setting. Changing the type swaps in
   * that type's routine tasks; records, readings, costs and the model are kept.
   * @returns {boolean} False when the component does not exist.
   */
  S.updateComponent = function (id, o) {
    var c = S.state.components[id];
    if (!c) return false;
    var name = S.cleanName(o.name);
    if (name) { c.name = name; if (!Mo.KINDS[id]) c.part = name; }
    if (Mo.KINDS[o.kind] && o.kind !== Mo.kindOf(c)) { c.kind = o.kind; c.tasks = Mo.defaultTasks(o.kind); }
    if (typeof o.vibration === 'boolean') c.vibration = o.vibration;
    if (typeof o.description === 'string') c.description = o.description.trim().slice(0, DESC_MAX);
    S.commit('structure');
    return true;
  };

  /** Turn the part's own temperature limits on (starting from its type's values) or off. */
  S.setOwnLimits = function (id, on) {
    var c = S.state.components[id];
    if (!c) return;
    c.tempLimits = on ? Mo.startingLimits(c, S.state.settings) : null;
    S.commit('structure');
  };
  /** Save the free-text note about where the part's limits come from. */
  S.setLimitsSource = function (id, text) {
    var c = S.state.components[id];
    if (c) { c.limitsSource = String(text || '').trim().slice(0, 200); S.save(); }
  };

  /** Add a routine task to a component. @returns {boolean} False if the input is invalid. */
  S.addTask = function (id, o) {
    var c = S.state.components[id], name = String(o.task || '').replace(/\s+/g, ' ').trim().slice(0, 80), iv = Number(o.interval);
    if (!c || !name || !(iv >= 10 && iv <= 20000)) return false;
    c.tasks = c.tasks || [];
    c.tasks.push({ id: 't' + S.uid(), task: name, type: TASK_TYPES.indexOf(o.type) >= 0 ? o.type : 'check', interval: iv });
    S.commit('structure');
    return true;
  };
  /** Rename a task or change its type. */
  S.updateTask = function (id, taskId, patch) {
    var c = S.state.components[id];
    if (!c) return;
    (c.tasks || []).forEach(function (t) {
      if (t.id !== taskId) return;
      var name = patch.task === undefined ? '' : String(patch.task).replace(/\s+/g, ' ').trim().slice(0, 80);
      if (name) t.task = name;
      if (TASK_TYPES.indexOf(patch.type) >= 0) t.type = patch.type;
    });
    S.commit('structure');
  };
  /** Remove a routine task. */
  S.deleteTask = function (id, taskId) {
    var c = S.state.components[id];
    if (!c) return;
    c.tasks = (c.tasks || []).filter(function (t) { return t.id !== taskId; });
    S.commit('structure');
  };

  /**
   * Delete a component together with its records and its historical failures.
   * The last remaining component cannot be deleted.
   * @returns {{ok:boolean, message:string}}
   */
  S.deleteComponent = function (id) {
    if (!S.state.components[id]) return { ok: false, message: 'That part no longer exists.' };
    if (S.comps().length <= 1) return { ok: false, message: 'Keep at least one part. Add another first, or use Reset all data in Settings.' };
    delete S.state.components[id];
    S.state.validation = S.state.validation.filter(function (v) { return v.comp !== id; });
    S.commit('structure');
    return { ok: true, message: 'Part deleted.' };
  };

  /* ---------------- reset / sample ---------------- */
  /** Replace everything with the sample data. */
  S.loadSample = function () { S.state = S.sampleState(); S.commit('structure'); };
  /** Wipe all data: blank components, default settings, no model. */
  S.resetAll = function () { S.state = S.blankState(); S.commit('structure'); };

  /* ---------------- JSON backup ---------------- */
  /** @returns {string} Pretty-printed JSON backup of the whole state. */
  S.exportJSON = function () {
    return JSON.stringify({ app: 'SachetGuard PM', exported: new Date().toISOString(), data: S.state }, null, 2);
  };
  /**
   * Restore from a JSON backup.
   * @param {string} text File contents.
   * @returns {{ok:boolean, message:string}}
   */
  S.importJSON = function (text) {
    var obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, message: 'That file is not valid JSON.' }; }
    var data = obj && obj.data ? obj.data : obj;
    if (!data || typeof data !== 'object' || !data.components || !data.settings) {
      return { ok: false, message: 'That file is not a SachetGuard PM backup.' };
    }
    S.state = normalise(data);
    S.commit('structure');
    return { ok: true, message: 'Backup restored.' };
  };

  /* ---------------- CSV ---------------- */
  function csvCell(v) {
    v = String(v === null || v === undefined ? '' : v);
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  /**
   * Export records as CSV with columns component,hours,type.
   * @param {string} [compId] Limit to one component; omit for all.
   * @returns {string}
   */
  S.recordsToCSV = function (compId) {
    var rows = ['component,hours,type'];
    S.comps().forEach(function (m) {
      if (compId && m.id !== compId) return;
      m.records.forEach(function (r) { rows.push([m.id, r.hours, r.type].map(csvCell).join(',')); });
    });
    return rows.join('\r\n') + '\r\n';
  };

  /** Split CSV text into rows of cells (handles quotes and CRLF). */
  S.parseCSV = function (text) {
    var rows = [], row = [], cell = '', q = false, i, ch;
    text = String(text).replace(/^﻿/, '');
    for (i = 0; i < text.length; i++) {
      ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',' || ch === ';') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some(function (c) { return c.trim() !== ''; })) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some(function (c) { return c.trim() !== ''; })) rows.push(row);
    return rows;
  };

  /**
   * Import failure records from CSV text into a component.
   * Accepts columns "hours,type" or "component,hours,type" (header optional).
   * A row with only an hours value is treated as a failure. Invalid rows are
   * skipped and reported.
   * @param {string} text CSV contents.
   * @param {string} compId Target component for rows without a component column.
   * @param {boolean} [replace=false] Replace existing records instead of appending.
   * @returns {{ok:boolean, added:number, skipped:string[], message:string}}
   */
  S.importRecordsCSV = function (text, compId, replace) {
    var rows = S.parseCSV(text);
    if (!rows.length) return { ok: false, added: 0, skipped: [], message: 'The file is empty.' };
    var header = rows[0].map(function (c) { return c.trim().toLowerCase(); });
    var hasHeader = header.some(function (c) { return c === 'hours' || c === 'type' || c === 'component'; });
    var idx = { comp: header.indexOf('component'), hours: header.indexOf('hours'), type: header.indexOf('type') };
    if (!hasHeader) {
      idx = rows[0].length >= 3 ? { comp: 0, hours: 1, type: 2 } : { comp: -1, hours: 0, type: rows[0].length > 1 ? 1 : -1 };
    }
    if (idx.hours < 0) return { ok: false, added: 0, skipped: [], message: 'No "hours" column was found.' };
    var added = [], skipped = [];
    rows.slice(hasHeader ? 1 : 0).forEach(function (r, n) {
      var line = n + (hasHeader ? 2 : 1);
      var h = parseFloat(String(r[idx.hours]).replace(/,/g, ''));
      var t = idx.type >= 0 && r[idx.type] ? r[idx.type].trim().toLowerCase() : 'failure';
      var cid = idx.comp >= 0 && r[idx.comp] ? r[idx.comp].trim().toLowerCase() : compId;
      if (!(h > 0) || !isFinite(h)) { skipped.push('Row ' + line + ': hours must be a positive number'); return; }
      if (t === 'f' || t === 'fail') t = 'failure';
      if (t === 's' || t === 'susp' || t === 'censored') t = 'suspension';
      if (t !== 'failure' && t !== 'suspension') { skipped.push('Row ' + line + ': type must be "failure" or "suspension"'); return; }
      if (idx.comp >= 0 && cid !== compId) { skipped.push('Row ' + line + ': belongs to "' + cid + '", not this component'); return; }
      added.push({ id: S.uid(), hours: h, type: t });
    });
    if (!added.length) return { ok: false, added: 0, skipped: skipped, message: 'No valid records were found.' };
    var c = S.state.components[compId];
    c.records = replace ? added : c.records.concat(added);
    S.afterRecordChange(c);
    return { ok: true, added: added.length, skipped: skipped,
      message: added.length + ' record' + (added.length === 1 ? '' : 's') + ' imported' + (skipped.length ? ', ' + skipped.length + ' skipped' : '') + '.' };
  };

  /* ---------------- validation records ---------------- */
  /** Return a valid YYYY-MM-DD string or '' (never a future date). */
  S.cleanDate = function (d) {
    if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
    var t = new Date(d + 'T00:00:00');
    if (isNaN(t.getTime()) || d > today()) return '';
    return d;
  };
  /** Add a historical failure for validation (date is optional, YYYY-MM-DD). */
  S.addValidation = function (comp, hours, note, date) {
    S.state.validation.push({ id: S.uid(), comp: comp, hours: Number(hours), date: S.cleanDate(date), note: note || '' });
    S.commit('structure');
  };
  /** Remove a validation record. */
  S.deleteValidation = function (id) {
    S.state.validation = S.state.validation.filter(function (v) { return v.id !== id; });
    S.commit('structure');
  };

  S.today = today;
})(typeof window !== 'undefined' ? window : globalThis);
