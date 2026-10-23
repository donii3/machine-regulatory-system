/**
 * @file ui.js
 * Rendering and event handling for every screen of SachetGuard PM.
 * Pages are plain functions that return {title, html, after, dynamic}.
 * Number inputs are bound generically through a data-path attribute that points
 * into the store state (see PM.store.setPath).
 */
(function (root) {
  'use strict';

  var PM = root.PM = root.PM || {};
  var S = PM.store, Mo = PM.model, M = PM.math, fmt = PM.fmt, Ch = PM.charts;
  var esc = fmt.esc;
  var U = PM.ui = {};

  var CIRC = 326.73; // 2 * pi * 52
  var ui = { filter: 'all', demo: -1, fitWarn: {}, current: null, all: null, noAnim: false, valFilter: 'all' };
  var inputTimer = null;
  var main;

  /* ------------------------------------------------------------------ *
   *  Small helpers and icons
   * ------------------------------------------------------------------ */
  function $(sel, r) { return (r || document).querySelector(sel); }
  function $$(sel, r) { return Array.prototype.slice.call((r || document).querySelectorAll(sel)); }

  var ICONS = {
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
    home: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    motor: '<rect x="5" y="7" width="12" height="10" rx="2"/><path d="M17 12h4M5 10H3M5 14H3M9 7V5h4v2M9 11v2M13 11v2"/>',
    bearing: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
    sealer: '<path d="M12 3c1 3.5 4.5 4.5 4.5 9a4.5 4.5 0 0 1-9 0c0-2 1-3.2 2.2-4.2.2 1.2.9 2 1.8 2.2-.3-2.2.2-4.6.5-7z"/><path d="M5 21h14"/>',
    data: '<path d="M4 19V5M4 19h16"/><path d="M8 15l3-4 3 2 5-7"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6v2m0 8v2"/>',
    shield: '<path d="M9 12l2 2 4-4"/><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>',
    screen: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    octagon: '<path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z"/><path d="M9 9l6 6M15 9l-6 6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>',
    right: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    left: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M4 20h16"/>',
    upload: '<path d="M12 16V5M7 9l5-5 5 5M4 20h16"/>',
    printer: '<path d="M7 9V3h10v6M7 17H4v-6h16v6h-3M7 14h10v7H7z"/>',
    more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    general: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'
  };
  /** Inline SVG icon by name. */
  function icon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONS[name] || '') + '</svg>';
  }
  U.icon = icon;

  var STATUS_ICON = { green: 'check', yellow: 'eye', red: 'octagon', none: 'help' };
  function pill(st) {
    return '<span class="pill ' + st + '">' + icon(STATUS_ICON[st]) + Mo.statusLabel(st) + '</span>';
  }
  function clean(v) { return String(Math.round(v * 1e6) / 1e6); }
  function compIcon(id) { return icon(Mo.kindOf(S.meta(id))); }
  var BUILTIN = { motor: 1, bearing: 1, sealer: 1 };
  /** Stable hue (0-359) for a custom component, so it keeps its colour. */
  function hueOf(id) { var h = 0; for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360; return h; }
  /** Class and style attributes that colour a tag or swatch for a component. */
  function colourAttrs(id, base) {
    return BUILTIN[id] ? ' class="' + base + ' ' + id + '"' : ' class="' + base + ' custom" style="--ch:' + hueOf(id) + '"';
  }
  /** A coloured name tag for a component. */
  function tagHtml(id) { return '<span' + colourAttrs(id, 'tag') + '>' + esc(S.meta(id).name) + '</span>'; }
  /** Component ids, most urgent first. */
  function ordered() { return Mo.prioritise(ui.all); }
  function daysSince(dateStr) {
    if (!dateStr) return null;
    var d = new Date(dateStr + 'T00:00:00'), n = new Date(); n.setHours(0, 0, 0, 0);
    return Math.round((n - d) / 86400000);
  }

  /* ------------------------------------------------------------------ *
   *  Toasts, dialogs, downloads
   * ------------------------------------------------------------------ */
  /** Show a toast notification. @param {string} msg @param {string} [kind] 'bad' for errors. */
  U.toast = function (msg, kind) {
    var box = $('#toasts');
    if (!box) return;
    var t = document.createElement('div');
    t.className = 'toast' + (kind === 'bad' ? ' bad' : '');
    t.setAttribute('role', kind === 'bad' ? 'alert' : 'status');
    t.innerHTML = icon(kind === 'bad' ? 'alert' : 'check') + '<span>' + esc(msg) + '</span>';
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 320); }, kind === 'bad' ? 5200 : 3200);
  };

  function confirmDialog(title, text, okLabel) {
    return new Promise(function (resolve) {
      var back = document.createElement('div');
      back.className = 'dialog-backdrop';
      back.innerHTML = '<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t" aria-describedby="dlg-d">' +
        '<h2 id="dlg-t">' + esc(title) + '</h2><p id="dlg-d" class="hint">' + esc(text) + '</p>' +
        '<div class="toolbar"><button class="btn" data-dlg="no">Cancel</button><button class="btn btn-primary" data-dlg="yes">' + esc(okLabel || 'Confirm') + '</button></div></div>';
      var prev = document.activeElement;
      function done(v) { document.removeEventListener('keydown', key, true); back.remove(); if (prev && prev.focus) prev.focus(); resolve(v); }
      function key(e) {
        if (e.key === 'Escape') { e.stopPropagation(); done(false); }
        if (e.key === 'Tab') {
          var b = $$('button', back); var i = b.indexOf(document.activeElement);
          e.preventDefault(); b[(i + (e.shiftKey ? -1 : 1) + b.length) % b.length].focus();
        }
      }
      back.addEventListener('click', function (e) {
        var b = e.target.closest('[data-dlg]');
        if (b) done(b.getAttribute('data-dlg') === 'yes'); else if (e.target === back) done(false);
      });
      document.addEventListener('keydown', key, true);
      document.body.appendChild(back);
      $('[data-dlg="no"]', back).focus();
    });
  }

  var KIND_HELP = {
    motor: 'Life halves for every 10 °C above the rated temperature. Gets an insulation and temperature check.',
    bearing: 'Ages faster above the warning and alarm temperatures. Gets a vibration inspection and lubrication.',
    sealer: 'Ages faster when the temperature drifts away from its setpoint. Gets jaw cleaning and an element check.',
    general: 'Any other part. Uses a simple warning and alarm temperature rule, and a routine inspection.'
  };

  /**
   * Dialog to add or edit a component.
   * @param {object|null} existing Component record to edit, or null to add.
   * @returns {Promise<{name:string, kind:string, vibration:boolean}|null>} Null when cancelled.
   */
  function componentDialog(existing) {
    return new Promise(function (resolve) {
      var kind0 = existing ? Mo.kindOf(existing) : 'general';
      var vib0 = existing ? Mo.usesVibration(existing) : Mo.KINDS[kind0].vibration;
      var back = document.createElement('div');
      back.className = 'dialog-backdrop';
      back.innerHTML = '<form class="dialog comp-dialog" role="dialog" aria-modal="true" aria-labelledby="cd-t" novalidate>' +
        '<h2 id="cd-t">' + (existing ? 'Edit component' : 'Add a component') + '</h2>' +
        '<p class="hint">' + (existing ? 'Rename the part or change how it is modelled. Its records, readings and costs are kept.' : 'Add any part you want to keep an eye on. You can add its failure records next.') + '</p>' +
        '<div class="field"><label for="cd-name">Name</label><div class="input-wrap"><input id="cd-name" type="text" maxlength="' + 40 + '" autocomplete="off" placeholder="e.g. Conveyor gearbox" value="' + esc(existing ? existing.name : '') + '" aria-describedby="cd-err"></div></div>' +
        '<div class="field"><label for="cd-kind">Type of part</label><div class="input-wrap"><select id="cd-kind" aria-describedby="cd-kind-help">' +
        Object.keys(Mo.KINDS).map(function (k) { return '<option value="' + k + '"' + (k === kind0 ? ' selected' : '') + '>' + esc(Mo.KINDS[k].label) + '</option>'; }).join('') +
        '</select></div><div class="help" id="cd-kind-help"></div></div>' +
        '<div class="field"><label for="cd-desc">Description <span class="opt">(optional)</span></label><div class="input-wrap"><textarea id="cd-desc" rows="3" maxlength="600" placeholder="What it does, where it sits, make and model, how it usually fails">' + esc(existing ? existing.description : '') + '</textarea></div></div>' +
        '<label class="check-row"><input type="checkbox" id="cd-vib"' + (vib0 ? ' checked' : '') + '><span>Measure vibration for this part</span></label>' +
        '<div class="err" id="cd-err" role="alert" aria-live="assertive"></div>' +
        '<div class="toolbar"><button type="button" class="btn" data-cd="cancel">Cancel</button><button type="submit" class="btn btn-primary">' + (existing ? 'Save changes' : 'Add component') + '</button></div></form>';
      var prev = document.activeElement;
      var form = $('form', back), nameEl = $('#cd-name', back), kindEl = $('#cd-kind', back), vibEl = $('#cd-vib', back), errEl = $('#cd-err', back), helpEl = $('#cd-kind-help', back);
      var vibTouched = !!existing;
      function syncHelp() {
        var k = kindEl.value;
        helpEl.textContent = KIND_HELP[k] + (existing && k !== kind0 ? ' Changing the type replaces this part\'s routine tasks.' : '');
      }
      syncHelp();
      kindEl.addEventListener('change', function () { syncHelp(); if (!vibTouched) vibEl.checked = Mo.KINDS[kindEl.value].vibration; });
      vibEl.addEventListener('change', function () { vibTouched = true; });
      function done(v) { document.removeEventListener('keydown', key, true); back.remove(); if (prev && prev.focus) prev.focus(); resolve(v); }
      function key(e) {
        if (e.key === 'Escape') { e.stopPropagation(); done(null); }
        if (e.key === 'Tab') {
          var f = $$('input, select, textarea, button', back); var i = f.indexOf(document.activeElement);
          e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        }
      }
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = S.cleanName(nameEl.value);
        if (!name) { errEl.textContent = 'Give the part a name.'; nameEl.setAttribute('aria-invalid', 'true'); nameEl.focus(); return; }
        done({ name: name, kind: kindEl.value, vibration: vibEl.checked, description: $('#cd-desc', back).value });
      });
      back.addEventListener('click', function (e) {
        if (e.target === back || e.target.closest('[data-cd="cancel"]')) done(null);
      });
      document.addEventListener('keydown', key, true);
      document.body.appendChild(back);
      nameEl.focus();
      nameEl.select();
    });
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function announce(text) { var l = $('#live'); if (l) l.textContent = text; }

  /* ------------------------------------------------------------------ *
   *  Form fields
   * ------------------------------------------------------------------ */
  /**
   * HTML for a labelled numeric input bound to a state path.
   * @param {{path:string,label:string,unit?:string,min:number,max:number,value:number,help?:string,scale?:number,assumption?:boolean,disabled?:boolean}} o
   */
  function numField(o) {
    var id = 'f-' + o.path.replace(/\./g, '-');
    var scale = o.scale || 1;
    return '<div class="field"><label for="' + id + '">' + esc(o.label) +
      (o.assumption ? '<span class="assumption">engineering assumption — cite source</span>' : '') + '</label>' +
      '<div class="input-wrap' + (o.unit ? ' has-unit' : '') + '">' +
      '<input id="' + id + '" type="number" inputmode="decimal" step="any" data-path="' + o.path + '" data-min="' + o.min + '" data-max="' + o.max +
      '" data-scale="' + scale + '" data-unit="' + esc(o.unit || '') + '" value="' + clean(o.value * scale) + '"' + (o.disabled ? ' disabled' : '') +
      ' aria-describedby="' + id + '-err' + (o.help ? ' ' + id + '-help' : '') + '">' +
      (o.unit ? '<span class="unit" aria-hidden="true">' + esc(o.unit) + '</span>' : '') + '</div>' +
      (o.help ? '<div class="help" id="' + id + '-help">' + esc(o.help) + '</div>' : '') +
      '<div class="err" id="' + id + '-err" aria-live="polite"></div></div>';
  }

  function dateField(o) {
    var id = 'f-' + o.path.replace(/\./g, '-');
    return '<div class="field"><label for="' + id + '">' + esc(o.label) + '</label><div class="input-wrap">' +
      '<input id="' + id + '" type="date" data-path="' + o.path + '" data-kind="date" max="' + S.today() + '" value="' + esc(o.value || '') + '" aria-describedby="' + id + '-err">' +
      '</div><div class="err" id="' + id + '-err" aria-live="polite"></div></div>';
  }

  /** Cross-field validation for settings (returns an error message or ''). */
  function crossCheck(path, v) {
    var g = function (p) { return S.getPath(p); };
    var b = 'settings.vibration.bounds.';
    if (path.indexOf(b) === 0) {
      var k = path.slice(b.length), A = g(b + 'A'), B = g(b + 'B'), C = g(b + 'C');
      if (k === 'A') A = v; if (k === 'B') B = v; if (k === 'C') C = v;
      if (!(A < B && B < C)) return 'Zone limits must go up: A < B < C.';
    }
    var mp = 'settings.vibration.multipliers.';
    if (path.indexOf(mp) === 0) {
      var mk = path.slice(mp.length), m = { A: g(mp + 'A'), B: g(mp + 'B'), C: g(mp + 'C'), D: g(mp + 'D') };
      m[mk] = v;
      if (!(m.A <= m.B && m.B <= m.C && m.C <= m.D)) return 'Multipliers must not decrease from zone A to D.';
    }
    if (path === 'settings.temperature.motor.rated' && !(v < g('settings.temperature.motor.alarm'))) return 'Rated temperature must be below the alarm temperature.';
    if (path === 'settings.temperature.motor.alarm' && !(v > g('settings.temperature.motor.rated'))) return 'Alarm temperature must be above the rated temperature.';
    var wa = /^(settings\.temperature\.(?:bearing|general)|components\.[A-Za-z0-9_-]+\.tempLimits)\.(warn|alarm)$/.exec(path);
    if (wa) {
      var base = wa[1] + '.';
      if (wa[2] === 'warn' && !(v < g(base + 'alarm'))) return 'Warning temperature must be below the alarm temperature.';
      if (wa[2] === 'alarm' && !(v > g(base + 'warn'))) return 'Alarm temperature must be above the warning temperature.';
    }
    if (path === 'settings.temperature.sealer.alarmDev' && !(v > g('settings.temperature.sealer.tolerance'))) return 'Alarm deviation must be larger than the allowed band.';
    if (path === 'settings.temperature.sealer.tolerance' && !(v < g('settings.temperature.sealer.alarmDev'))) return 'Allowed band must be smaller than the alarm deviation.';
    if (path === 'settings.health.greenP200' && !(v < g('settings.health.redP200'))) return 'The Monitor threshold must be below the Critical threshold.';
    if (path === 'settings.health.redP200' && !(v > g('settings.health.greenP200'))) return 'The Critical threshold must be above the Monitor threshold.';
    return '';
  }

  /** Validate an input element; returns {ok, value, msg}. */
  function validateInput(el) {
    var kind = el.getAttribute('data-kind');
    if (kind === 'date') {
      if (!el.value) return { ok: true, value: '' };
      if (el.value > S.today()) return { ok: false, msg: 'The date cannot be in the future.' };
      return { ok: true, value: el.value };
    }
    var raw = el.value.trim();
    var lo = parseFloat(el.getAttribute('data-min')), hi = parseFloat(el.getAttribute('data-max'));
    var unit = el.getAttribute('data-unit'), scale = parseFloat(el.getAttribute('data-scale')) || 1;
    if (raw === '' || !isFinite(Number(raw))) return { ok: false, msg: 'Enter a number' + (unit ? ' in ' + unit : '') + '.' };
    var n = Number(raw);
    if (n < lo || n > hi) return { ok: false, msg: 'Enter a value between ' + fmt.num(lo, lo % 1 ? 2 : 0) + ' and ' + fmt.num(hi, hi % 1 ? 2 : 0) + (unit ? ' ' + unit : '') + '.' };
    var v = n / scale;
    var cc = crossCheck(el.getAttribute('data-path'), v);
    if (cc) return { ok: false, msg: cc };
    return { ok: true, value: v };
  }

  function setFieldError(el, msg) {
    var f = el.closest('.field');
    var e = f && $('.err', f);
    if (e) e.textContent = msg || '';
    if (f) f.classList.toggle('invalid', !!msg);
    if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  }

  function onFieldInput(e) {
    var el = e.target;
    if (!el.matches || !el.matches('input[data-path]')) return;
    var r = validateInput(el);
    setFieldError(el, r.ok ? '' : r.msg);
    if (!r.ok) return;
    S.setPath(el.getAttribute('data-path'), r.value);
    S.save();
    clearTimeout(inputTimer);
    inputTimer = setTimeout(function () { S.emit('input'); }, 140);
  }

  /* ------------------------------------------------------------------ *
   *  Shared visual pieces
   * ------------------------------------------------------------------ */
  function gaugeHtml(score, st) {
    var n = Math.round(score);
    return '<div class="gauge ' + st + '" role="img" aria-label="Health score ' + n + ' out of 100"><svg viewBox="0 0 120 120" aria-hidden="true">' +
      '<circle class="track" cx="60" cy="60" r="52"/><circle class="arc" cx="60" cy="60" r="52" stroke-dasharray="' + CIRC + '" stroke-dashoffset="' + CIRC + '" data-score="' + n + '"/></svg>' +
      '<div class="gauge-label"><b>' + n + '</b><span>Health</span></div></div>';
  }

  function probRow(P) {
    return '<div class="prob-row" role="group" aria-label="Chance of failing soon">' + [100, 200, 500].map(function (dt) {
      var cls = P[dt] >= 0.3 ? 'hot' : (P[dt] >= 0.1 ? 'warm' : '');
      return '<div class="prob ' + cls + '"><b>' + fmt.pct(P[dt]) + '</b><span>next ' + dt + ' h</span></div>';
    }).join('') + '</div>';
  }

  function animateVisuals(rootEl, immediate) {
    var arcs = $$('.gauge .arc', rootEl), bars = $$('.bar > i[data-w]', rootEl);
    function apply() {
      arcs.forEach(function (c) {
        if (immediate) c.style.transition = 'none';
        c.style.strokeDashoffset = String(CIRC * (1 - parseFloat(c.getAttribute('data-score')) / 100));
      });
      bars.forEach(function (b) {
        if (immediate) b.style.transition = 'none';
        b.style.width = b.getAttribute('data-w') + '%';
      });
    }
    if (immediate) apply(); else requestAnimationFrame(function () { requestAnimationFrame(apply); });
  }

  function compTabs(active, base) {
    return '<div class="seg" role="tablist" aria-label="Choose a component">' + S.comps().map(function (c) {
      return '<a href="#/' + base + '/' + c.id + '" role="tab" aria-selected="' + (c.id === active) + '" ' + (c.id === active ? 'aria-current="true"' : '') + '>' + esc(c.name) + '</a>';
    }).join('') + '</div>';
  }

  /* ------------------------------------------------------------------ *
   *  Page: Dashboard
   * ------------------------------------------------------------------ */
  function compCard(a, i, rank) {
    var meta = { name: a.name };
    if (!a.valid) {
      return '<a class="comp-card none reveal" style="--i:' + i + '" href="#/calibration/' + a.id + '"><div class="comp-head"><div class="comp-title"><span class="comp-ico">' + compIcon(a.id) + '</span><div><h3>' + esc(meta.name) + '</h3><small>Priority ' + rank + '</small></div></div></div><div class="pill-row">' + pill('none') + '</div>' +
        '<div class="reco none">' + icon('info') + '<span>' + esc(a.reason) + '</span></div><span class="go">Add data ' + icon('right') + '</span></a>';
    }
    var rulFrac = Math.max(0, Math.min(100, 100 * a.rulEff / a.mttf));
    return '<a class="comp-card ' + a.status + ' reveal" style="--i:' + i + '" href="#/component/' + a.id + '" data-card="' + a.id + '">' +
      '<div class="comp-head"><div class="comp-title"><span class="comp-ico">' + compIcon(a.id) + '</span><div><h3>' + esc(meta.name) + '</h3><small>Priority ' + rank + ' · ' + fmt.num(a.hoursSince) + ' h since replacement</small></div></div></div>' +
      '<div class="pill-row">' + pill(a.status) + '</div>' +
      '<div class="gauge-row">' + gaugeHtml(a.score, a.status) + '<div class="gauge-side"><div class="big num">' + (a.hrsToRef <= 0 ? 'Now' : fmt.days(a.daysToRef).replace(' days', ' d').replace(' day', ' d')) + '</div><div class="cap">until recommended replacement<br><span class="mono">' + a.basis + ' = ' + fmt.hours(a.refLife) + '</span></div></div></div>' +
      '<div><div class="label-sm">Expected remaining life</div><div class="bar ' + a.status + '" role="img" aria-label="Expected remaining life ' + fmt.num(a.rulHours) + ' hours"><i data-w="' + rulFrac.toFixed(1) + '"></i></div>' +
      '<div class="bar-meta"><span><b>' + fmt.num(a.rulHours) + ' h</b> of running time</span><span><b>' + fmt.days(a.rulDays) + '</b></span></div></div>' +
      '<div><div class="label-sm">Chance of failing soon</div>' + probRow(a.P) + '</div>' +
      '<div class="reco ' + a.status + '">' + icon(STATUS_ICON[a.status]) + '<span>' + esc(a.recommendation) + '</span></div>' +
      '<span class="go">Open details ' + icon('right') + '</span></a>';
  }

  function dashboardHtml(all) {
    var st = S.state, s = st.settings;
    var overall = Mo.overallStatus(all);
    var sched = Mo.buildSchedule(all, st);
    var next = sched.events[0];
    var cmp = Mo.costComparison(all, st);
    var order = Mo.prioritise(all);
    var needing = order.filter(function (id) { return all[id].status === 'red' || all[id].status === 'yellow'; }).length;
    var overallText = { green: 'All healthy', yellow: 'Keep watching', red: 'Act now', none: 'No data yet' }[overall];
    var nextHtml;
    if (next) {
      var inDays = next.offsetDays;
      nextHtml = '<div class="k">Next maintenance due</div><div class="v">' + (next.dueNow ? 'Now' : (inDays <= 0 ? 'Today' : fmt.date(next.date))) + '</div><div class="s">' + esc(next.task) + ' – ' + esc(next.comp) + (inDays > 0 ? ' (in ' + fmt.days(inDays) + ')' : '') + '</div>';
    } else {
      nextHtml = '<div class="k">Next maintenance due</div><div class="v">–</div><div class="s">Add failure data to build a plan.</div>';
    }
    return '<section class="hero reveal"><div class="hero-kicker">Predictive maintenance · ' + esc(s.machineName) + '</div>' +
      '<h1>Fix it <em>before</em> it breaks.</h1><p>Live health, remaining life and a cost-saving plan for the critical parts of your sachet water line.</p></section>' +
      '<div class="summary-strip reveal" style="--i:2" role="region" aria-label="Plant summary">' +
      '<div class="summary-cell status-' + overall + '"><div class="k">Overall plant status</div><div class="v">' + overallText + '</div><div class="s">' + pill(overall) + ' <span style="margin-left:6px">' + (overall === 'none' ? 'Add data to begin' : needing + ' of ' + order.length + (order.length === 1 ? ' part needs' : ' parts need') + ' attention') + '</span></div></div>' +
      '<div class="summary-cell">' + nextHtml + '</div>' +
      '<div class="summary-cell"><div class="k">Estimated monthly savings</div><div class="v num" id="sum-savings">' + (cmp.rows.length ? fmt.naira(cmp.total.savings) : '–') + '</div><div class="s">' + (cmp.rows.length ? fmt.pct(cmp.total.savingsPct) + ' less than waiting for breakdowns' : 'Needs a fitted model') + '</div></div></div>' +
      '<section class="section"><div class="section-head"><div><h2>Your critical parts</h2><p>Tap a card to see why it has this status and what to do.</p></div>' +
      '<button class="btn btn-primary" type="button" data-act="comp-add">' + icon('plus') + 'Add component</button></div>' +
      '<div class="cards">' + order.map(function (id, i) { return compCard(all[id], i + 3, i + 1); }).join('') + '</div></section>';
  }

  function skeletonHtml() {
    return '<div class="skeleton" style="height:300px;margin:0 calc(var(--gutter) * -1)"></div><div class="skeleton" style="height:120px;margin-top:-56px;position:relative"></div>' +
      '<div class="cards" style="margin-top:32px"><div class="skeleton" style="height:420px"></div><div class="skeleton" style="height:420px"></div><div class="skeleton" style="height:420px"></div></div>';
  }

  function pageDashboard() {
    return { title: 'Dashboard', html: dashboardHtml(ui.all), after: function () { animateVisuals(main); announce('Dashboard. Overall status ' + Mo.statusLabel(Mo.overallStatus(ui.all)) + '.'); } };
  }

  /* ------------------------------------------------------------------ *
   *  Page: Component detail
   * ------------------------------------------------------------------ */
  function detailInputs(id) {
    var comp = S.state.components[id], i = comp.inputs, b = 'components.' + id + '.inputs.';
    var kind = Mo.kindOf(comp);
    var tempLabel = { motor: 'Motor casing temperature', bearing: 'Bearing housing temperature', sealer: 'Sealing jaw temperature', general: 'Part temperature' }[kind];
    var tempHelp = { motor: 'Measured with an infrared thermometer.', bearing: 'Touch-safe reading on the bearing housing.', sealer: 'Jaw surface temperature while sealing.', general: 'Surface temperature in normal running.' }[kind];
    return '<div class="card"><h3>Current readings</h3><p class="hint" style="margin-bottom:14px">Type the latest numbers. Results update as you type.</p>' +
      numField({ path: b + 'hoursSince', label: 'Hours since last replacement', unit: 'h', min: 0, max: 200000, value: i.hoursSince, help: 'Running hours of the part now fitted.' }) +
      '<div class="field-row">' +
      numField({ path: 'settings.hoursPerDay', label: 'Operating hours per day', unit: 'h/day', min: 1, max: 24, value: S.state.settings.hoursPerDay }) +
      numField({ path: 'settings.daysPerWeek', label: 'Working days per week', unit: 'days', min: 1, max: 7, value: S.state.settings.daysPerWeek }) + '</div>' +
      numField({ path: b + 'tempC', label: tempLabel, unit: '°C', min: -20, max: 500, value: i.tempC, help: tempHelp }) +
      (!Mo.usesVibration(comp)
        ? '<div class="field"><span class="lab">Vibration</span><div class="help">Not used for this part. Turn it on with Edit.</div></div>'
        : numField({ path: b + 'vibMms', label: 'Vibration velocity (RMS)', unit: 'mm/s', min: 0, max: 100, value: i.vibMms, help: 'From a handheld vibration meter.' })) +
      dateField({ path: b + 'lastMaint', label: 'Last maintenance date', value: i.lastMaint }) + '</div>';
  }

  var TASK_CHOICES = [['inspection', 'Inspection'], ['lubrication', 'Lubrication'], ['cleaning', 'Cleaning'], ['check', 'Check']];

  /** Describe the shared limits a part uses when it has none of its own. */
  function sharedLimitsText(kind, s) {
    var t = s.temperature[kind];
    if (kind === 'motor') return 'rated ' + t.rated + ' °C, alarm ' + t.alarm + ' °C (life halves for every 10 °C above rated)';
    if (kind === 'sealer') return 'setpoint ' + t.setpoint + ' °C ± ' + t.tolerance + ' °C, alarm at ± ' + t.alarmDev + ' °C';
    return 'warning ' + t.warn + ' °C (×' + t.warnK + '), alarm ' + t.alarm + ' °C (×' + t.alarmK + ')';
  }

  /** The "About", "Temperature limits" and "Routine tasks" cards of a component page. */
  function partCards(id) {
    var c = S.state.components[id], s = S.state.settings, kind = Mo.kindOf(c), own = Mo.validLimits(c.tempLimits), b = 'components.' + id + '.tempLimits.';
    var about = '<section class="panel-sec" aria-labelledby="ps-desc"><h3 id="ps-desc">Description</h3><div class="field"><label class="sr-only" for="part-desc">Description</label><div class="input-wrap">' +
      '<textarea id="part-desc" rows="3" maxlength="600" data-part="description" aria-describedby="part-desc-help">' + esc(c.description) + '</textarea></div>' +
      '<div class="help" id="part-desc-help">What it does, where it sits on the machine, make and model, and how it usually fails.</div></div></section>';
    var limits = '<section class="panel-sec panel-tint" aria-labelledby="ps-lim"><div class="card-head"><h3 id="ps-lim">Temperature limits</h3>' +
      (own ? '<button class="btn btn-sm" type="button" data-act="limits-default" title="Go back to the shared limits for ' + esc(Mo.KINDS[kind].label.toLowerCase()) + ' parts">Use type defaults</button>' : '<button class="btn btn-sm btn-primary" type="button" data-act="limits-own">' + icon('edit') + 'Set limits for this part</button>') + '</div>';
    if (own) {
      limits += '<p class="hint" style="margin:0 0 14px">Above the warning temperature this part ages faster by the warning multiplier. At the alarm temperature it turns Critical and ages by the alarm multiplier.</p>' +
        '<div class="limit-grid">' +
        numField({ path: b + 'warn', label: 'Warning temperature', unit: '°C', min: -20, max: 500, value: c.tempLimits.warn }) +
        numField({ path: b + 'warnK', label: 'Ageing multiplier at warning', unit: '×', min: 1, max: 10, value: c.tempLimits.warnK }) +
        numField({ path: b + 'alarm', label: 'Alarm temperature', unit: '°C', min: -20, max: 600, value: c.tempLimits.alarm }) +
        numField({ path: b + 'alarmK', label: 'Ageing multiplier at alarm', unit: '×', min: 1, max: 10, value: c.tempLimits.alarmK }) + '</div>' +
        '<div class="field"><label for="part-source">Source of these limits<span class="assumption">cite it in your report</span></label><div class="input-wrap">' +
        '<input id="part-source" type="text" maxlength="200" data-part="source" placeholder="e.g. Manufacturer manual, p. 12, or supervisor\'s estimate" value="' + esc(c.limitsSource) + '"></div></div>';
    } else {
      limits += '<p class="hint" style="margin:0">This part follows the shared rule for <b>' + esc(Mo.KINDS[kind].label) + '</b> parts: ' + esc(sharedLimitsText(kind, s)) + '. Change it for every part of this type in <a href="#/settings">Settings</a>, or set limits for this part alone.</p>';
    }
    limits += '</section>';
    var rows = (c.tasks || []).map(function (t, n) {
      return '<div class="task-row" data-tid="' + esc(t.id) + '"><div class="field"><label class="sr-only" for="tk-n-' + n + '">Task name</label><div class="input-wrap"><input id="tk-n-' + n + '" type="text" maxlength="80" data-task="task" value="' + esc(t.task) + '"></div></div>' +
        '<div class="field"><label class="sr-only" for="tk-t-' + n + '">Task type</label><div class="input-wrap"><select id="tk-t-' + n + '" data-task="type">' + TASK_CHOICES.map(function (o) {
          return '<option value="' + o[0] + '"' + (t.type === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="field"><label class="sr-only" for="tk-i-' + n + '">Repeats every, running hours</label><div class="input-wrap has-unit"><input id="tk-i-' + n + '" type="number" inputmode="decimal" step="any" data-path="components.' + id + '.tasks.' + n + '.interval" data-min="10" data-max="20000" data-scale="1" data-unit="h" value="' + clean(t.interval) + '"><span class="unit" aria-hidden="true">h</span></div><div class="err" aria-live="polite"></div></div>' +
        '<button class="btn btn-ghost btn-danger btn-sm" type="button" data-act="task-del" data-id="' + esc(t.id) + '" aria-label="Delete task ' + esc(t.task) + '">' + icon('trash') + '</button></div>';
    }).join('');
    var tasks = '<div class="card panel"><section class="panel-sec"><h3>Routine tasks</h3><p class="hint" style="margin-bottom:8px">Jobs that repeat every set number of running hours. They appear in the 12-month Maintenance Schedule. Replacement is added automatically from the model.</p>' +
      '<div class="task-head" aria-hidden="true"><span>Task</span><span>Type</span><span>Repeats every</span><span></span></div>' +
      (rows || '<p class="hint">No routine tasks yet.</p>') + '</section>' +
      '<section class="panel-sec panel-tint"><h3>Add a task</h3><div class="task-add"><div class="field"><label for="new-task">New task</label><div class="input-wrap"><input id="new-task" type="text" maxlength="80" placeholder="e.g. Tighten belt"></div></div>' +
      '<div class="field"><label for="new-task-type">Type</label><div class="input-wrap"><select id="new-task-type">' + TASK_CHOICES.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="field"><label for="new-task-iv">Every</label><div class="input-wrap has-unit"><input id="new-task-iv" type="number" inputmode="decimal" step="any" value="250"><span class="unit" aria-hidden="true">h</span></div></div>' +
      '<button class="btn btn-primary" type="button" data-act="task-add">' + icon('plus') + 'Add task</button></div><div class="err" id="new-task-err" role="alert" style="min-height:1.2em"></div></section></div>';
    return { setup: '<div class="card panel panel-cols">' + about + limits + '</div>', tasks: tasks };
  }

  function detailStatus(id) {
    var a = ui.all[id], comp = S.state.components[id], s = S.state.settings;
    if (!a.valid) {
      return '<div class="card"><div class="empty">' + icon('data') + '<h3>No model for this part yet</h3><p>' + esc(a.reason) + '</p><p style="margin-top:14px"><a class="btn btn-primary" href="#/calibration/' + id + '">Go to Model Calibration ' + icon('right') + '</a></p></div></div>';
    }
    var ds = daysSince(comp.inputs.lastMaint);
    var lastText = ds === null ? 'Not recorded' : (ds === 0 ? 'Today' : ds + ' day' + (ds === 1 ? '' : 's') + ' ago');
    var noOpt = a.opt.exists ? '' : '<div class="callout warn" style="margin-top:12px">' + icon('info') + '<span>' + esc(a.opt.reason) + ' The B10 life (' + fmt.hours(a.b10) + ') is used as the replacement guide.</span></div>';
    return '<div class="card status-card ' + a.status + '"><div class="comp-head"><div class="comp-title"><span class="comp-ico">' + compIcon(id) + '</span><div><h3 style="font-size:var(--fs-lg)">' + esc(a.name) + '</h3><small>Last maintenance: ' + lastText + '</small></div></div>' + pill(a.status) + '</div>' +
      '<div class="gauge-row" style="margin:16px 0">' + gaugeHtml(a.score, a.status) + '<div class="gauge-side"><div class="big num">' + (a.hrsToRef <= 0 ? 'Replace now' : fmt.days(a.daysToRef)) + '</div><div class="cap">until recommended replacement</div></div></div>' +
      '<div class="reco ' + a.status + '">' + icon(STATUS_ICON[a.status]) + '<span>' + esc(a.recommendation) + '</span></div>' +
      '<ul class="hint" style="margin:12px 0 0;padding-left:20px">' + a.reasons.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') +
      '<li>Temperature: ' + esc(a.temp.note) + '</li>' + (a.vib.zone ? '<li>Vibration: ' + esc(a.vib.label) + '.</li>' : '') + '</ul>' +
      '<div class="stat-grid four" style="margin-top:16px">' +
      '<div class="stat"><div class="k">Part age</div><div class="v">' + fmt.num(a.hoursSince) + '</div><div class="s">hours since replaced</div></div>' +
      '<div class="stat"><div class="k">Adjusted age</div><div class="v">' + fmt.num(a.tEff) + '</div><div class="s">hours (×' + fmt.num(a.kTotal, 2) + ' for heat and vibration)</div></div>' +
      '<div class="stat"><div class="k">Replace at ' + a.basis + '</div><div class="v">' + fmt.num(a.refLife) + '</div><div class="s">hours of adjusted age</div></div>' +
      '<div class="stat"><div class="k">Remaining life</div><div class="v">' + fmt.num(a.rulHours) + '</div><div class="s">hours (' + fmt.days(a.rulDays) + ')</div></div></div>' +
      noOpt + '<div class="prob-block"><div class="label-sm">Chance of failing soon</div>' + probRow(a.P) + '</div></div>';
  }

  function detailCharts(id) {
    var a = ui.all[id], comp = S.state.components[id], s = S.state.settings;
    if (!a.valid) return '';
    var steps = Mo.explain(a, comp, s);
    return '<div class="grid cols-2">' +
      chartCard('ch-rel', 'How likely is the part to still be working?', 'The amber dashed line assumes failures are completely random. The teal line is the wear-out model fitted to your data. The purple marker is where this part is today.',
        'Reliability chart. Chance the part is still working today is ' + fmt.pct(a.Rnow, 0) + ' under the wear-out model.') +
      chartCard('ch-haz', 'How risky is the next hour?', 'A rising line means the part is wearing out: the older it gets, the more likely it is to fail in the next hour.',
        'Hazard rate chart rising with operating hours.') + '</div>' +
      '<div style="margin-top:16px">' +
      chartCard('ch-cost', 'What does each running hour cost?', a.opt.exists ? 'Replacing too early wastes good parts; too late means breakdowns. The red dot is the cheapest replacement age (T*).' : 'This part has no cheapest replacement age, so the curve has no low point.',
        'Cost per operating hour chart' + (a.opt.exists ? ', lowest at ' + fmt.num(a.opt.T) + ' hours.' : '.')) + '</div>' +
      '<div style="margin-top:16px"><details class="explain" id="explain"' + (ui.explainOpen ? ' open' : '') + '><summary>' + icon('info').replace('<svg', '<svg width="22" height="22"') + ' How was this calculated?</summary><div class="steps">' +
      steps.map(function (st) {
        return '<div class="step"><h4>' + esc(st.title) + '</h4><div class="formula">' + esc(st.formula) + '</div><div class="working">' + esc(st.working) + '</div><div class="result">→ ' + esc(st.result) + '</div></div>';
      }).join('') + '</div></details></div>';
  }

  function chartCard(id, title, hint, label) {
    return '<div class="card chart-card"><h3>' + esc(title) + '</h3><p class="hint">' + esc(hint) + '</p><div class="chart-box"><canvas id="' + id + '" role="img" aria-label="' + esc(label) + '"></canvas></div></div>';
  }

  function drawDetailCharts(id, animate) {
    var a = ui.all[id];
    if (!a.valid) return;
    var o = { animate: animate };
    Ch.reliability('ch-rel', a, o); Ch.hazard('ch-haz', a, o); Ch.cost('ch-cost', a, o);
  }

  var COMP_TABS = [['overview', 'Overview'], ['setup', 'Part setup'], ['tasks', 'Routine tasks']];

  function pageComponent(id, tab) {
    tab = tab === 'setup' || tab === 'tasks' ? tab : 'overview';
    var meta = S.meta(id), pc = partCards(id);
    var tabs = '<div class="seg comp-tabs no-print" role="tablist" aria-label="Sections of ' + esc(meta.name) + '">' + COMP_TABS.map(function (t) {
      var on = t[0] === tab;
      return '<a href="#/component/' + id + (t[0] === 'overview' ? '' : '/' + t[0]) + '" role="tab" aria-selected="' + on + '"' + (on ? ' aria-current="true"' : '') + '>' + t[1] + '</a>';
    }).join('') + '</div>';
    var intro = { overview: 'Enter today\'s readings to see this part\'s health, remaining life and the best time to replace it.',
      setup: 'Describe the part and set how heat ages it.', tasks: 'Choose the jobs that repeat and how often.' }[tab];
    var body = tab === 'overview'
      ? '<div class="section detail-layout"><div>' + detailInputs(id) + '</div><div id="results" class="reveal" style="--i:1">' + detailStatus(id) + '</div></div>' +
        '<div class="section reveal" id="charts" style="--i:2">' + detailCharts(id) + '</div>'
      : '<div class="section reveal" style="--i:1">' + (tab === 'setup' ? pc.setup : pc.tasks) + '</div>';
    return {
      title: meta.name,
      html: '<a class="crumb" href="#/dashboard">' + icon('left').replace('<svg', '<svg width="16" height="16"') + ' Dashboard</a>' +
        '<div class="page-title reveal"><div class="title-row"><h1>' + esc(meta.name) + '</h1><div class="toolbar title-actions no-print">' +
        '<button class="btn btn-sm" type="button" data-act="comp-edit">' + icon('edit') + 'Edit</button>' +
        '<button class="btn btn-sm btn-danger" type="button" data-act="comp-delete">' + icon('trash') + 'Delete</button></div></div>' +
        '<p>' + esc(Mo.KINDS[Mo.kindOf(meta)].label) + (meta.description ? ' · ' + esc(meta.description.replace(/[.\s]+$/, '')) : '') + (tab === 'overview' ? '. ' + intro : '') + '</p></div>' +
        '<div class="section" style="margin-bottom:0">' + tabs + '</div>' + body,
      after: function () {
        if (tab !== 'overview') { announce(meta.name + ': ' + (tab === 'setup' ? 'part setup' : 'routine tasks') + '.'); return; }
        drawDetailCharts(id, true);
        animateVisuals($('#results'));
        var d = $('#explain'); if (d) d.addEventListener('toggle', function () { ui.explainOpen = d.open; });
        announceComponent(id);
      },
      dynamic: function () {
        var box = $('#results');
        if (!box) return;
        var d = $('#explain'); if (d) ui.explainOpen = d.open;
        Ch.destroyAll();
        box.innerHTML = detailStatus(id);
        $('#charts').innerHTML = detailCharts(id);
        drawDetailCharts(id, false);
        animateVisuals(box, true);
        var d2 = $('#explain'); if (d2) d2.addEventListener('toggle', function () { ui.explainOpen = d2.open; });
        announceComponent(id);
      }
    };
  }

  function announceComponent(id) {
    var a = ui.all[id];
    announce(a.valid ? a.name + ': ' + Mo.statusLabel(a.status) + '. ' + a.recommendation : a.name + ': no model yet.');
  }

  /* ------------------------------------------------------------------ *
   *  Page: Model Calibration
   * ------------------------------------------------------------------ */
  function betaMeaning(b) {
    if (b < 0.9) return { kind: 'Early-life failures', text: 'The shape value is below 1, so failures are most likely when the part is new (bad installation, faulty parts). Replacing the part on a timer will not help. Check installation and quality instead.' };
    if (b <= 1.1) return { kind: 'Random failures', text: 'The shape value is close to 1, so failures happen at random and do not depend on age. A fixed replacement time will not help. Use condition checks instead.' };
    if (b <= 2) return { kind: 'Mild wear-out', text: 'The shape value is a little above 1, so the part slowly becomes more likely to fail with age. Planned replacement can help if breakdowns are costly.' };
    if (b <= 4) return { kind: 'Clear wear-out', text: 'The shape value is well above 1, so the part wears out in a fairly predictable way. Planned replacement before the wear-out zone is worthwhile.' };
    return { kind: 'Strong wear-out', text: 'The shape value is high, so most parts fail close to the same age. This is ideal for planned replacement: replace a little before that age.' };
  }

  function calibrationResults(id) {
    var comp = S.state.components[id];
    var a = ui.all[id];
    var fit = M.fitWeibullMRR(comp.records);
    var failures = comp.records.filter(function (r) { return r.type === 'failure'; }).length;
    var out = '';
    if (!fit.ok) {
      out += '<div class="callout warn">' + icon('alert') + '<span>' + esc(fit.message) + '</span></div>';
    }
    if (ui.fitWarn[id]) out += '<div class="callout bad" style="margin-top:12px">' + icon('alert') + '<span>' + esc(ui.fitWarn[id]) + '</span></div>';
    if (comp.params) {
      var p = comp.params, mean = Mo.mtbfOf(comp), mean2 = M.weibullMTTF(p.beta, p.eta), b10 = M.b10(p.beta, p.eta);
      var bm = betaMeaning(p.beta);
      if (p.stale) out += '<div class="callout warn" style="margin-top:12px">' + icon('alert') + '<span>The records changed and no longer allow a new fit. The model below is from the earlier fit. Add records to refit, or enter values by hand.</span></div>';
      out += '<div style="margin-top:16px"><p class="hint" style="margin-bottom:10px">Model in use: <b>' + (p.source === 'fit' ? 'fitted from your records' : 'entered by hand') + '</b></p>' +
        '<div class="stat-grid three"><div class="stat"><div class="k">Shape <span style="text-transform:none">β</span></div><div class="v">' + fmt.num(p.beta, 2) + '</div><div class="s">' + bm.kind + '</div></div>' +
        '<div class="stat"><div class="k">Scale <span style="text-transform:none">η</span></div><div class="v">' + fmt.num(p.eta, 0) + '</div><div class="s">hours (63.2% have failed)</div></div>' +
        '<div class="stat"><div class="k">Fit quality (R²)</div><div class="v">' + (p.source === 'fit' && isFinite(p.r2) ? fmt.num(p.r2, 3) : '–') + '</div><div class="s">' + (p.source === 'fit' && isFinite(p.r2) ? (p.r2 >= 0.95 ? 'very good' : (p.r2 >= 0.85 ? 'acceptable' : 'weak – add data')) : 'not applicable') + '</div></div>' +
        '<div class="stat"><div class="k">MTBF</div><div class="v">' + fmt.num(mean.mtbf, 0) + '</div><div class="s">hours between failures (from data)</div></div>' +
        '<div class="stat"><div class="k">Mean life (MTTF)</div><div class="v">' + fmt.num(mean2, 0) + '</div><div class="s">hours, from the model</div></div>' +
        '<div class="stat"><div class="k">B10 life</div><div class="v">' + fmt.num(b10, 0) + '</div><div class="s">hours – 1 in 10 fail by here</div></div></div></div>' +
        '<div class="callout ok" style="margin-top:16px">' + icon('info') + '<span><b>' + bm.kind + ' (β = ' + fmt.num(p.beta, 2) + ').</b> ' + bm.text + '</span></div>';
    } else if (failures < 3) {
      out += '<p class="hint" style="margin-top:12px">No model yet.</p>';
    }
    if (fit.ok) {
      out += '<div class="card chart-card" style="margin-top:16px;box-shadow:none"><h3>Weibull probability plot</h3><p class="hint">Each dot is one failure. If the dots follow the straight line, the Weibull model describes your data well.' +
        (comp.params && comp.params.source === 'manual' ? ' (The line shows the best fit to your records, not your hand-entered values.)' : '') + '</p><div class="chart-box"><canvas id="ch-prob" role="img" aria-label="Weibull probability plot with ' + fit.points.length + ' failure points and the fitted line"></canvas></div></div>';
    }
    return out;
  }

  function pageCalibration(id) {
    id = id || S.comps()[0].id;
    var comp = S.state.components[id], meta = S.meta(id);
    var recs = comp.records;
    var rows = recs.map(function (r, n) {
      return '<tr data-id="' + r.id + '"><td class="num">' + (n + 1) + '</td>' +
        '<td><input type="number" step="any" inputmode="decimal" min="0" data-rec="hours" aria-label="Operating hours, record ' + (n + 1) + '" value="' + clean(r.hours) + '"></td>' +
        '<td><select data-rec="type" aria-label="Record type, record ' + (n + 1) + '"><option value="failure"' + (r.type === 'failure' ? ' selected' : '') + '>Failure</option><option value="suspension"' + (r.type === 'suspension' ? ' selected' : '') + '>Suspension (still running)</option></select></td>' +
        '<td class="r"><button class="btn btn-ghost btn-danger btn-sm" data-act="del-rec" data-id="' + r.id + '" aria-label="Delete record ' + (n + 1) + '">' + icon('trash') + '<span class="sr-only">Delete</span></button></td></tr>';
    }).join('');
    var p = comp.params;
    return {
      title: 'Model Calibration',
      html: '<div class="page-title reveal"><h1>Model Calibration</h1><p>Turn your failure history into a wear-out model. Add the running hours at which parts failed, then press <b>Fit Weibull</b>.</p></div>' +
        '<div class="section reveal" style="--i:1">' + compTabs(id, 'calibration') + '</div>' +
        '<div class="section grid" style="gap:20px"><div class="card"><div class="section-head" style="margin-bottom:10px"><div><h3 style="font-size:var(--fs-lg)">Failure records – ' + esc(meta.name) + '</h3><p class="hint">A <b>failure</b> is a part that broke. A <b>suspension</b> is a part that was replaced or is still running without failing.</p></div></div>' +
        '<div class="table-wrap"><table><thead><tr><th>#</th><th>Operating hours</th><th>Type</th><th class="r"><span class="sr-only">Actions</span></th></tr></thead><tbody id="rec-body">' +
        (rows || '<tr><td colspan="4"><div class="empty" style="padding:18px">' + icon('data') + '<div>No records yet. Add the first one below.</div></div></td></tr>') + '</tbody></table></div>' +
        '<div class="field-row" style="margin-top:16px;align-items:end"><div class="field" style="margin:0"><label for="new-hours">Operating hours at failure</label><div class="input-wrap has-unit"><input id="new-hours" type="number" step="any" inputmode="decimal" min="0" aria-describedby="new-err"><span class="unit">h</span></div></div>' +
        '<div class="field" style="margin:0"><label for="new-type">Type</label><div class="input-wrap"><select id="new-type"><option value="failure">Failure</option><option value="suspension">Suspension (still running)</option></select></div></div></div>' +
        '<div class="err field" id="new-err" aria-live="polite" style="margin-top:6px"><div class="err"></div></div>' +
        '<div class="toolbar" style="margin-top:12px"><button class="btn btn-primary" data-act="add-rec">' + icon('plus') + 'Add record</button>' +
        '<label class="btn" for="csv-file" tabindex="0" role="button" data-act="csv-pick">' + icon('upload') + 'Import CSV</label><input type="file" id="csv-file" accept=".csv,text/csv" class="sr-only" tabindex="-1" aria-label="Choose a CSV file to import">' +
        '<label class="hint" style="display:inline-flex;align-items:center;gap:6px;min-height:44px"><input type="checkbox" id="csv-replace" style="width:20px;height:20px"> Replace existing records</label>' +
        '<button class="btn" data-act="export-csv">' + icon('download') + 'Export CSV</button></div>' +
        '<p class="hint" style="margin-top:10px">CSV columns: <span class="mono">hours,type</span> (type is <span class="mono">failure</span> or <span class="mono">suspension</span>). A single column of hours is treated as failures.</p></div>' +
        '<div class="card"><div class="section-head" style="margin-bottom:6px"><div><h3 style="font-size:var(--fs-lg)">Fit the model</h3><p class="hint">Uses Median Rank Regression (Johnson ranks for suspensions, Bernard\'s approximation). Needs at least 3 failures.</p></div><button class="btn btn-primary" data-act="fit">' + icon('bolt') + 'Fit Weibull</button></div>' +
        '<div id="fit-results" aria-live="polite">' + calibrationResults(id) + '</div>' +
        '<fieldset style="margin-top:20px;border-top:1px solid var(--line);padding-top:16px"><legend>Or enter the values by hand</legend><p class="hint" style="margin-bottom:10px">Use this if you have fewer than 3 failures but know the values from a manufacturer or past study.</p>' +
        '<div class="field-row"><div class="field"><label for="man-beta">Shape β</label><div class="input-wrap"><input id="man-beta" type="number" step="any" inputmode="decimal" value="' + (p ? String(Math.round(p.beta * 1000) / 1000) : '') + '" aria-describedby="man-err"></div><div class="help">Between 0.3 and 12. Above 1 means wear-out.</div></div>' +
        '<div class="field"><label for="man-eta">Scale η</label><div class="input-wrap has-unit"><input id="man-eta" type="number" step="any" inputmode="decimal" value="' + (p ? String(Math.round(p.eta * 10) / 10) : '') + '" aria-describedby="man-err"><span class="unit">h</span></div><div class="help">Between 10 and 1,000,000 hours.</div></div></div>' +
        '<div class="field" style="margin:0"><div class="err" id="man-err" aria-live="polite"></div></div>' +
        '<button class="btn" data-act="manual" style="margin-top:6px">Use these values</button></fieldset></div></div>',
      after: function () { drawProb(id, true); },
      dynamic: function () {
        var box = $('#fit-results'); if (!box) return;
        Ch.destroyAll(); box.innerHTML = calibrationResults(id); drawProb(id, false);
      }
    };
  }

  function drawProb(id, animate) {
    var fit = M.fitWeibullMRR(S.state.components[id].records);
    if (fit.ok && $('#ch-prob')) Ch.probabilityPlot('ch-prob', fit, { animate: animate });
  }

  /* ------------------------------------------------------------------ *
   *  Page: Maintenance Schedule
   * ------------------------------------------------------------------ */
  function typeTag(t) {
    var names = { replacement: 'Replacement', inspection: 'Inspection', lubrication: 'Lubrication', cleaning: 'Cleaning', check: 'Check' };
    return '<span class="tag"' + (t === 'replacement' ? ' style="font-weight:900"' : '') + '>' + names[t] + '</span>';
  }

  /** Short label for charts and timelines: "Sealer" for the heat sealing element, else the first word of the name. */
  function shortName(c) { return c.id === 'sealer' ? 'Sealer' : c.name.split(' ')[0]; }

  function scheduleBody() {
    if (ui.filter !== 'all' && !S.state.components[ui.filter]) ui.filter = 'all';
    var sched = Mo.buildSchedule(ui.all, S.state);
    var ev = sched.events.filter(function (e) { return ui.filter === 'all' || e.compId === ui.filter; });
    var months = Mo.groupByMonth(ev, sched.start);
    var timeline = months.map(function (m) {
      var rows = S.comps().filter(function (c) { return ui.filter === 'all' || c.id === ui.filter; }).map(function (c) {
        var list = m.byComp[c.id] || [], rep = list.filter(function (e) { return e.type === 'replacement'; }).length;
        return '<div class="tl-row"><span' + colourAttrs(c.id, 'sw') + '></span>' + esc(shortName(c)) + ': ' + list.length + (rep ? '<span class="tl-rep">replace</span>' : '') + '</div>';
      }).join('');
      return '<div class="tl-month"><h4>' + m.label + '</h4>' + rows + '</div>';
    }).join('');
    var table = ev.map(function (e) {
      var when = e.dueNow ? '<span class="bad-text">Due now</span>' : (e.offsetDays <= 0 ? 'Today' : 'in ' + fmt.days(e.offsetDays));
      return '<tr><td><b class="num">' + fmt.date(e.date) + '</b><div class="hint">' + when + '</div></td><td>' + tagHtml(e.compId) + '</td><td>' + esc(e.task) + '</td><td>' + typeTag(e.type) + '</td></tr>';
    }).join('');
    var allOk = S.comps().every(function (c) { return !ui.all[c.id].valid; });
    return { start: sched.start, count: ev.length,
      html: (allOk ? '<div class="callout warn">' + icon('info') + '<span>No plan yet: add failure data in Model Calibration first.</span></div>' : '') +
        '<div class="section"><div class="section-head"><div><h2>Month by month</h2><p>Number of planned jobs per month. “replace” marks a month with a part replacement.</p></div></div>' +
        '<div class="legend">' + S.comps().map(function (c) { return '<span><i' + colourAttrs(c.id, 'sw') + '></i>' + esc(shortName(c)) + '</span>'; }).join('') + '</div><div class="timeline">' + timeline + '</div></div>' +
        '<div class="section"><div class="section-head"><div><h2>Task list (' + ev.length + ' jobs)</h2></div></div><div class="table-wrap"><table><thead><tr><th>When</th><th>Component</th><th>Task</th><th>Type</th></tr></thead><tbody>' +
        (table || '<tr><td colspan="4"><div class="empty" style="padding:18px">No jobs to show.</div></td></tr>') + '</tbody></table></div></div>' };
  }

  function pageSchedule() {
    var b = scheduleBody();
    var filters = [['all', 'All parts']].concat(S.comps().map(function (c) { return [c.id, c.name]; }));
    return {
      title: 'Maintenance Schedule',
      html: '<div class="print-only print-head"><h1>SachetGuard PM – 12-Month Maintenance Schedule</h1><p>Development of a Predictive/Preventive Maintenance Model for Selected Components in Production Equipment – Makurdi sachet water plant</p><p>Machine: ' + esc(S.state.settings.machineName) + ' &nbsp;|&nbsp; Printed: ' + fmt.date(new Date()) + '</p></div>' +
        '<div class="page-title reveal no-print"><h1>Maintenance Schedule</h1><p>A 12-month plan built from the best replacement age and your working hours. Starts ' + fmt.date(b.start) + '.</p></div>' +
        '<div class="toolbar section no-print" style="justify-content:space-between"><div class="seg" role="group" aria-label="Filter by component">' + filters.map(function (f) {
          return '<button data-act="filter" data-v="' + f[0] + '" aria-pressed="' + (ui.filter === f[0]) + '" ' + (ui.filter === f[0] ? 'aria-current="true"' : '') + '>' + esc(f[1]) + '</button>';
        }).join('') + '</div><button class="btn btn-primary" data-act="print">' + icon('printer') + 'Print schedule</button></div>' +
        '<div id="sched-body">' + b.html + '</div>' +
        '<div class="section no-print"><details class="explain"><summary>' + icon('info').replace('<svg', '<svg width="22" height="22"') + ' How is this plan created?</summary><div class="steps">' +
        '<div class="step"><h4>1. A part needs a fitted model</h4><div class="working">Only parts with a Weibull model (from Model Calibration) get jobs. A part with no model is skipped.</div></div>' +
        '<div class="step"><h4>2. Routine jobs repeat by running hours</h4><div class="working">Each part has its own routine jobs (inspection, lubrication, cleaning, checks) with an interval in running hours. The first one falls due when the part\'s running hours next reach a multiple of that interval, then it repeats. Change the intervals in <a href="#/settings">Settings → Routine task intervals</a>.</div></div>' +
        '<div class="step"><h4>3. Replacement comes from the model</h4><div class="working">The first replacement is due when the part\'s condition-adjusted age reaches its best replacement age (T*, or B10 when no cheapest age exists). It then repeats every T* ÷ ageing factor running hours. Hot or shaky parts therefore get earlier replacements.</div></div>' +
        '<div class="step"><h4>4. Hours become calendar dates</h4><div class="working">days = hours ÷ operating hours per day × 7 ÷ working days per week, counted from today, for 12 months. Set your working pattern in Settings.</div></div>' +
        '</div></details></div>',
      dynamic: function () { var box = $('#sched-body'); if (box) box.innerHTML = scheduleBody().html; }
    };
  }

  /* ------------------------------------------------------------------ *
   *  Page: Cost Comparison
   * ------------------------------------------------------------------ */
  function costResults() {
    var cmp = Mo.costComparison(ui.all, S.state);
    if (!cmp.rows.length) return '<div class="callout warn">' + icon('info') + '<span>No cost comparison yet: add failure data in Model Calibration first.</span></div>';
    var t = cmp.total;
    var notes = cmp.rows.filter(function (r) { return r.note; }).map(function (r) {
      return '<div class="callout warn" style="margin-top:10px">' + icon('info') + '<span><b>' + esc(r.name) + ':</b> ' + esc(r.note) + '</span></div>';
    }).join('');
    return '<div class="cost-cards"><div class="cost-card reactive"><div class="k">Today: run until it breaks</div><div class="v">' + fmt.naira(t.reactive) + '</div><div class="s">per month in repairs and lost production · about ' + fmt.num(t.failR, 2) + ' breakdowns a month</div></div>' +
      '<div class="cost-card proposed"><div class="k">Proposed: planned replacement</div><div class="v">' + fmt.naira(t.proposed) + '</div><div class="s">per month · about ' + fmt.num(t.failP, 2) + ' unplanned breakdowns a month</div></div></div>' +
      '<div class="card" style="margin-top:16px"><div class="stat-grid three"><div class="stat"><div class="k">Monthly saving</div><div class="v ' + (t.savings >= 0 ? 'ok-text' : 'bad-text') + '">' + fmt.naira(t.savings) + '</div><div class="s">' + fmt.pct(t.savingsPct, 1) + ' lower cost</div></div>' +
      '<div class="stat"><div class="k">Saved in 12 months</div><div class="v">' + fmt.naira(cmp.months[11]) + '</div><div class="s">projected</div></div>' +
      '<div class="stat"><div class="k">Breakdowns avoided</div><div class="v">' + fmt.num(t.reduction, 2) + '</div><div class="s">per month (' + fmt.num(t.reduction * 12, 1) + ' a year)</div></div></div>' +
      '<p class="hint" style="margin-top:12px">Based on ' + fmt.num(cmp.monthlyHours, 0) + ' running hours per month (' + S.state.settings.hoursPerDay + ' h/day, ' + S.state.settings.daysPerWeek + ' days/week).</p></div>' + notes +
      '<div class="grid cols-2" style="margin-top:16px">' +
      chartCard('ch-bars', 'Monthly cost, side by side', 'Red is what breakdowns cost now. Teal is the planned-replacement cost.', 'Bar chart comparing reactive and proposed monthly cost for each component.') +
      chartCard('ch-cum', 'Savings over 12 months', 'Money kept in the business month after month.', 'Line chart of cumulative savings over 12 months reaching ' + fmt.naira(cmp.months[11]) + '.') + '</div>' +
      '<div class="section"><div class="table-wrap"><table><thead><tr><th>Part</th><th class="r">Run to failure</th><th class="r">Planned</th><th class="r">Saved</th><th class="r">Saved %</th><th class="r">Breakdowns/month</th></tr></thead><tbody>' +
      cmp.rows.map(function (r) {
        return '<tr><td>' + tagHtml(r.id) + '</td><td class="r num">' + fmt.naira(r.reactive) + '</td><td class="r num">' + fmt.naira(r.proposed) + '</td><td class="r num ' + (r.savings >= 0 ? 'ok-text' : 'bad-text') + '">' + fmt.naira(r.savings) + '</td><td class="r num">' + fmt.pct(r.savingsPct, 1) + '</td><td class="r num">' + fmt.num(r.failR, 2) + ' → ' + fmt.num(r.failP, 2) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  function costInputs(id) {
    var c = S.state.components[id].costs, b = 'components.' + id + '.costs.', a = ui.all[id];
    return '<div class="card"><h3>' + esc(S.meta(id).name) + '</h3>' +
      numField({ path: b + 'repair', label: 'Repair cost after a breakdown', unit: '₦', min: 0, max: 1e8, value: c.repair }) +
      numField({ path: b + 'downtimeH', label: 'Downtime per breakdown', unit: 'h', min: 0, max: 1000, value: c.downtimeH }) +
      numField({ path: b + 'lostPerHour', label: 'Lost production per hour', unit: '₦/h', min: 0, max: 1e7, value: c.lostPerHour }) +
      numField({ path: b + 'partCost', label: 'New part cost (planned)', unit: '₦', min: 0, max: 1e8, value: c.partCost }) +
      numField({ path: b + 'labour', label: 'Labour (planned)', unit: '₦', min: 0, max: 1e8, value: c.labour }) +
      numField({ path: b + 'plannedDowntimeH', label: 'Downtime for planned replacement', unit: 'h', min: 0, max: 1000, value: c.plannedDowntimeH }) +
      '<div class="stat-grid cost-derived"><div class="stat"><div class="k">Breakdown cost</div><div class="v" data-cf="' + id + '">' + fmt.naira(Mo.failureCost(c)) + '</div><div class="s">Cf = repair + lost production</div></div><div class="stat"><div class="k">Planned cost</div><div class="v" data-cp="' + id + '">' + fmt.naira(Mo.plannedCost(c)) + '</div><div class="s">Cp = part + labour + short stop</div></div></div></div>';
  }

  function drawCostCharts(animate) {
    var cmp = Mo.costComparison(ui.all, S.state);
    if (!cmp.rows.length || !$('#ch-bars')) return;
    Ch.costBars('ch-bars', cmp, { animate: animate });
    Ch.cumulative('ch-cum', cmp, { animate: animate });
  }

  function pageCost() {
    return {
      title: 'Cost Comparison',
      html: '<div class="page-title reveal"><h1>Cost Comparison</h1><p>What breakdowns cost you now, against replacing parts on a plan. Change any figure to see the effect.</p></div>' +
        '<div class="section reveal" id="cost-results" style="--i:1">' + costResults() + '</div>' +
        '<div class="section"><div class="section-head"><div><h2>Edit the cost figures</h2><p>Use your own prices. The cost of a breakdown is the repair plus the production you lose while the line is stopped.</p></div></div>' +
        '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))">' + S.comps().map(function (c) { return costInputs(c.id); }).join('') + '</div></div>',
      after: function () { drawCostCharts(true); },
      dynamic: function () {
        var box = $('#cost-results'); if (!box) return;
        Ch.destroyAll(); box.innerHTML = costResults(); drawCostCharts(false);
        S.comps().forEach(function (c) {
          var cf = $('[data-cf="' + c.id + '"]'), cp = $('[data-cp="' + c.id + '"]');
          if (cf) cf.textContent = fmt.naira(Mo.failureCost(S.state.components[c.id].costs));
          if (cp) cp.textContent = fmt.naira(Mo.plannedCost(S.state.components[c.id].costs));
        });
      }
    };
  }

  /* ------------------------------------------------------------------ *
   *  Page: Validation
   * ------------------------------------------------------------------ */
  /** Format a stored YYYY-MM-DD date for display, or an en dash when there is none. */
  function showDate(d) { return d ? fmt.date(new Date(d + 'T00:00:00')) : '–'; }
  /** Sort by date (oldest first, undated last), then by hours. */
  function byDate(x, y) {
    if (x.date && y.date) return x.date < y.date ? -1 : (x.date > y.date ? 1 : x.hours - y.hours);
    if (x.date) return -1;
    if (y.date) return 1;
    return 0;
  }

  function validationResults() {
    var v = Mo.validate(S.state.validation, ui.all);
    if (!v.total) return '<div class="callout warn">' + icon('info') + '<span>Add at least one real failure to test the model. You also need a fitted model for the part.</span></div>';
    var body = '';
    S.comps().forEach(function (c) {
      var rows = v.rows.filter(function (r) { return r.comp === c.id; }).sort(function (x, y) { return byDate({ date: x.date, hours: x.actual }, { date: y.date, hours: y.actual }); });
      if (!rows.length) return;
      var hit = rows.filter(function (r) { return r.prevented; }).length;
      body += '<tr class="grp"><td colspan="7">' + tagHtml(c.id) + '<span class="grp-sum">' + rows.length + ' failure' + (rows.length === 1 ? '' : 's') + ' tested · ' + hit + ' prevented</span></td></tr>';
      rows.forEach(function (r) {
        var msg = 'Model would have replaced at ' + fmt.num(r.replaceAt) + ' h; actual failure at ' + fmt.num(r.actual) + ' h – failure ' + (r.prevented ? 'prevented' : 'not prevented') + '.' +
          (r.prevented ? ' ' + fmt.pct(r.unusedPct, 0) + ' of the part\'s life was left unused.' : '');
        body += '<tr><td class="num">' + (r.date ? '<b>' + esc(showDate(r.date)) + '</b>' : '<span class="muted">No date</span>') + '</td>' +
          '<td>' + (r.note ? '<span class="val-note">' + esc(r.note) + '</span>' : '<span class="val-note muted">No note</span>') + '</td>' +
          '<td class="r num">' + fmt.num(r.actual) + ' h</td>' +
          '<td class="r num">' + fmt.num(r.replaceAt) + ' h<span class="sub">' + r.basis + '</span></td>' +
          '<td class="r num ' + (r.prevented ? 'ok-text' : 'bad-text') + '">' + (r.margin >= 0 ? '+' : '−') + fmt.num(Math.abs(r.margin)) + ' h</td>' +
          '<td>' + (r.prevented ? '<span class="pill green">' + icon('check') + 'Prevented</span>' : '<span class="pill red">' + icon('octagon') + 'Missed</span>') + '</td>' +
          '<td class="val-msg">' + esc(msg) + '</td></tr>';
      });
    });
    return '<div class="stat-grid three"><div class="stat"><div class="k">Failures tested</div><div class="v">' + v.total + '</div><div class="s">historical failures entered</div></div>' +
      '<div class="stat"><div class="k">Prevented</div><div class="v ok-text">' + v.hits + '</div><div class="s">model would have replaced in time</div></div>' +
      '<div class="stat"><div class="k">Hit rate</div><div class="v">' + fmt.pct(v.rate, 0) + '</div><div class="s">' + v.hits + ' of ' + v.total + ' prevented</div></div></div>' +
      '<div class="table-wrap" style="margin-top:16px"><table class="val-table"><colgroup><col style="width:11%"><col style="width:17%"><col style="width:11%"><col style="width:13%"><col style="width:10%"><col style="width:12%"><col style="width:26%"></colgroup>' +
      '<thead><tr><th>Date</th><th>Note</th><th class="r">Actual failure</th><th class="r">Model replaces at</th><th class="r">Margin</th><th>Result</th><th>What it means</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="callout" style="margin-top:16px">' + icon('info') + '<span>Margin = actual failure age minus the age the model recommends replacing. Positive means the part would have been changed before it failed. Failures used to build the model are a self-check; for a fair test, enter failures that were not used for fitting.</span></div>';
  }

  function pageValidation() {
    var rows = S.state.validation.slice().sort(byDate).map(function (r) {
      return '<tr><td class="num">' + (r.date ? esc(showDate(r.date)) : '<span class="muted">No date</span>') + '</td><td>' + tagHtml(r.comp) + '</td><td class="r num">' + fmt.num(r.hours) + ' h</td><td>' + (esc(r.note) || '<span class="muted">–</span>') + '</td><td class="r"><button class="btn btn-ghost btn-danger btn-sm" data-act="del-val" data-id="' + r.id + '" aria-label="Delete historical failure">' + icon('trash') + '</button></td></tr>';
    }).join('');
    return {
      title: 'Validation',
      html: '<div class="page-title reveal"><h1>Validation</h1><p>Would the model have prevented real breakdowns? Enter past failures and compare when the model says to replace with when the part actually failed.</p></div>' +
        '<div class="section reveal" style="--i:1"><div class="card" id="val-results">' + validationResults() + '</div></div>' +
        '<div class="section val-grid">' +
        '<div class="card"><div class="section-head" style="margin-bottom:12px"><div><h2>Historical failures</h2><p>Actual breakdowns you have recorded.</p></div></div>' +
        '<div class="table-wrap"><table class="hist-table"><colgroup><col style="width:19%"><col style="width:27%"><col style="width:16%"><col style="width:26%"><col style="width:12%"></colgroup><thead><tr><th>Date</th><th>Part</th><th class="r">Failed at</th><th>Note</th><th class="r"><span class="sr-only">Actions</span></th></tr></thead><tbody>' + (rows || '<tr><td colspan="5"><div class="empty" style="padding:18px">No historical failures yet.</div></td></tr>') + '</tbody></table></div></div>' +
        '<div class="card"><div class="section-head" style="margin-bottom:12px"><div><h2>Add a failure</h2><p>Enter the age of the part when it broke.</p></div></div>' +
        '<div class="field"><label for="v-comp">Part</label><div class="input-wrap"><select id="v-comp">' + S.comps().map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="field"><label for="v-date">Date of failure (optional)</label><div class="input-wrap"><input id="v-date" type="date" max="' + S.today() + '" aria-describedby="v-err"></div><div class="help">The day the part broke down. Leave empty if unknown.</div></div>' +
        '<div class="field"><label for="v-hours">Operating hours at failure</label><div class="input-wrap has-unit"><input id="v-hours" type="number" step="any" inputmode="decimal" min="0"><span class="unit">h</span></div></div>' +
        '<div class="field"><label for="v-note">Note (optional)</label><div class="input-wrap"><input id="v-note" type="text" maxlength="80" placeholder="e.g. bearing seized in March"></div></div>' +
        '<div class="field"><div class="err" id="v-err" aria-live="polite"></div></div>' +
        '<button class="btn btn-primary" data-act="add-val">' + icon('plus') + 'Add historical failure</button></div></div>'
    };
  }

  /* ------------------------------------------------------------------ *
   *  Page: Settings
   * ------------------------------------------------------------------ */
  /** One settings row: label and help on the left, a numeric input on the right. */
  function setRow(o) {
    var id = 'f-' + o.path.replace(/\./g, '-'), scale = o.scale || 1;
    return '<div class="set-row"><div class="set-label"><label for="' + id + '">' + (o.tag ? tagHtml(o.tag) : '') + esc(o.label) + '</label>' +
      (o.help ? '<span class="set-help" id="' + id + '-help">' + esc(o.help) + '</span>' : '') + '</div>' +
      '<div class="field set-field"><div class="input-wrap' + (o.unit ? ' has-unit' : '') + '"><input id="' + id + '" type="number" inputmode="decimal" step="any" data-path="' + o.path + '" data-min="' + o.min + '" data-max="' + o.max +
      '" data-scale="' + scale + '" data-unit="' + esc(o.unit || '') + '" value="' + clean(o.value * scale) + '" aria-describedby="' + id + '-err' + (o.help ? ' ' + id + '-help' : '') + '">' +
      (o.unit ? '<span class="unit" aria-hidden="true">' + esc(o.unit) + '</span>' : '') + '</div><div class="err" id="' + id + '-err" aria-live="polite"></div></div></div>';
  }

  /** A compact numeric cell (visually hidden label) used inside the vibration table. */
  function setCell(o) {
    var id = 'f-' + o.path.replace(/\./g, '-');
    return '<div class="field set-field"><label class="sr-only" for="' + id + '">' + esc(o.label) + '</label><div class="input-wrap has-unit"><input id="' + id + '" type="number" inputmode="decimal" step="any" data-path="' + o.path +
      '" data-min="' + o.min + '" data-max="' + o.max + '" data-scale="1" data-unit="' + esc(o.unit) + '" value="' + clean(o.value) + '" aria-describedby="' + id + '-err"><span class="unit" aria-hidden="true">' + esc(o.unit) + '</span></div>' +
      '<div class="err" id="' + id + '-err" aria-live="polite"></div></div>';
  }

  function setCard(id, ico, title, desc, body, assume) {
    return '<section class="set-card" id="set-' + id + '" aria-labelledby="set-' + id + '-t"><header class="set-head"><span class="set-ico">' + icon(ico) + '</span>' +
      '<div class="set-head-text"><h2 id="set-' + id + '-t">' + title + '</h2><p>' + desc + '</p></div>' +
      (assume ? '<span class="assumption">Engineering assumptions – cite source</span>' : '') + '</header><div class="set-body">' + body + '</div></section>';
  }

  function dataSummary() {
    var st = S.state, f = 0, su = 0;
    S.comps().forEach(function (c) { c.records.forEach(function (r) { if (r.type === 'failure') f++; else su++; }); });
    var kb = Math.max(1, Math.round(JSON.stringify(st).length / 1024));
    return '<div class="stat-grid four">' +
      '<div class="stat"><div class="k">Failure records</div><div class="v">' + f + '</div><div class="s">' + su + ' suspension' + (su === 1 ? '' : 's') + '</div></div>' +
      '<div class="stat"><div class="k">Historical failures</div><div class="v">' + st.validation.length + '</div><div class="s">used for validation</div></div>' +
      '<div class="stat"><div class="k">Data type</div><div class="v" style="font-size:var(--fs-md)">' + (st.isSample ? 'Sample data' : 'Your data') + '</div><div class="s">' + (st.isSample ? 'replace with field data' : 'entered by you') + '</div></div>' +
      '<div class="stat"><div class="k">Storage</div><div class="v" style="font-size:var(--fs-md)">' + (S.storageOK ? 'Saved on device' : 'Not saved') + '</div><div class="s">' + kb + ' KB used</div></div></div>';
  }

  function monthlyBlock() {
    var s = S.state.settings, mh = Mo.monthlyHours(s);
    return '<div class="set-derived" id="set-monthly"><div><span class="k">Running hours per week</span><b class="num">' + fmt.num(s.hoursPerDay * s.daysPerWeek, 0) + ' h</b></div>' +
      '<div><span class="k">Per month</span><b class="num">' + fmt.num(mh, 0) + ' h</b></div><div><span class="k">Per year</span><b class="num">' + fmt.num(mh * 12, 0) + ' h</b></div></div>';
  }

  var SET_SECTIONS = [['machine', 'Machine and hours', 'settings'], ['health', 'Health status limits', 'shield'], ['vibration', 'Vibration zones', 'bolt'],
    ['temperature', 'Temperature limits', 'sealer'], ['intervals', 'Task intervals', 'calendar'], ['appearance', 'Appearance', 'screen'], ['data', 'Data and backup', 'data']];

  function pageSettings() {
    var s = S.state.settings, p = 'settings.', v = s.vibration, t = s.temperature, h = s.health;
    var themePref = S.getPref('theme'), themeNow = (themePref === 'light' || themePref === 'dark') ? themePref : 'system';
    var present = document.body.classList.contains('presentation');

    var machine =
      '<div class="set-row wide"><div class="set-label"><label for="machine-name">Machine name</label><span class="set-help">Shown on the dashboard and on printed schedules.</span></div>' +
      '<div class="field set-field"><div class="input-wrap"><input id="machine-name" type="text" maxlength="60" value="' + esc(s.machineName) + '"></div></div></div>' +
      setRow({ path: p + 'hoursPerDay', label: 'Operating hours per day', help: 'Hours the machine runs on a working day.', unit: 'h/day', min: 1, max: 24, value: s.hoursPerDay }) +
      setRow({ path: p + 'daysPerWeek', label: 'Working days per week', help: 'Used to turn running hours into calendar days.', unit: 'days', min: 1, max: 7, value: s.daysPerWeek }) +
      '<div class="set-row"><div class="set-label"><label for="currency">Currency symbol</label><span class="set-help">Shown before money amounts. Default ₦ (Naira).</span></div>' +
      '<div class="field set-field"><div class="input-wrap"><input id="currency" type="text" maxlength="3" value="' + esc(s.currency) + '"></div></div></div>' +
      monthlyBlock();

    var health =
      '<p class="set-intro">A part turns <span class="pill yellow">' + icon('eye') + 'Monitor</span> or <span class="pill red">' + icon('octagon') + 'Critical</span> when any one of these limits is reached.</p>' +
      setRow({ path: p + 'health.greenFrac', label: 'Monitor: share of life used', help: 'Monitor once the part has used this much of its recommended life (T* or B10).', unit: '%', min: 10, max: 99, scale: 100, value: h.greenFrac }) +
      setRow({ path: p + 'health.greenP200', label: 'Monitor: chance of failing in 200 h', help: 'Monitor once the chance of failing within the next 200 running hours reaches this.', unit: '%', min: 1, max: 90, scale: 100, value: h.greenP200 }) +
      setRow({ path: p + 'health.redP200', label: 'Critical: chance of failing in 200 h', help: 'Critical once the chance of failing within the next 200 running hours reaches this.', unit: '%', min: 2, max: 99, scale: 100, value: h.redP200 });

    function zone(letter, name, note, when, upperPath, upperVal) {
      return '<div class="zone-row zone-' + letter + '"><div class="zone-name"><span class="zone-badge">' + letter + '</span><div><b>' + name + '</b><span>' + note + '</span></div></div>' +
        '<div class="zone-when"><span class="zone-lab">Velocity</span>' + when + '</div>' +
        '<div class="zone-cell"><span class="zone-lab">Upper limit</span>' + (upperPath ? setCell({ path: upperPath, label: 'Zone ' + letter + ' upper limit', unit: 'mm/s', min: 0.1, max: 100, value: upperVal }) : '<span class="zone-none">No upper limit</span>') + '</div>' +
        '<div class="zone-cell"><span class="zone-lab">Ageing multiplier</span>' + setCell({ path: p + 'vibration.multipliers.' + letter, label: 'Zone ' + letter + ' ageing multiplier', unit: '×', min: 1, max: 10, value: v.multipliers[letter] }) + '</div></div>';
    }
    var vib = '<p class="set-intro">Velocity (mm/s RMS) decides the zone. A higher zone makes the part age faster, which brings its replacement date forward. Zone D always turns the part Critical.</p>' +
      '<div class="zone-table" role="group" aria-label="Vibration zones"><div class="zone-head" aria-hidden="true"><span>Zone</span><span>Applies when velocity is</span><span>Upper limit</span><span>Ageing multiplier</span></div>' +
      zone('A', 'Good', 'Newly commissioned machine', 'below the limit', p + 'vibration.bounds.A', v.bounds.A) +
      zone('B', 'Acceptable', 'Fine for long-term running', 'up to the limit', p + 'vibration.bounds.B', v.bounds.B) +
      zone('C', 'Unsatisfactory', 'Limited period only', 'up to the limit', p + 'vibration.bounds.C', v.bounds.C) +
      zone('D', 'Unacceptable', 'Damage is likely', 'at or above zone C limit', null, 0) + '</div>';

    var temp =
      '<div class="set-group"><h3><span class="comp-ico sm">' + icon('motor') + '</span>Electric motor</h3>' +
      setRow({ path: p + 'temperature.motor.rated', label: 'Rated temperature', help: 'Above this, motor life halves for every 10 °C.', unit: '°C', min: 20, max: 200, value: t.motor.rated }) +
      setRow({ path: p + 'temperature.motor.alarm', label: 'Alarm temperature', help: 'At or above this the motor is Critical.', unit: '°C', min: 30, max: 250, value: t.motor.alarm }) + '</div>' +
      '<div class="set-group"><h3><span class="comp-ico sm">' + icon('bearing') + '</span>Bearing</h3>' +
      setRow({ path: p + 'temperature.bearing.warn', label: 'Warning temperature', help: 'Bearing starts to age faster from here.', unit: '°C', min: 20, max: 200, value: t.bearing.warn }) +
      setRow({ path: p + 'temperature.bearing.warnK', label: 'Ageing multiplier at warning', help: 'How much faster it ages at the warning temperature.', unit: '×', min: 1, max: 10, value: t.bearing.warnK }) +
      setRow({ path: p + 'temperature.bearing.alarm', label: 'Alarm temperature', help: 'At or above this the bearing is Critical.', unit: '°C', min: 30, max: 250, value: t.bearing.alarm }) +
      setRow({ path: p + 'temperature.bearing.alarmK', label: 'Ageing multiplier at alarm', help: 'How much faster it ages at the alarm temperature.', unit: '×', min: 1, max: 10, value: t.bearing.alarmK }) + '</div>' +
      '<div class="set-group"><h3><span class="comp-ico sm">' + icon('sealer') + '</span>Heat sealing element</h3>' +
      setRow({ path: p + 'temperature.sealer.setpoint', label: 'Setpoint', help: 'The jaw temperature the machine is set to hold.', unit: '°C', min: 50, max: 400, value: t.sealer.setpoint }) +
      setRow({ path: p + 'temperature.sealer.tolerance', label: 'Allowed band (±)', help: 'No extra ageing while within this band around the setpoint.', unit: '°C', min: 0, max: 100, value: t.sealer.tolerance }) +
      setRow({ path: p + 'temperature.sealer.kPerDeg', label: 'Extra ageing per °C outside the band', help: 'Added to the multiplier for every degree beyond the band.', unit: 'per °C', min: 0, max: 1, value: t.sealer.kPerDeg }) +
      setRow({ path: p + 'temperature.sealer.alarmDev', label: 'Alarm deviation (±)', help: 'At or beyond this distance from the setpoint the element is Critical.', unit: '°C', min: 1, max: 200, value: t.sealer.alarmDev }) + '</div>' +
      '<div class="set-group"><h3><span class="comp-ico sm">' + icon('general') + '</span>Other parts</h3>' +
      setRow({ path: p + 'temperature.general.warn', label: 'Warning temperature', help: 'Parts of type “Other part” start to age faster from here.', unit: '°C', min: 20, max: 300, value: t.general.warn }) +
      setRow({ path: p + 'temperature.general.warnK', label: 'Ageing multiplier at warning', help: 'How much faster they age at the warning temperature.', unit: '×', min: 1, max: 10, value: t.general.warnK }) +
      setRow({ path: p + 'temperature.general.alarm', label: 'Alarm temperature', help: 'At or above this the part is Critical.', unit: '°C', min: 30, max: 400, value: t.general.alarm }) +
      setRow({ path: p + 'temperature.general.alarmK', label: 'Ageing multiplier at alarm', help: 'How much faster they age at the alarm temperature.', unit: '×', min: 1, max: 10, value: t.general.alarmK }) + '</div>';

    var intervals = '<p class="set-intro">How often each routine job repeats, counted in running hours. These feed the 12-month Maintenance Schedule. Each part has its own jobs.</p>' + S.comps().map(function (c) {
      return (c.tasks || []).map(function (tk, n) {
        return setRow({ path: 'components.' + c.id + '.tasks.' + n + '.interval', label: tk.task, tag: c.id, unit: 'h', min: 10, max: 20000, value: tk.interval });
      }).join('');
    }).join('');

    var appearance =
      '<div class="set-row"><div class="set-label"><span class="lab">Theme</span><span class="set-help">Follow your device, or force light or dark.</span></div>' +
      '<div class="seg" role="group" aria-label="Theme">' + [['system', 'Device'], ['light', 'Light'], ['dark', 'Dark']].map(function (o) {
        return '<button type="button" data-act="theme-set" data-v="' + o[0] + '" aria-pressed="' + (themeNow === o[0]) + '"' + (themeNow === o[0] ? ' aria-current="true"' : '') + '>' + o[1] + '</button>';
      }).join('') + '</div></div>' +
      '<div class="set-row"><div class="set-label"><span class="lab">Presentation mode</span><span class="set-help">Larger text and charts, for a projector.</span></div>' +
      '<div class="seg" role="group" aria-label="Presentation mode">' + [['0', 'Off'], ['1', 'On']].map(function (o) {
        var on = (o[0] === '1') === present;
        return '<button type="button" data-act="present-set" data-v="' + o[0] + '" aria-pressed="' + on + '"' + (on ? ' aria-current="true"' : '') + '>' + o[1] + '</button>';
      }).join('') + '</div></div>';

    var data = dataSummary() + (S.state.isSample ? '<div class="callout warn" style="margin-top:16px">' + icon('info') + '<span>You are using the built-in sample data. Reset it, or overwrite it with your own records.</span></div>' : '') +
      (S.storageOK ? '' : '<div class="callout warn" style="margin-top:16px">' + icon('alert') + '<span>This browser is blocking local storage, so your changes will be lost when you close the page. Use “Back up data” to save a file.</span></div>') +
      '<div class="set-actions">' +
      '<div class="set-row"><div class="set-label"><span class="lab">Back up your data</span><span class="set-help">Downloads one JSON file with all records, costs, settings and validation entries.</span></div><button class="btn" data-act="backup">' + icon('download') + 'Back up data</button></div>' +
      '<div class="set-row"><div class="set-label"><span class="lab">Restore from a backup</span><span class="set-help">Replaces the data on this device with the contents of a backup file.</span></div><span><label class="btn" for="restore-file" tabindex="0" role="button" data-act="restore-pick">' + icon('upload') + 'Restore backup</label><input type="file" id="restore-file" accept=".json,application/json" class="sr-only" tabindex="-1" aria-label="Choose a backup file to restore"></span></div>' +
      '<div class="set-row"><div class="set-label"><span class="lab">Load sample data</span><span class="set-help">Replaces everything with the demonstration data.</span></div><button class="btn" data-act="load-sample">' + icon('data') + 'Load sample data</button></div></div>' +
      '<div class="danger-zone"><div class="set-row"><div class="set-label"><span class="lab">Reset all data</span><span class="set-help">Permanently deletes every record and cost figure on this device and restores default settings. Back up first.</span></div><button class="btn btn-danger" data-act="reset">' + icon('trash') + 'Reset all data</button></div></div>';

    var nav = '<nav class="settings-nav" aria-label="Settings sections">' + SET_SECTIONS.map(function (x) {
      return '<button type="button" data-act="set-scroll" data-target="set-' + x[0] + '">' + icon(x[2]) + '<span>' + x[1] + '</span></button>';
    }).join('') + '</nav>';

    return {
      title: 'Settings',
      html: '<div class="page-title reveal"><h1>Settings</h1><p>Set up the machine, tune the limits the model uses, and manage your data. Changes save automatically on this device.</p></div>' +
        '<div class="settings-layout section">' + nav + '<div class="settings-body">' +
        setCard('machine', 'settings', 'Machine and working hours', 'Basic details used throughout the app.', machine) +
        setCard('health', 'shield', 'Health status limits', 'When a part is flagged Monitor or Critical.', health, true) +
        setCard('vibration', 'bolt', 'Vibration zones', 'ISO 10816-style severity zones for the motor and bearing.', vib, true) +
        setCard('temperature', 'sealer', 'Temperature limits', 'Heat ages parts faster. Set the limits for each component.', temp, true) +
        setCard('intervals', 'calendar', 'Routine task intervals', 'Spacing of inspections, lubrication and cleaning.', intervals) +
        setCard('appearance', 'screen', 'Appearance', 'Display preferences for this device.', appearance) +
        setCard('data', 'data', 'Data and backup', 'Your records live in this browser. Back them up before clearing it.', data) +
        '</div></div>',
      after: function () {
        var mn = $('#machine-name'), cu = $('#currency');
        mn.addEventListener('input', function () { S.state.settings.machineName = mn.value.trim() || 'My machine'; S.save(); });
        cu.addEventListener('input', function () { S.state.settings.currency = cu.value.trim() || '₦'; fmt.symbol = S.state.settings.currency; S.save(); });
        if (ui.spy) ui.spy.disconnect();
        if (root.IntersectionObserver) {
          ui.spy = new root.IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
              if (!en.isIntersecting) return;
              $$('.settings-nav button').forEach(function (b) {
                if (b.getAttribute('data-target') === en.target.id) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
              });
            });
          }, { rootMargin: '-20% 0px -65% 0px' });
          $$('.set-card').forEach(function (c) { ui.spy.observe(c); });
        }
        var first = $('.settings-nav button'); if (first) first.setAttribute('aria-current', 'true');
      },
      dynamic: function () { var m = $('#set-monthly'); if (m) m.outerHTML = monthlyBlock(); }
    };
  }

  /* ------------------------------------------------------------------ *
   *  Page: About / How it works
   * ------------------------------------------------------------------ */
  function pageAbout() {
    function item(t, d) { return '<div class="card"><h3>' + t + '</h3><p class="hint" style="margin-top:6px;font-size:var(--fs-md)">' + d + '</p></div>'; }
    return {
      title: 'How It Works',
      html: '<div class="page-title reveal"><h1>How It Works</h1><p>SachetGuard PM helps you replace parts at the right time: not too early, and not after they have already broken the line.</p></div>' +
        '<div class="section"><div class="section-head"><h2>What each result means</h2></div><div class="grid cols-2">' +
        item('Status light', '<b>Healthy</b> means no action needed. <b>Monitor</b> means plan a replacement soon. <b>Critical</b> means act now. Every light also has a word and an icon, so you never rely on colour alone.') +
        item('Remaining life', 'How many more running hours (and calendar days) the part is expected to last, given how worn it is and how hot and shaky it is running.') +
        item('Failure chance', 'The chance the part breaks in the next 100, 200 or 500 hours, knowing it has survived until now.') +
        item('Schedule', 'A 12-month list of checks, greasing, cleaning and replacements, worked out from your working hours. You can print it.') +
        item('Cost comparison', 'What breakdowns cost you every month, against what planned replacements would cost. The difference is your saving.') +
        item('Validation', 'A test of the model against failures that really happened: would replacing on plan have stopped them?') + '</div></div>' +
        '<div class="section"><div class="section-head"><h2>Where the numbers come from</h2></div><div class="grid cols-2">' +
        item('Average time between failures (MTBF)', 'Add up all running hours and divide by the number of failures. Think of a bicycle tyre: if you get a puncture every 2,000 km on average, that is its MTBF. It is a good start, but it ignores whether the tyre is new or old.') +
        item('Wear-out model (Weibull)', 'Real parts get more likely to fail as they age. The Weibull model captures this with two numbers: how fast the risk rises (shape) and the typical life (scale). An old tyre is much more likely to burst than a new one.') +
        item('Condition-adjusted age', 'A motor running hot or a bearing that vibrates ages faster, like a car driven hard. We multiply the real hours by an ageing factor to get an “effective age”. For example, a motor 10 °C over its rating ages twice as fast.') +
        item('Best replacement age', 'Changing oil too early wastes money; too late wrecks the engine. We compare the cost of a planned change with the cost of a breakdown and find the age with the lowest cost per hour. If parts do not wear out, or breakdowns are cheap, no such age exists and the app says so.') +
        item('Remaining life', 'We average how much longer parts of this age usually last. Because hot or shaky running speeds up wear, we divide by the ageing factor to give real running hours.') + '</div></div>' +
        '<div class="section"><div class="section-head"><h2>What to keep in mind</h2></div><div class="card"><ul class="hint" style="font-size:var(--fs-md);padding-left:20px;margin:0;display:grid;gap:8px">' +
        '<li>The sample data is for demonstration. Replace it with your own factory records.</li>' +
        '<li>With only a few failures, the model is rough. Add more records as they happen and refit.</li>' +
        '<li>Limits for vibration and temperature are engineering assumptions. Check them against your machine’s manuals.</li>' +
        '<li>The model assumes a new part is as good as the last one. It cannot predict sudden events such as a power surge.</li>' +
        '<li>Results are only as good as the readings you enter. Measure the same way each time.</li>' +
        '<li>This tool supports your judgement; it does not replace it. If something looks or sounds wrong, inspect it.</li></ul></div></div>'
    };
  }

  /* ------------------------------------------------------------------ *
   *  Routing, chrome, rendering
   * ------------------------------------------------------------------ */
  var PAGES = {
    dashboard: function () { return pageDashboard(); },
    component: function (arg, sub) { return S.state.components[arg] ? pageComponent(arg, sub) : null; },
    calibration: function (arg) { return pageCalibration(curId(arg)); },
    schedule: function () { return pageSchedule(); },
    cost: function () { return pageCost(); },
    validation: function () { return pageValidation(); },
    settings: function () { return pageSettings(); },
    about: function () { return pageAbout(); }
  };

  /** The component a page is about: the id in the URL if it exists, else the first component. */
  function curId(arg) {
    if (arg === undefined) arg = route().arg;
    return S.state.components[arg] ? arg : S.comps()[0].id;
  }

  /** Parse the current location hash into {name, arg}. */
  function route() {
    var h = (root.location.hash || '').replace(/^#\/?/, '');
    var parts = h.split('/');
    return { name: parts[0] || 'dashboard', arg: parts[1] || '', sub: parts[2] || '' };
  }

  function navHtml() {
    var main = [['dashboard', 'Dashboard', 'home']];
    var items = main.map(function (m) { return '<a href="#/' + m[0] + '" data-nav="' + m[0] + '">' + icon(m[2]) + '<span>' + m[1] + '</span></a>'; }).join('');
    items += '<div class="nav-head"><div class="nav-label" id="nav-comps-label">Components</div>' +
      '<button class="nav-add" type="button" data-act="comp-add" aria-label="Add component" title="Add component">' + icon('plus') + '</button></div>' +
      '<div class="nav-comps" id="nav-comps" role="group" aria-labelledby="nav-comps-label"></div>';
    items += '<div class="nav-label">Tools</div>' + [['calibration', 'Model Calibration', 'data'], ['schedule', 'Maintenance Schedule', 'calendar'], ['cost', 'Cost Comparison', 'coin'], ['validation', 'Validation', 'shield']].map(function (m) {
      return '<a href="#/' + m[0] + '" data-nav="' + m[0] + '">' + icon(m[2]) + '<span>' + m[1] + '</span></a>';
    }).join('');
    items += '<div class="nav-label">App</div>' + [['settings', 'Settings', 'settings'], ['about', 'How It Works', 'info']].map(function (m) {
      return '<a href="#/' + m[0] + '" data-nav="' + m[0] + '">' + icon(m[2]) + '<span>' + m[1] + '</span></a>';
    }).join('');
    return items;
  }

  var navSig = '';
  /** Rebuild the sidebar component list in priority order; slide items to their new place. */
  function renderNavComps() {
    var box = $('#nav-comps');
    if (!box || !ui.all) return;
    var order = ordered();
    var sig = order.map(function (id) { return id + ':' + ui.all[id].status + ':' + S.meta(id).name + ':' + Mo.kindOf(S.meta(id)); }).join('|');
    if (sig === navSig) return;
    var before = {};
    $$('a[data-nav]', box).forEach(function (a) { before[a.getAttribute('data-nav')] = a.getBoundingClientRect().top; });
    navSig = sig;
    box.innerHTML = order.map(function (id) {
      var st = ui.all[id].status;
      return '<a href="#/component/' + id + '" data-nav="component/' + id + '">' + compIcon(id) + '<span>' + esc(S.meta(id).name) + '</span>' +
        '<i class="dot ' + st + '" aria-hidden="true"></i><span class="sr-only">' + Mo.statusLabel(st) + '</span></a>';
    }).join('');
    var calm = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm) return;
    var moved = [];
    $$('a[data-nav]', box).forEach(function (a) {
      var was = before[a.getAttribute('data-nav')];
      if (was === undefined) return;
      var dy = was - a.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) return;
      a.style.transition = 'none';
      a.style.transform = 'translateY(' + dy + 'px)';
      moved.push(a);
    });
    if (!moved.length) return;
    box.getBoundingClientRect();
    moved.forEach(function (a) {
      a.style.transition = 'transform .35s var(--ease)';
      a.style.transform = '';
      setTimeout(function () { a.style.transition = ''; }, 380);
    });
  }

  function updateChrome() {
    renderNavComps();
    var r = route();
    var key = r.name + (r.name === 'component' ? '/' + r.arg : '');
    $$('.nav a').forEach(function (a) { if (a.getAttribute('data-nav') === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    var tabMap = { dashboard: 'dashboard', component: 'dashboard', calibration: 'calibration', schedule: 'schedule', cost: 'cost' };
    $$('.tabbar a').forEach(function (a) {
      if (a.getAttribute('data-tab') === tabMap[r.name]) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var more = $('#tab-more'); if (more) { if (!tabMap[r.name]) more.setAttribute('aria-current', 'page'); else more.removeAttribute('aria-current'); }
    var banner = $('#sample-banner');
    if (banner) banner.hidden = !S.state.isSample;
    var dark = isDark();
    var tb = $('#btn-theme');
    if (tb) { tb.innerHTML = icon(dark ? 'sun' : 'moon'); tb.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'); }
    var pb = $('#btn-present'); if (pb) pb.setAttribute('aria-pressed', String(document.body.classList.contains('presentation')));
  }

  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return !!(root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  /**
   * Render the page for the current route.
   * @param {{keepScroll?:boolean, skeleton?:boolean}} [opts]
   */
  U.render = function (opts) {
    opts = opts || {};
    fmt.symbol = S.state.settings.currency || '₦';
    ui.all = Mo.analyseAll(S.state);
    var r = route();
    var page = (PAGES[r.name] || PAGES.dashboard)(r.arg, r.sub);
    if (!page) { root.location.hash = '#/dashboard'; return; }
    Ch.destroyAll();
    ui.current = page;
    document.title = page.title + ' – SachetGuard PM';
    if (opts.skeleton && r.name === 'dashboard') {
      main.innerHTML = skeletonHtml();
      main.setAttribute('aria-busy', 'true');
      setTimeout(function () { main.removeAttribute('aria-busy'); U.render({}); }, 380);
      updateChrome();
      return;
    }
    var y = root.scrollY;
    main.innerHTML = page.html;
    if (page.after) page.after(main);
    updateChrome();
    if (opts.keepScroll) root.scrollTo(0, y);
    else { root.scrollTo(0, 0); if (ui.booted) main.focus({ preventScroll: true }); }
    ui.booted = true;
    renderDemo();
  };

  /** Called when stored data changes. */
  function onChange(why) {
    ui.all = Mo.analyseAll(S.state);
    if (why === 'structure') { U.render({ keepScroll: true }); return; }
    if (ui.current && ui.current.dynamic) ui.current.dynamic();
    updateChrome();
  }

  /* ------------------------------------------------------------------ *
   *  Guided demo
   * ------------------------------------------------------------------ */
  var DEMO = [
    { hash: '#/dashboard', text: 'Start on the Dashboard. Each part has a status light, remaining life, the chance of failing soon and a plain recommendation.' },
    { hash: '#/component/bearing', text: 'Open a part. The purple “You are here” marker shows where it sits on the wear-out curve. “How was this calculated?” shows every formula with real numbers.' },
    { hash: '#/calibration/bearing', text: 'Model Calibration turns failure records into the wear-out model (β and η) using Median Rank Regression.' },
    { hash: '#/schedule', text: 'The 12-month maintenance plan is built automatically from the best replacement age and your working hours. It can be printed.' },
    { hash: '#/cost', text: 'Cost Comparison: planned replacement against running until breakdown, in Naira per month.' },
    { hash: '#/validation', text: 'Validation: would the model have prevented real historical failures? The hit rate answers that.' }
  ];

  /** Demo step URL; the bearing example falls back to the first part if the bearing was deleted. */
  function demoHash(i) {
    var h = DEMO[i].hash;
    return S.state.components.bearing ? h : h.replace('/bearing', '/' + S.comps()[0].id);
  }

  function renderDemo() {
    var box = $('#demo-caption');
    if (!box) return;
    if (ui.demo < 0) { box.hidden = true; box.innerHTML = ''; return; }
    var d = DEMO[ui.demo], last = ui.demo === DEMO.length - 1;
    box.hidden = false;
    box.innerHTML = '<div class="demo-progress" aria-hidden="true">' + DEMO.map(function (_, i) { return '<i class="' + (i <= ui.demo ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
      '<div class="step-n">Guided demo · step ' + (ui.demo + 1) + ' of ' + DEMO.length + '</div><p>' + esc(d.text) + '</p>' +
      '<div class="toolbar"><button class="btn" data-act="demo-exit">Exit</button><span style="display:flex;gap:8px"><button class="btn" data-act="demo-back"' + (ui.demo === 0 ? ' disabled' : '') + '>' + icon('left') + 'Back</button><button class="btn btn-primary" data-act="demo-next">' + (last ? 'Finish' : 'Next') + (last ? '' : icon('right')) + '</button></span></div>';
  }

  function demoGo(i) {
    ui.demo = i;
    if (i >= 0 && root.location.hash !== demoHash(i)) root.location.hash = demoHash(i); else renderDemo();
    if (i < 0) renderDemo();
  }

  /* ------------------------------------------------------------------ *
   *  Event handling
   * ------------------------------------------------------------------ */
  function setTheme(mode) {
    if (mode) document.documentElement.setAttribute('data-theme', mode);
    S.setPref('theme', mode);
    U.render({ keepScroll: true });
  }

  function validNumber(el, lo, hi) {
    var n = Number(el.value);
    return el.value.trim() !== '' && isFinite(n) && n >= lo && n <= hi;
  }

  function onClick(e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    var r = route();
    var cid = curId(r.arg);
    if (act === 'csv-pick' || act === 'restore-pick') return; // label opens the file dialog natively
    if (act === 'print') { root.print(); return; }
    if (act === 'set-scroll') {
      var tgt = document.getElementById(t.getAttribute('data-target'));
      if (tgt) { tgt.scrollIntoView({ behavior: 'smooth', block: 'start' }); $$('.settings-nav button').forEach(function (b) { b.removeAttribute('aria-current'); }); t.setAttribute('aria-current', 'true'); }
      return;
    }
    if (act === 'theme-set') { var m = t.getAttribute('data-v'); if (m === 'system') { document.documentElement.removeAttribute('data-theme'); S.setPref('theme', 'system'); U.render({ keepScroll: true }); } else setTheme(m); return; }
    if (act === 'present-set') {
      var on = t.getAttribute('data-v') === '1';
      document.body.classList.toggle('presentation', on); S.setPref('presentation', on ? '1' : '0');
      U.render({ keepScroll: true }); return;
    }
    if (act === 'limits-own') { S.setOwnLimits(cid, true); return; }
    if (act === 'limits-default') { S.setOwnLimits(cid, false); return; }
    if (act === 'task-add') {
      var tn = $('#new-task'), ti = $('#new-task-iv'), te = $('#new-task-err');
      if (!tn.value.trim()) { te.textContent = 'Give the task a name.'; tn.focus(); return; }
      if (!validNumber(ti, 10, 20000)) { te.textContent = 'The interval must be between 10 and 20,000 running hours.'; ti.focus(); return; }
      S.addTask(cid, { task: tn.value, type: $('#new-task-type').value, interval: Number(ti.value) });
      U.toast('Task added');
      return;
    }
    if (act === 'task-del') { S.deleteTask(cid, t.getAttribute('data-id')); U.toast('Task removed'); return; }
    if (act === 'comp-add') { addComponentFlow(); return; }
    if (act === 'comp-edit') { editComponentFlow(curId(r.arg)); return; }
    if (act === 'comp-delete') { deleteComponentFlow(curId(r.arg)); return; }
    if (act === 'filter') { ui.filter = t.getAttribute('data-v'); U.render({ keepScroll: true }); return; }
    if (act === 'add-rec') { addRecordFromForm(cid); return; }
    if (act === 'del-rec') { S.deleteRecord(cid, t.getAttribute('data-id')); U.toast('Record deleted'); return; }
    if (act === 'fit') {
      var comp = S.state.components[cid], res = S.refitInto(comp);
      if (res.ok) {
        delete ui.fitWarn[cid];
        S.commit('structure');
        U.toast('Weibull model fitted: β = ' + fmt.num(res.beta, 2) + ', η = ' + fmt.num(res.eta, 0) + ' h');
      } else {
        ui.fitWarn[cid] = res.message;
        U.render({ keepScroll: true });
        U.toast(res.message, 'bad');
      }
      return;
    }
    if (act === 'manual') {
      var b = $('#man-beta'), n = $('#man-eta'), me = $('#man-err');
      if (!validNumber(b, 0.3, 12)) { me.textContent = 'Shape β must be a number between 0.3 and 12.'; b.focus(); return; }
      if (!validNumber(n, 10, 1e6)) { me.textContent = 'Scale η must be a number between 10 and 1,000,000 hours.'; n.focus(); return; }
      delete ui.fitWarn[cid];
      S.setManualParams(cid, Number(b.value), Number(n.value));
      U.toast('Model set from your values');
      return;
    }
    if (act === 'export-csv') {
      download('sachetguard-' + cid + '-records.csv', S.recordsToCSV(cid), 'text/csv');
      U.toast('CSV exported');
      return;
    }
    if (act === 'add-val') {
      var vh = $('#v-hours'), ve = $('#v-err');
      if (!validNumber(vh, 0.000001, 1e6)) { ve.textContent = 'Enter the operating hours at failure as a positive number.'; vh.focus(); return; }
      var vd = $('#v-date').value;
      if (vd && vd > S.today()) { ve.textContent = 'The date cannot be in the future.'; $('#v-date').focus(); return; }
      S.addValidation($('#v-comp').value, Number(vh.value), $('#v-note').value.trim(), vd);
      U.toast('Historical failure added');
      return;
    }
    if (act === 'del-val') { S.deleteValidation(t.getAttribute('data-id')); U.toast('Removed'); return; }
    if (act === 'load-sample') {
      confirmDialog('Load sample data?', 'This replaces all your records, costs and settings with the demonstration data.', 'Load sample data').then(function (ok) {
        if (ok) { S.loadSample(); U.toast('Sample data loaded'); }
      });
      return;
    }
    if (act === 'reset') {
      confirmDialog('Reset all data?', 'This permanently deletes every record, cost figure and setting on this device. Back up first if you may need them.', 'Delete everything').then(function (ok) {
        if (ok) { S.resetAll(); ui.fitWarn = {}; U.toast('All data reset'); }
      });
      return;
    }
    if (act === 'backup') {
      download('sachetguard-backup-' + S.today() + '.json', S.exportJSON(), 'application/json');
      U.toast('Backup downloaded');
      return;
    }
    if (act === 'demo-next') { if (ui.demo >= DEMO.length - 1) demoGo(-1); else demoGo(ui.demo + 1); return; }
    if (act === 'demo-back') { demoGo(Math.max(0, ui.demo - 1)); return; }
    if (act === 'demo-exit') { demoGo(-1); return; }
  }

  function addComponentFlow() {
    componentDialog(null).then(function (res) {
      if (!res) return;
      var id = S.addComponent(res);
      U.toast(res.name + ' added. Add its failure records to build a model.');
      root.location.hash = '#/calibration/' + id;
    });
  }

  function editComponentFlow(id) {
    var c = S.state.components[id];
    if (!c) return;
    componentDialog(c).then(function (res) {
      if (!res) return;
      S.updateComponent(id, res);
      U.toast('Changes saved');
    });
  }

  function deleteComponentFlow(id) {
    var c = S.state.components[id];
    if (!c) return;
    var val = S.state.validation.filter(function (v) { return v.comp === id; }).length;
    var detail = c.records.length + ' failure record' + (c.records.length === 1 ? '' : 's') + (val ? ' and ' + val + ' historical failure' + (val === 1 ? '' : 's') : '');
    confirmDialog('Delete ' + c.name + '?', 'This permanently removes the part, its ' + detail + ', its readings, costs and model. It will leave the sidebar, schedule and cost comparison. This cannot be undone.', 'Delete part').then(function (ok) {
      if (!ok) return;
      var res = S.deleteComponent(id);
      U.toast(res.ok ? c.name + ' deleted' : res.message, res.ok ? undefined : 'bad');
      if (res.ok && route().name === 'component') root.location.hash = '#/dashboard';
    });
  }

  function addRecordFromForm(cid) {
    var h = $('#new-hours'), type = $('#new-type').value, err = $('#new-err .err');
    if (!validNumber(h, 0.000001, 1e6)) { err.textContent = 'Enter the operating hours as a positive number (up to 1,000,000).'; h.setAttribute('aria-invalid', 'true'); h.focus(); return; }
    S.addRecord(cid, Number(h.value), type);
    U.toast('Record added');
    var nh = $('#new-hours'); if (nh) nh.focus();
  }

  function onChangeEvt(e) {
    var el = e.target;
    if (el.matches('[data-rec]')) {
      var tr = el.closest('tr'), id = tr.getAttribute('data-id'), cid = curId();
      var comp = S.state.components[cid], rec = comp.records.filter(function (x) { return x.id === id; })[0];
      if (el.getAttribute('data-rec') === 'hours') {
        if (!validNumber(el, 0.000001, 1e6)) { U.toast('Hours must be a positive number.', 'bad'); el.value = clean(rec.hours); return; }
        S.updateRecord(cid, id, { hours: Number(el.value) });
      } else S.updateRecord(cid, id, { type: el.value });
      return;
    }
    if (el.matches('[data-task]')) {
      var row = el.closest('.task-row');
      var patch = {}; patch[el.getAttribute('data-task')] = el.value;
      S.updateTask(curId(), row.getAttribute('data-tid'), patch);
      return;
    }
    if (el.matches('[data-part]')) {
      var pk = el.getAttribute('data-part'), pid = curId(), pc = S.state.components[pid];
      if (pk === 'description') { pc.description = el.value.trim().slice(0, 600); S.save(); }
      else if (pk === 'source') S.setLimitsSource(pid, el.value);
      return;
    }
    if (el.id === 'csv-file' && el.files && el.files[0]) {
      var rep = $('#csv-replace').checked, cid2 = curId(), file = el.files[0];
      var rd = new FileReader();
      rd.onload = function () {
        var res = S.importRecordsCSV(String(rd.result), cid2, rep);
        U.toast(res.message + (res.skipped.length ? ' First issue: ' + res.skipped[0] + '.' : ''), res.ok ? undefined : 'bad');
      };
      rd.onerror = function () { U.toast('Could not read that file.', 'bad'); };
      rd.readAsText(file);
      el.value = '';
      return;
    }
    if (el.id === 'restore-file' && el.files && el.files[0]) {
      var rd2 = new FileReader();
      rd2.onload = function () {
        var res = S.importJSON(String(rd2.result));
        U.toast(res.message, res.ok ? undefined : 'bad');
      };
      rd2.readAsText(el.files[0]);
      el.value = '';
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && e.target.id === 'new-hours') { e.preventDefault(); addRecordFromForm(curId()); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('label[role="button"]')) { e.preventDefault(); e.target.click(); }
    if (e.key === 'Escape') {
      var sheet = $('#more-sheet');
      if (sheet && !sheet.hidden) closeSheet();
      else if (ui.demo >= 0) demoGo(-1);
    }
  }

  function openSheet() {
    var sh = $('#more-sheet');
    sh.hidden = false;
    $('#sheet-links', sh).innerHTML = ordered().map(function (id) { return '<a href="#/component/' + id + '">' + compIcon(id) + esc(S.meta(id).name) + '</a>'; }).join('') +
      '<a href="#/validation">' + icon('shield') + 'Validation</a><a href="#/settings">' + icon('settings') + 'Settings</a><a href="#/about">' + icon('info') + 'How It Works</a>' +
      '<a href="#/dashboard" data-act-sheet="demo">' + icon('play') + 'Start guided demo</a>';
    var f = $('a', sh); if (f) f.focus();
  }
  function closeSheet() { var sh = $('#more-sheet'); sh.hidden = true; var m = $('#tab-more'); if (m) m.focus(); }

  /** Wire up the static page chrome and global listeners. */
  U.init = function () {
    main = $('#main');
    $('#nav').innerHTML = navHtml();
    $('#nav').addEventListener('click', onClick);
    S.subscribe(onChange);
    main.addEventListener('input', onFieldInput);
    main.addEventListener('click', onClick);
    main.addEventListener('change', onChangeEvt);
    document.addEventListener('keydown', onKey);
    $('#demo-caption').addEventListener('click', onClick);

    var theme = S.getPref('theme');
    if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme);
    if (S.getPref('presentation') === '1') document.body.classList.add('presentation');

    $('#btn-theme').addEventListener('click', function () { setTheme(isDark() ? 'light' : 'dark'); });
    $('#btn-present').addEventListener('click', function () {
      var on = document.body.classList.toggle('presentation');
      S.setPref('presentation', on ? '1' : '0');
      U.toast(on ? 'Presentation mode on: larger text and charts' : 'Presentation mode off');
      U.render({ keepScroll: true });
    });
    $('#btn-demo').addEventListener('click', function () { demoGo(ui.demo >= 0 ? -1 : 0); });
    $('#tab-more').addEventListener('click', openSheet);
    $('#more-sheet').addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (e.target === $('#more-sheet') || a) {
        if (a && a.getAttribute('data-act-sheet') === 'demo') { ui.demo = 0; }
        closeSheetQuiet();
        if (a && a.getAttribute('data-act-sheet') === 'demo') { root.location.hash = demoHash(0); renderDemo(); }
      }
      if (e.target.closest('[data-close]')) closeSheet();
    });
    if (root.matchMedia) {
      var mq = root.matchMedia('(prefers-color-scheme: dark)');
      var h = function () { if (!document.documentElement.getAttribute('data-theme')) U.render({ keepScroll: true }); };
      if (mq.addEventListener) mq.addEventListener('change', h);
    }
  };
  function closeSheetQuiet() { $('#more-sheet').hidden = true; }

  /** Render the current route. */
  U.start = function () { U.render({ skeleton: true }); };

})(typeof window !== 'undefined' ? window : globalThis);
