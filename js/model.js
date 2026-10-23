/**
 * @file model.js
 * Component models for SachetGuard PM: condition factors, effective age, health
 * status, remaining life, maintenance schedule, cost comparison, validation and
 * the step-by-step "How was this calculated?" explanations.
 * Depends on PM.math. No DOM access.
 */
(function (root) {
  'use strict';

  var PM = root.PM = root.PM || {};
  var M = PM.math;
  var Mo = PM.model = {};

  /* ------------------------------------------------------------------ *
   *  Formatting helpers (shared by model, ui and charts)
   * ------------------------------------------------------------------ */
  var fmt = PM.fmt = {};

  /** Format a number with thousands separators and a fixed number of decimals. */
  fmt.num = function (n, d) {
    if (n === null || n === undefined || !isFinite(n)) return '–';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  };
  /** Format an amount in Naira, e.g. ₦35,000. */
  fmt.symbol = '₦';
  fmt.naira = function (n) {
    if (n === null || n === undefined || !isFinite(n)) return '–';
    var r = Math.round(n);
    return (r < 0 ? '−' : '') + fmt.symbol + Math.abs(r).toLocaleString('en-US');
  };
  /** Format a probability (0..1) as a percentage. */
  fmt.pct = function (p, d) {
    if (p === null || p === undefined || !isFinite(p)) return '–';
    return (p * 100).toFixed(d === undefined ? 0 : d) + '%';
  };
  /** Format hours, e.g. "1,420 h". */
  fmt.hours = function (h, d) { return fmt.num(h, d || 0) + ' h'; };
  /** Format a day count in plain language. */
  fmt.days = function (d) {
    if (d === null || d === undefined || !isFinite(d)) return '–';
    if (d < 1) return 'less than a day';
    var r = Math.round(d);
    return r + (r === 1 ? ' day' : ' days');
  };
  /** Format a Date as 05 Oct 2026. */
  fmt.date = function (d) {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  /** Escape text for safe insertion into HTML. */
  fmt.esc = function (s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ------------------------------------------------------------------ *
   *  Component metadata and defaults
   * ------------------------------------------------------------------ */

  /** Part types. The type decides the temperature rule and the routine tasks of a component. */
  Mo.KINDS = {
    motor: { label: 'Electric motor', part: 'motor', vibration: true, tempC: 70,
      costs: { repair: 85000, downtimeH: 8, lostPerHour: 15000, partCost: 60000, labour: 8000, plannedDowntimeH: 2 } },
    bearing: { label: 'Bearing system', part: 'bearing', vibration: true, tempC: 60,
      costs: { repair: 45000, downtimeH: 6, lostPerHour: 15000, partCost: 12000, labour: 5000, plannedDowntimeH: 1 } },
    sealer: { label: 'Heat sealing element', part: 'sealing element', vibration: false, tempC: 160,
      costs: { repair: 35000, downtimeH: 4, lostPerHour: 15000, partCost: 8000, labour: 3000, plannedDowntimeH: 0.5 } },
    general: { label: 'Other part', part: 'part', vibration: true, tempC: 50,
      costs: { repair: 40000, downtimeH: 4, lostPerHour: 15000, partCost: 10000, labour: 4000, plannedDowntimeH: 1 } }
  };

  /** The three parts the app starts with (also used for the sample data). */
  Mo.COMPONENTS = [
    { id: 'motor', name: 'Electric Motor', part: 'motor', kind: 'motor' },
    { id: 'bearing', name: 'Bearing System', part: 'bearing', kind: 'bearing' },
    { id: 'sealer', name: 'Heat Sealing Element', part: 'sealing element', kind: 'sealer' }
  ];

  /** @returns {{id:string,name:string,part:string,kind:string}} metadata of a built-in component id (fallback only). */
  Mo.meta = function (id) {
    for (var i = 0; i < Mo.COMPONENTS.length; i++) if (Mo.COMPONENTS[i].id === id) return Mo.COMPONENTS[i];
    return { id: id, name: id, part: id, kind: 'general' };
  };

  /** Type key for a component record (or id): its own kind, else the built-in id, else "general". */
  Mo.kindOf = function (comp) {
    if (comp && Mo.KINDS[comp.kind]) return comp.kind;
    return comp && Mo.KINDS[comp.id] ? comp.id : 'general';
  };

  /**
   * Starting values for a part's own temperature limits, taken from the shared limits of its type.
   * The own-limits rule is the warning/alarm rule: k = warnK from T_warn, alarmK from T_alarm, else 1.
   * @param {object} comp Component record.
   * @param {object} s Settings.
   * @returns {{warn:number, alarm:number, warnK:number, alarmK:number}}
   */
  Mo.startingLimits = function (comp, s) {
    var kind = Mo.kindOf(comp), t = s.temperature[kind];
    if (kind === 'motor') return { warn: t.rated, alarm: t.alarm, warnK: 1.2, alarmK: 1.6 };
    if (kind === 'sealer') return { warn: t.setpoint + t.tolerance, alarm: t.setpoint + t.alarmDev, warnK: 1.2, alarmK: 1.6 };
    return { warn: t.warn, alarm: t.alarm, warnK: t.warnK, alarmK: t.alarmK };
  };

  /** True when the limits object is usable: warn < alarm and multipliers of at least 1. */
  Mo.validLimits = function (l) {
    return !!l && isFinite(l.warn) && isFinite(l.alarm) && l.warn < l.alarm && l.warnK >= 1 && l.alarmK >= 1;
  };

  /** Temperature factor for a component: its own limits when set, else the shared limits of its type. */
  Mo.temperatureFor = function (comp, T, s) {
    if (Mo.validLimits(comp.tempLimits)) return Mo.temperatureFactor('general', T, { temperature: { general: comp.tempLimits } });
    return Mo.temperatureFactor(Mo.kindOf(comp), T, s);
  };

  /** True when vibration is measured for this component. */
  Mo.usesVibration = function (comp) {
    return comp && typeof comp.vibration === 'boolean' ? comp.vibration : Mo.KINDS[Mo.kindOf(comp)].vibration;
  };

  /** Default routine intervals (running hours) for each task key. */
  Mo.DEFAULT_INTERVALS = { motorCheck: 500, bearingInspect: 250, bearingLube: 500, sealerClean: 100, sealerCheck: 250, generalCheck: 250 };

  /** Routine task templates per part type. Each component gets its own copy with an editable interval. */
  Mo.TASKS = {
    motor: [{ key: 'motorCheck', task: 'Insulation and temperature check', type: 'check' }],
    bearing: [
      { key: 'bearingInspect', task: 'Vibration and noise inspection', type: 'inspection' },
      { key: 'bearingLube', task: 'Lubricate bearings', type: 'lubrication' }
    ],
    sealer: [
      { key: 'sealerClean', task: 'Clean sealing jaws', type: 'cleaning' },
      { key: 'sealerCheck', task: 'Check heating element and thermostat', type: 'check' }
    ],
    general: [{ key: 'generalCheck', task: 'Routine inspection', type: 'inspection' }]
  };

  /** Fresh task list for a part type: [{id, task, type, interval}]. */
  Mo.defaultTasks = function (kind, legacy) {
    return (Mo.TASKS[kind] || Mo.TASKS.general).map(function (t) {
      var iv = legacy && legacy[t.key] > 0 ? Number(legacy[t.key]) : Mo.DEFAULT_INTERVALS[t.key];
      return { id: t.key, task: t.task, type: t.type, interval: iv };
    });
  };

  /**
   * Default settings. All thresholds and multipliers are engineering assumptions
   * that must be cited in the project report (they are editable in Settings).
   */
  Mo.defaultSettings = function () {
    return {
      machineName: 'Sachet Filling & Sealing Machine 1',
      hoursPerDay: 12,
      daysPerWeek: 6,
      currency: '₦',
      vibration: {
        bounds: { A: 0.71, B: 1.8, C: 4.5 },
        multipliers: { A: 1.0, B: 1.1, C: 1.4, D: 2.0 }
      },
      temperature: {
        motor: { rated: 75, alarm: 100 },
        bearing: { warn: 70, alarm: 85, warnK: 1.2, alarmK: 1.6 },
        sealer: { setpoint: 160, tolerance: 5, kPerDeg: 0.02, alarmDev: 30 },
        general: { warn: 70, alarm: 90, warnK: 1.2, alarmK: 1.6 }
      },
      health: { greenFrac: 0.7, greenP200: 0.10, redP200: 0.30 }
    };
  };

  /**
   * Empty component record with sensible default inputs and cost figures.
   * @param {string} id Component id.
   * @param {{name?:string, kind?:string, part?:string, vibration?:boolean}} [opts]
   */
  Mo.defaultComponent = function (id, opts) {
    opts = opts || {};
    var kind = Mo.KINDS[opts.kind] ? opts.kind : (Mo.KINDS[id] ? id : 'general');
    var k = Mo.KINDS[kind], built = Mo.meta(id);
    var name = opts.name || (Mo.KINDS[id] ? built.name : k.label);
    return {
      id: id,
      name: name,
      kind: kind,
      part: opts.part || (Mo.KINDS[id] ? built.part : name),
      vibration: typeof opts.vibration === 'boolean' ? opts.vibration : k.vibration,
      description: opts.description || '',
      tempLimits: null,
      limitsSource: '',
      params: null,
      records: [],
      inputs: { hoursSince: 0, tempC: k.tempC, vibMms: 0.5, lastMaint: '' },
      costs: Object.assign({}, k.costs),
      tasks: Mo.defaultTasks(kind)
    };
  };

  /* ------------------------------------------------------------------ *
   *  Condition factors and effective age
   * ------------------------------------------------------------------ */

  /**
   * Vibration severity zone (ISO 10816-style) and life multiplier.
   * Zones: A (v < bA), B (< bB), C (< bC), D (>= bC).  k_vib = multiplier of the zone.
   * @param {number} v Vibration velocity, mm/s RMS.
   * @param {object} s Settings.
   * @returns {{zone:string, k:number, label:string}}
   */
  Mo.vibrationZone = function (v, s) {
    var b = s.vibration.bounds, m = s.vibration.multipliers, z;
    if (!isFinite(v)) z = 'A';
    else if (v < b.A) z = 'A';
    else if (v < b.B) z = 'B';
    else if (v < b.C) z = 'C';
    else z = 'D';
    var labels = { A: 'Zone A – Good', B: 'Zone B – Acceptable', C: 'Zone C – Unsatisfactory', D: 'Zone D – Unacceptable' };
    return { zone: z, k: m[z], label: labels[z] };
  };

  /**
   * Temperature life multiplier and alarm flag.
   * Motor:   k = 2^((T - T_rated)/10) for T > T_rated, else 1   (10 degC rule for insulation life)
   * Bearing and other parts: k = warnK for T >= T_warn, alarmK for T >= T_alarm, else 1
   * Sealer:  k = 1 + kPerDeg * max(0, |T - T_set| - tolerance)
   * @param {string} id Part type ("motor", "bearing", "sealer" or "general"); an unknown id is treated as "general".
   * @param {number} T Measured temperature, degC.
   * @param {object} s Settings.
   * @returns {{k:number, alarm:boolean, note:string}}
   */
  Mo.temperatureFactor = function (id, T, s) {
    if (!Mo.KINDS[id]) id = 'general';
    var t = s.temperature[id];
    if (!isFinite(T)) return { k: 1, alarm: false, note: 'No temperature entered.' };
    if (id === 'motor') {
      var k = T > t.rated ? Math.pow(2, (T - t.rated) / 10) : 1;
      return { k: k, alarm: T >= t.alarm, note: T > t.rated ? 'Above rated temperature by ' + fmt.num(T - t.rated, 1) + ' °C.' : 'Within rated temperature.' };
    }
    if (id === 'bearing' || id === 'general') {
      var who = id === 'bearing' ? 'bearing' : 'part';
      if (T >= t.alarm) return { k: t.alarmK, alarm: true, note: 'At or above the ' + who + ' alarm temperature.' };
      if (T >= t.warn) return { k: t.warnK, alarm: false, note: 'Above the ' + who + ' warning temperature.' };
      return { k: 1, alarm: false, note: 'Within normal ' + who + ' temperature.' };
    }
    var dev = Math.abs(T - t.setpoint);
    var excess = Math.max(0, dev - t.tolerance);
    return {
      k: 1 + t.kPerDeg * excess,
      alarm: dev >= t.alarmDev,
      note: dev <= t.tolerance ? 'Within the allowed band around the setpoint.' : 'Off the setpoint by ' + fmt.num(dev, 1) + ' °C.'
    };
  };

  /**
   * Effective age with condition adjustment.
   * Equation:  t_eff = t * k_temp * k_vib
   * @param {number} t Hours since last replacement.
   * @param {number} kTemp Temperature multiplier.
   * @param {number} kVib Vibration multiplier.
   * @returns {number} Effective age in hours.
   */
  Mo.effectiveAge = function (t, kTemp, kVib) { return t * kTemp * kVib; };

  /* ------------------------------------------------------------------ *
   *  Component analysis
   * ------------------------------------------------------------------ */

  var optCache = {};
  /** Cached call to the (comparatively slow) cost optimiser. */
  function cachedOptimum(beta, eta, Cp, Cf) {
    var key = [beta, eta, Cp, Cf].join('|');
    if (!optCache[key]) {
      var keys = Object.keys(optCache);
      if (keys.length > 200) optCache = {};
      optCache[key] = M.optimalReplacementAge(beta, eta, Cp, Cf);
    }
    return optCache[key];
  }

  /**
   * MTBF from the recorded data: total operating hours (failures and suspensions)
   * divided by the number of failures. Falls back to the Weibull MTTF when there
   * are no failure records (e.g. manually entered parameters).
   * @param {object} comp Component record.
   * @returns {{mtbf:number, totalHours:number, failures:number, source:string}}
   */
  Mo.mtbfOf = function (comp) {
    var total = 0, failures = 0;
    (comp.records || []).forEach(function (r) {
      if (r.hours > 0) { total += r.hours; if (r.type === 'failure') failures++; }
    });
    if (failures > 0) return { mtbf: M.mtbf(total, failures), totalHours: total, failures: failures, source: 'data' };
    if (comp.params) return { mtbf: M.weibullMTTF(comp.params.beta, comp.params.eta), totalHours: NaN, failures: 0, source: 'weibull' };
    return { mtbf: NaN, totalHours: total, failures: 0, source: 'none' };
  };

  /** Failure cost Cf = repair + downtime hours x lost production per hour. */
  Mo.failureCost = function (c) { return c.repair + c.downtimeH * c.lostPerHour; };
  /** Planned cost Cp = part + labour + planned downtime hours x lost production per hour. */
  Mo.plannedCost = function (c) { return c.partCost + c.labour + c.plannedDowntimeH * c.lostPerHour; };

  /** Monthly operating hours = hours/day x days/week x 52 / 12. */
  Mo.monthlyHours = function (s) { return s.hoursPerDay * s.daysPerWeek * 52 / 12; };

  /**
   * Full analysis of one component. Returns every number the UI needs.
   * @param {object} comp Component record (params, records, inputs, costs).
   * @param {object} s Settings.
   * @returns {object} Analysis (valid:false with a reason if the model has no parameters yet).
   */
  Mo.analyse = function (comp, s) {
    var meta = Mo.meta(comp.id), kind = Mo.kindOf(comp);
    var out = { id: comp.id, name: comp.name || meta.name, part: comp.part || meta.part, kind: kind, valid: false };
    var p = comp.params;
    if (!p || !(p.beta > 0) || !(p.eta > 0)) {
      out.reason = 'No model yet. Add at least 3 failure records in Model Calibration and press "Fit Weibull", or enter the shape and scale values by hand.';
      out.status = 'none';
      return out;
    }
    var inp = comp.inputs;
    var beta = p.beta, eta = p.eta;
    var R = function (t) { return M.weibullR(t, beta, eta); };

    var mt = Mo.mtbfOf(comp);
    var lambda = M.failureRate(mt.mtbf);
    var vib = Mo.usesVibration(comp) ? Mo.vibrationZone(inp.vibMms, s) : { zone: null, k: 1, label: 'Not applicable' };
    var tmp = Mo.temperatureFor(comp, inp.tempC, s);
    var kTotal = tmp.k * vib.k;
    var tEff = Mo.effectiveAge(inp.hoursSince, tmp.k, vib.k);

    var Cf = Mo.failureCost(comp.costs), Cp = Mo.plannedCost(comp.costs);
    var opt = cachedOptimum(beta, eta, Cp, Cf);
    var b10 = M.b10(beta, eta);
    var refLife = opt.exists ? opt.T : b10;
    var basis = opt.exists ? 'T*' : 'B10';

    var P = {};
    [100, 200, 500].forEach(function (dt) { P[dt] = M.conditionalFailureProb(R, tEff, kTotal * dt); });
    var rulEff = M.meanResidualLife(R, tEff);
    var rulHours = rulEff / kTotal;
    var hrsToRef = Math.max(0, (refLife - tEff) / kTotal);

    var hl = s.health;
    var reasons = [];
    var red = false, yellow = false;
    if (tEff >= refLife) { red = true; reasons.push('The part has reached its recommended replacement life.'); }
    if (P[200] >= hl.redP200) { red = true; reasons.push('The chance of failing in the next 200 hours is ' + fmt.pct(P[200]) + '.'); }
    if (vib.zone === 'D') { red = true; reasons.push('Vibration is in the unacceptable zone.'); }
    if (tmp.alarm) { red = true; reasons.push('Temperature is over the alarm limit.'); }
    if (!red) {
      if (tEff >= hl.greenFrac * refLife) { yellow = true; reasons.push('The part has used ' + fmt.pct(tEff / refLife) + ' of its recommended life.'); }
      if (P[200] >= hl.greenP200) { yellow = true; reasons.push('The chance of failing in the next 200 hours is ' + fmt.pct(P[200]) + '.'); }
    }
    var status = red ? 'red' : (yellow ? 'yellow' : 'green');
    if (!reasons.length) reasons.push('Age, condition and failure chance are all within safe limits.');

    var score = 100 * Math.min(1, Math.max(0, Math.min(1 - tEff / refLife, 1 - P[200] / hl.redP200)));
    if (vib.zone === 'D' || tmp.alarm) score = Math.min(score, 15);

    var daysToRef = M.hoursToCalendarDays(hrsToRef, s.hoursPerDay, s.daysPerWeek);
    var rulDays = M.hoursToCalendarDays(rulHours, s.hoursPerDay, s.daysPerWeek);

    Object.assign(out, {
      valid: true, beta: beta, eta: eta, source: p.source, r2: p.r2,
      mtbf: mt.mtbf, mtbfInfo: mt, lambda: lambda,
      mttf: M.weibullMTTF(beta, eta), b10: b10,
      vib: vib, temp: tmp, kTotal: kTotal, tEff: tEff, hoursSince: inp.hoursSince,
      Cf: Cf, Cp: Cp, opt: opt, Tstar: opt.exists ? opt.T : null, refLife: refLife, basis: basis,
      P: P, rulEff: rulEff, rulHours: rulHours, rulDays: rulDays,
      hrsToRef: hrsToRef, daysToRef: daysToRef,
      status: status, reasons: reasons, score: score,
      lifeUsed: Math.min(1.5, tEff / refLife),
      Rnow: R(tEff), RnowExp: M.expReliability(tEff, lambda),
      R: R
    });
    out.recommendation = Mo.recommendation(out, s);
    return out;
  };

  /** Plain-language label for a status key. */
  Mo.statusLabel = function (st) {
    return { green: 'Healthy', yellow: 'Monitor', red: 'Critical', none: 'No data' }[st] || '';
  };

  /**
   * One-line plain-language recommendation.
   * @param {object} a Analysis from Mo.analyse.
   * @param {object} s Settings.
   * @returns {string}
   */
  Mo.recommendation = function (a, s) {
    var part = a.part;
    var cap = part.charAt(0).toUpperCase() + part.slice(1);
    var when = a.hrsToRef <= 0 ? 'now' : 'within the next ' + fmt.days(Math.max(1, Math.ceil(a.daysToRef)));
    if (a.vib.zone === 'D') return 'Stop and inspect the ' + part + ' now – vibration is dangerously high.';
    if (a.temp.alarm) return 'Check the ' + part + ' now – its temperature is over the alarm limit.';
    if (a.status === 'red') {
      return a.hrsToRef <= 0 ? 'Replace the ' + part + ' now – it has reached its recommended life.'
        : 'Replace ' + part + ' ' + when + '. It is likely to fail soon (' + fmt.pct(a.P[200]) + ' chance in 200 h).';
    }
    if (a.status === 'yellow') return 'Plan to replace the ' + part + ' ' + when + '. Keep checking it regularly.';
    return cap + ' is healthy. Next planned replacement in about ' + fmt.days(Math.max(1, Math.round(a.daysToRef))) + '.';
  };

  /**
   * Analyse every component in the state.
   * @param {object} state Application state ({settings, components}).
   * @returns {Object.<string, object>} Map of component id to analysis.
   */
  Mo.analyseAll = function (state) {
    var out = {};
    Object.keys(state.components).forEach(function (id) { out[id] = Mo.analyse(state.components[id], state.settings); });
    return out;
  };

  /**
   * Component ids ordered by priority: the part that most needs attention first.
   * Critical, then Monitor, then Healthy, then parts with no model yet. Within a
   * group the lowest health score comes first, then the least time to replacement.
   * @param {Object.<string,object>} all Analyses from Mo.analyseAll.
   * @returns {string[]} Component ids, most urgent first.
   */
  Mo.prioritise = function (all) {
    var rank = { red: 0, yellow: 1, green: 2, none: 3 };
    return Object.keys(all).map(function (id, n) { return { id: id, a: all[id], n: n }; }).sort(function (x, y) {
      var rx = rank[x.a.status], ry = rank[y.a.status];
      if (rx !== ry) return rx - ry;
      if (x.a.valid && y.a.valid) {
        if (x.a.score !== y.a.score) return x.a.score - y.a.score;
        if (x.a.hrsToRef !== y.a.hrsToRef) return x.a.hrsToRef - y.a.hrsToRef;
      }
      return x.n - y.n;
    }).map(function (o) { return o.id; });
  };

  /** Worst status among analyses: red > yellow > green > none. */
  Mo.overallStatus = function (all) {
    var rank = { none: 0, green: 1, yellow: 2, red: 3 }, worst = 'none';
    Object.keys(all).forEach(function (k) { if (rank[all[k].status] > rank[worst]) worst = all[k].status; });
    return worst;
  };

  /* ------------------------------------------------------------------ *
   *  Maintenance schedule (12 months)
   * ------------------------------------------------------------------ */

  /**
   * Build a 12-month maintenance plan.
   * Each component's routine tasks (its own `tasks` list) recur every `interval` operating hours (first due when the
   * running hours next cross a multiple of the interval). Replacement is first due
   * when the effective age reaches the reference life (T* or B10), then repeats every
   * refLife / k operating hours.  Operating hours become calendar days with
   * days = hours / hoursPerDay x 7 / daysPerWeek.
   * @param {Object.<string,object>} all Analyses.
   * @param {object} state Application state.
   * @param {Date} [today] Start date (defaults to now).
   * @returns {{events:object[], start:Date}}
   */
  Mo.buildSchedule = function (all, state, today) {
    var s = state.settings;
    var start = new Date(today || new Date());
    start.setHours(0, 0, 0, 0);
    var events = [];
    var horizon = 365;

    function dayOf(hours) { return M.hoursToCalendarDays(hours, s.hoursPerDay, s.daysPerWeek); }
    function push(compId, task, type, offsetDays, atHours, due) {
      var d = new Date(start.getTime());
      d.setDate(d.getDate() + Math.round(offsetDays));
      events.push({ compId: compId, comp: (state.components[compId] && state.components[compId].name) || Mo.meta(compId).name, task: task, type: type, date: d,
        offsetDays: Math.round(offsetDays), atHours: atHours, dueNow: !!due });
    }

    Object.keys(state.components).forEach(function (cid) {
      var c = state.components[cid];
      var a = all[cid];
      if (!a || !a.valid) return;
      var hs = c.inputs.hoursSince;
      (c.tasks || []).forEach(function (t) {
        var iv = t.interval;
        if (!(iv > 0)) return;
        var first = iv - (hs % iv);
        for (var h = first, n = 0; n < 400; h += iv, n++) {
          var off = dayOf(h);
          if (off > horizon) break;
          push(cid, t.task, t.type, off, hs + h, false);
        }
      });
      // Replacement
      var cycle = a.refLife / a.kTotal;
      var firstAge = hs + a.hrsToRef;
      for (var n2 = 0, hrs = a.hrsToRef; n2 < 60; n2++, hrs += cycle) {
        var off = dayOf(hrs);
        if (off > horizon) break;
        push(cid, 'Replace ' + a.part + ' (preventive)', 'replacement', off, n2 === 0 ? firstAge : cycle, n2 === 0 && a.hrsToRef <= 0);
        if (!(cycle > 0)) break;
      }
    });

    events.sort(function (x, y) { return x.date - y.date || x.comp.localeCompare(y.comp); });
    return { events: events, start: start };
  };

  /**
   * Group schedule events by calendar month for the timeline view.
   * @param {object[]} events Schedule events.
   * @param {Date} start First day of the plan.
   * @returns {{label:string, year:number, month:number, byComp:Object.<string,object[]>}[]} 12 months.
   */
  Mo.groupByMonth = function (events, start) {
    var months = [];
    for (var i = 0; i < 12; i++) {
      var d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      months.push({ label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        year: d.getFullYear(), month: d.getMonth(), byComp: {} });
    }
    events.forEach(function (e) {
      var idx = (e.date.getFullYear() - start.getFullYear()) * 12 + (e.date.getMonth() - start.getMonth());
      if (idx >= 0 && idx < 12) (months[idx].byComp[e.compId] = months[idx].byComp[e.compId] || []).push(e);
    });
    return months;
  };

  /* ------------------------------------------------------------------ *
   *  Cost comparison
   * ------------------------------------------------------------------ */

  /**
   * Monthly cost: run-to-failure versus the proposed age-replacement policy.
   * Reactive  = (monthly operating hours / MTBF) x Cf
   * Proposed  = C(T*) x monthly operating hours      (C(T*) from the age-replacement model)
   * Unplanned failures per month under the proposed policy = hours x F(T*) / integral_0^T* R dt.
   * Where no preventive optimum exists, the proposed cost equals the reactive cost.
   * @param {Object.<string,object>} all Analyses.
   * @param {object} state Application state.
   * @returns {{rows:object[], total:object, months:number[]}}
   */
  Mo.costComparison = function (all, state) {
    var s = state.settings;
    var mh = Mo.monthlyHours(s);
    var rows = [], tReactive = 0, tProposed = 0, tFailR = 0, tFailP = 0;
    Object.keys(state.components).forEach(function (cid) {
      var c = { id: cid, name: state.components[cid].name || Mo.meta(cid).name };
      var a = all[cid];
      if (!a || !a.valid) return;
      var failR = mh / a.mtbf;
      var reactive = failR * a.Cf;
      var proposed = reactive, failP = failR, planned = 0, note = '';
      if (a.opt.exists) {
        var T = a.opt.T;
        var cyc = M.simpson(a.R, 0, T, 2000);
        proposed = a.opt.cost * mh;
        failP = mh * (1 - a.R(T)) / cyc;
        planned = mh * a.R(T) / cyc;
      } else {
        note = a.opt.reason;
      }
      rows.push({ id: c.id, name: c.name, reactive: reactive, proposed: proposed,
        savings: reactive - proposed, savingsPct: reactive > 0 ? (reactive - proposed) / reactive : 0,
        failR: failR, failP: failP, planned: planned, reduction: failR - failP, note: note, Cf: a.Cf, Cp: a.Cp });
      tReactive += reactive; tProposed += proposed; tFailR += failR; tFailP += failP;
    });
    var months = [];
    for (var m = 1; m <= 12; m++) months.push((tReactive - tProposed) * m);
    return {
      rows: rows, months: months, monthlyHours: mh,
      total: { reactive: tReactive, proposed: tProposed, savings: tReactive - tProposed,
        savingsPct: tReactive > 0 ? (tReactive - tProposed) / tReactive : 0,
        failR: tFailR, failP: tFailP, reduction: tFailR - tFailP }
    };
  };

  /* ------------------------------------------------------------------ *
   *  Validation against historical failures
   * ------------------------------------------------------------------ */

  /**
   * Compare the model's recommended replacement age with actual failures.
   * A failure is "prevented" when the recommended replacement age (T* or B10)
   * is earlier than the age at which the part actually failed.
   * @param {object[]} records Validation records {id, comp, hours, note}.
   * @param {Object.<string,object>} all Analyses.
   * @returns {{rows:object[], hits:number, total:number, rate:number}}
   */
  Mo.validate = function (records, all) {
    var rows = [], hits = 0;
    (records || []).forEach(function (r) {
      var a = all[r.comp];
      if (!a || !a.valid || !(r.hours > 0)) return;
      var prevented = r.hours > a.refLife;
      if (prevented) hits++;
      rows.push({ id: r.id, comp: r.comp, name: a.name, note: r.note || '', date: r.date || '', actual: r.hours, replaceAt: a.refLife,
        basis: a.basis, prevented: prevented, margin: r.hours - a.refLife,
        unusedPct: prevented ? (r.hours - a.refLife) / r.hours : 0 });
    });
    return { rows: rows, hits: hits, total: rows.length, rate: rows.length ? hits / rows.length : NaN };
  };

  /* ------------------------------------------------------------------ *
   *  "How was this calculated?" explanation
   * ------------------------------------------------------------------ */

  /**
   * Step-by-step working with the user's actual numbers substituted.
   * @param {object} a Analysis.
   * @param {object} comp Component record.
   * @param {object} s Settings.
   * @returns {{title:string, formula:string, working:string, result:string}[]}
   */
  Mo.explain = function (a, comp, s) {
    if (!a.valid) return [];
    var steps = [], i = comp.inputs, c = comp.costs, n = fmt.num;
    var mi = a.mtbfInfo;
    steps.push({
      title: '1. Average time between failures (MTBF) and failure rate',
      formula: 'MTBF = total operating hours ÷ number of failures;   λ = 1 ÷ MTBF',
      working: mi.source === 'data'
        ? 'MTBF = ' + n(mi.totalHours) + ' ÷ ' + mi.failures + ' = ' + n(a.mtbf, 1) + ' h;   λ = 1 ÷ ' + n(a.mtbf, 1) + ' = ' + a.lambda.toExponential(3) + ' per hour'
        : 'No failure records, so the Weibull mean life is used: MTBF = ' + n(a.mtbf, 1) + ' h;   λ = ' + a.lambda.toExponential(3) + ' per hour',
      result: 'MTBF = ' + n(a.mtbf, 1) + ' h'
    });
    steps.push({
      title: '2. Wear-out model (Weibull parameters)',
      formula: 'R(t) = exp[ −(t ÷ η)^β ];   MTTF = η · Γ(1 + 1/β);   B10 = η · (−ln 0.90)^(1/β)',
      working: 'β = ' + n(a.beta, 2) + ', η = ' + n(a.eta, 0) + ' h' + (a.source === 'fit' && isFinite(a.r2) ? ' (fitted, R² = ' + n(a.r2, 3) + ')' : ' (entered by hand)') +
        ';   MTTF = ' + n(a.eta, 0) + ' × Γ(' + n(1 + 1 / a.beta, 3) + ') = ' + n(a.mttf, 0) + ' h;   B10 = ' + n(a.b10, 0) + ' h',
      result: 'MTTF = ' + n(a.mttf, 0) + ' h, B10 = ' + n(a.b10, 0) + ' h'
    });
    var kind = Mo.kindOf(comp), own = Mo.validLimits(comp.tempLimits), tk = own ? comp.tempLimits : s.temperature[kind];
    var tfText = !own && kind === 'motor'
      ? 'k_temp = 2^((' + n(i.tempC, 1) + ' − ' + tk.rated + ') ÷ 10) = ' + n(a.temp.k, 3) + (i.tempC > tk.rated ? '' : ' (not above rated, so 1)')
      : !own && kind === 'sealer'
        ? 'k_temp = 1 + ' + tk.kPerDeg + ' × max(0, |' + n(i.tempC, 1) + ' − ' + tk.setpoint + '| − ' + tk.tolerance + ') = ' + n(a.temp.k, 3)
        : 'k_temp = ' + n(a.temp.k, 2) + ' (temperature ' + n(i.tempC, 1) + ' °C against warning ' + tk.warn + ' °C and alarm ' + tk.alarm + ' °C' + (own ? ', limits set for this part' : '') + ')';
    steps.push({
      title: '3. Condition-adjusted age (effective age)',
      formula: 't_eff = t × k_temp × k_vib',
      working: tfText + ';   ' + (a.vib.zone ? 'vibration ' + n(i.vibMms, 2) + ' mm/s is ' + a.vib.label + ', k_vib = ' + n(a.vib.k, 2) : 'vibration does not apply to this part, k_vib = 1') +
        ';   t_eff = ' + n(i.hoursSince) + ' × ' + n(a.temp.k, 3) + ' × ' + n(a.vib.k, 2) + ' = ' + n(a.tEff, 0) + ' h',
      result: 't_eff = ' + n(a.tEff, 0) + ' h'
    });
    steps.push({
      title: '4. Chance the part is still working now',
      formula: 'Weibull: R(t_eff) = exp[ −(t_eff ÷ η)^β ];   Exponential: R(t) = exp(−λ t)',
      working: 'Weibull: exp[ −(' + n(a.tEff, 0) + ' ÷ ' + n(a.eta, 0) + ')^' + n(a.beta, 2) + ' ] = ' + fmt.pct(a.Rnow, 1) + ';   Exponential: exp(−' + a.lambda.toExponential(3) + ' × ' + n(a.tEff, 0) + ') = ' + fmt.pct(a.RnowExp, 1),
      result: 'Weibull R = ' + fmt.pct(a.Rnow, 1)
    });
    var pw = [100, 200, 500].map(function (dt) {
      return 'P(' + dt + ' h) = 1 − R(' + n(a.tEff + a.kTotal * dt, 0) + ') ÷ R(' + n(a.tEff, 0) + ') = ' + fmt.pct(a.P[dt], 1);
    }).join(';   ');
    steps.push({
      title: '5. Chance of failing soon (conditional probability)',
      formula: 'P = 1 − R(t_eff + k·Δt) ÷ R(t_eff)     (k = k_temp × k_vib = ' + n(a.kTotal, 3) + ', because wear runs k times faster)',
      working: pw,
      result: 'P(200 h) = ' + fmt.pct(a.P[200], 1)
    });
    steps.push({
      title: '6. Remaining useful life (RUL)',
      formula: 'RUL(t) = [ ∫ from t to ∞ of R(x) dx ] ÷ R(t)   (Simpson\'s rule);   real hours = RUL ÷ k;   days = hours ÷ hours-per-day × 7 ÷ days-per-week',
      working: 'RUL(' + n(a.tEff, 0) + ') = ' + n(a.rulEff, 0) + ' effective hours;   ÷ ' + n(a.kTotal, 3) + ' = ' + n(a.rulHours, 0) + ' real hours;   ' + n(a.rulHours, 0) + ' ÷ ' + s.hoursPerDay + ' × 7 ÷ ' + s.daysPerWeek + ' = ' + n(a.rulDays, 1) + ' days',
      result: 'RUL = ' + n(a.rulHours, 0) + ' h (' + fmt.days(a.rulDays) + ')'
    });
    steps.push({
      title: '7. Cost of a breakdown and of planned replacement',
      formula: 'Cf = repair + downtime hours × lost production per hour;   Cp = part + labour + planned downtime × lost production per hour',
      working: 'Cf = ' + fmt.naira(c.repair) + ' + ' + n(c.downtimeH, 1) + ' × ' + fmt.naira(c.lostPerHour) + ' = ' + fmt.naira(a.Cf) +
        ';   Cp = ' + fmt.naira(c.partCost) + ' + ' + fmt.naira(c.labour) + ' + ' + n(c.plannedDowntimeH, 1) + ' × ' + fmt.naira(c.lostPerHour) + ' = ' + fmt.naira(a.Cp),
      result: 'Cf = ' + fmt.naira(a.Cf) + ', Cp = ' + fmt.naira(a.Cp)
    });
    steps.push({
      title: '8. Best replacement age (cost optimisation)',
      formula: 'C(T) = [ Cp·R(T) + Cf·(1 − R(T)) ] ÷ ∫ from 0 to T of R(t) dt   — choose T* that makes C(T) smallest',
      working: a.opt.exists
        ? 'Searching the curve gives T* = ' + n(a.opt.T, 0) + ' h with a cost of ' + fmt.naira(a.opt.cost) + ' per operating hour.'
        : a.opt.reason + ' The B10 life of ' + n(a.b10, 0) + ' h is used as the reference instead.',
      result: a.opt.exists ? 'T* = ' + n(a.opt.T, 0) + ' h' : 'Using B10 = ' + n(a.b10, 0) + ' h'
    });
    var hl = s.health;
    steps.push({
      title: '9. Health status decision',
      formula: 'GREEN: t_eff < ' + hl.greenFrac + '·' + a.basis + ' and P(200 h) < ' + fmt.pct(hl.greenP200) + ';   RED: t_eff ≥ ' + a.basis + ', P(200 h) ≥ ' + fmt.pct(hl.redP200) + ', vibration zone D, or temperature over alarm;   otherwise YELLOW',
      working: 't_eff = ' + n(a.tEff, 0) + ' h against ' + a.basis + ' = ' + n(a.refLife, 0) + ' h (' + fmt.pct(a.tEff / a.refLife) + ' used);   P(200 h) = ' + fmt.pct(a.P[200], 1) + ';   ' + a.reasons.join(' '),
      result: 'Status: ' + Mo.statusLabel(a.status)
    });
    return steps;
  };

})(typeof window !== 'undefined' ? window : globalThis);
