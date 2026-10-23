/**
 * @file tests.js
 * Self-written unit tests for js/math.js (no framework).
 * Each expected value is either hand-calculable or a published constant.
 * Defines PM.tests.run(), which returns an array of result rows; tests.html renders them.
 */
(function (root) {
  'use strict';

  var PM = root.PM = root.PM || {};
  var M = PM.math;
  var list = [];

  /** Register a test. @param {string} name @param {string} expected @param {function():{actual:*, pass:boolean}} fn */
  function test(name, expected, fn) { list.push({ name: name, expected: expected, fn: fn }); }

  /** Assert |actual - expected| <= tol (absolute). */
  function near(actual, expected, tol) {
    return { actual: actual, pass: Math.abs(actual - expected) <= tol };
  }
  /** Assert |actual - expected| / |expected| <= tol (relative). */
  function rel(actual, expected, tol) {
    return { actual: actual, pass: Math.abs(actual - expected) <= tol * Math.abs(expected) };
  }
  function truthy(actual, ok) { return { actual: actual, pass: !!ok }; }

  /* ---- Exponential ---- */
  test('MTBF = hours / failures', '1000 / 4 = 250', function () { return near(M.mtbf(1000, 4), 250, 1e-12); });
  test('Failure rate = 1 / MTBF', '1 / 250 = 0.004', function () { return near(M.failureRate(250), 0.004, 1e-15); });
  test('Exponential R(t) at t = MTBF', 'exp(-1) = 0.367879', function () {
    return near(M.expReliability(250, 1 / 250), Math.exp(-1), 1e-12);
  });
  test('Exponential F(t) = 1 - R(t)', '1 - exp(-1) = 0.632121', function () {
    return near(M.expUnreliability(250, 1 / 250), 1 - Math.exp(-1), 1e-12);
  });

  /* ---- Weibull ---- */
  test('Weibull R(eta) = exp(-1) for any beta', 'exp(-1) = 0.367879', function () {
    return near(M.weibullR(1000, 3.2, 1000), Math.exp(-1), 1e-12);
  });
  test('Weibull R(t), beta = 2, t = eta/2', 'exp(-0.25) = 0.778801', function () {
    return near(M.weibullR(500, 2, 1000), Math.exp(-0.25), 1e-12);
  });
  test('Weibull hazard, beta = 2, eta = 1000, t = 500', '(2/1000)(0.5) = 0.001', function () {
    return near(M.weibullHazard(500, 2, 1000), 0.001, 1e-15);
  });
  test('Weibull pdf = hazard x R', '0.001 x exp(-0.25) = 0.000778801', function () {
    return near(M.weibullPdf(500, 2, 1000), 0.001 * Math.exp(-0.25), 1e-15);
  });
  test('Weibull beta = 1 reduces to exponential', 'R = exp(-t/eta)', function () {
    return near(M.weibullR(300, 1, 900), M.expReliability(300, 1 / 900), 1e-14);
  });

  /* ---- Gamma and MTTF ---- */
  test('Gamma(1.5) = sqrt(pi)/2', '0.886227', function () { return near(M.gamma(1.5), 0.886227, 1e-6); });
  test('Gamma(5) = 4! = 24', '24', function () { return rel(M.gamma(5), 24, 1e-12); });
  test('Gamma(0.5) = sqrt(pi)', '1.772454', function () { return near(M.gamma(0.5), Math.sqrt(Math.PI), 1e-10); });
  test('Weibull MTTF with beta = 1 equals eta', 'MTTF = eta = 750', function () {
    return rel(M.weibullMTTF(1, 750), 750, 1e-12);
  });
  test('Weibull MTTF, beta = 2', 'eta x Gamma(1.5) = 886.227', function () {
    return near(M.weibullMTTF(2, 1000), 886.227, 1e-3);
  });

  /* ---- B10 ---- */
  test('B10 closed form gives R = 0.90', 'R(B10) = 0.90', function () {
    return near(M.weibullR(M.b10(2.5, 1200), 2.5, 1200), 0.90, 1e-12);
  });
  test('B10, beta = 1, eta = 1000', '-1000 ln(0.9) = 105.361', function () {
    return near(M.b10(1, 1000), 105.3605, 1e-3);
  });

  /* ---- Conditional probability ---- */
  test('Conditional P, Weibull beta = 2, t = eta, dt = eta', '1 - exp(-3) = 0.950213', function () {
    var R = function (t) { return M.weibullR(t, 2, 1000); };
    return near(M.conditionalFailureProb(R, 1000, 1000), 1 - Math.exp(-3), 1e-12);
  });
  test('Conditional P, exponential, is independent of age', '1 - exp(-100/250) = 0.329680', function () {
    var R = function (t) { return M.expReliability(t, 1 / 250); };
    return near(M.conditionalFailureProb(R, 700, 100), 1 - Math.exp(-0.4), 1e-12);
  });

  /* ---- Numerical integration and RUL ---- */
  test("Simpson's rule: integral of x^2 over [0, 3]", '9', function () {
    return near(M.simpson(function (x) { return x * x; }, 0, 3, 100), 9, 1e-10);
  });
  test('RUL (exponential) equals MTBF at age 0', 'MTBF = 250', function () {
    var R = function (t) { return M.expReliability(t, 1 / 250); };
    return rel(M.meanResidualLife(R, 0), 250, 1e-3);
  });
  test('RUL (exponential) is memoryless: equals MTBF at age 600', 'MTBF = 250', function () {
    var R = function (t) { return M.expReliability(t, 1 / 250); };
    return rel(M.meanResidualLife(R, 600), 250, 1e-3);
  });
  test('RUL at age 0 equals Weibull MTTF (beta = 2)', 'MTTF = 886.227', function () {
    var R = function (t) { return M.weibullR(t, 2, 1000); };
    return rel(M.meanResidualLife(R, 0), 886.227, 1e-3);
  });
  test('RUL of a wearing part shrinks with age', 'RUL(800) < RUL(200)', function () {
    var R = function (t) { return M.weibullR(t, 3, 1000); };
    var a = M.meanResidualLife(R, 200), b = M.meanResidualLife(R, 800);
    return truthy(b.toFixed(1) + ' < ' + a.toFixed(1), b < a);
  });
  test('Calendar-day conversion', '120 h at 12 h/day, 6 d/week = 11.667 d', function () {
    return near(M.hoursToCalendarDays(120, 12, 6), 10 * 7 / 6, 1e-12);
  });

  /* ---- Regression and Weibull fitting ---- */
  test('Linear regression on y = 2x + 1', 'slope 2, intercept 1, R2 = 1', function () {
    var f = M.linearRegression([0, 1, 2, 3], [1, 3, 5, 7]);
    return truthy('slope ' + f.slope + ', intercept ' + f.intercept + ', R2 ' + f.r2,
      Math.abs(f.slope - 2) < 1e-12 && Math.abs(f.intercept - 1) < 1e-12 && Math.abs(f.r2 - 1) < 1e-12);
  });
  test("Bernard's approximation, i = 1, n = 5", '(1 - 0.3)/(5 + 0.4) = 0.129630', function () {
    return near(M.bernardRank(1, 5), 0.7 / 5.4, 1e-12);
  });
  test('Johnson adjusted ranks with a suspension', 'ranks 1, 2.25, 3.5', function () {
    var r = M.johnsonAdjustedRanks([
      { hours: 100, type: 'failure' }, { hours: 200, type: 'suspension' },
      { hours: 300, type: 'failure' }, { hours: 400, type: 'failure' },
      { hours: 500, type: 'suspension' }]);
    var ok = r.length === 3 && Math.abs(r[0].rank - 1) < 1e-12 &&
      Math.abs(r[1].rank - 2.25) < 1e-12 && Math.abs(r[2].rank - 3.5) < 1e-12;
    return truthy(r.map(function (x) { return x.rank.toFixed(2); }).join(', '), ok);
  });
  test('MRR recovers known Weibull (beta = 2, eta = 1000) from exact quantiles', 'beta 2, eta 1000, R2 = 1', function () {
    var n = 6, recs = [];
    for (var i = 1; i <= n; i++) {
      var F = M.bernardRank(i, n);
      recs.push({ hours: 1000 * Math.pow(-Math.log(1 - F), 1 / 2), type: 'failure' });
    }
    var fit = M.fitWeibullMRR(recs);
    return truthy('beta ' + fit.beta.toFixed(6) + ', eta ' + fit.eta.toFixed(4) + ', R2 ' + fit.r2.toFixed(6),
      fit.ok && Math.abs(fit.beta - 2) < 1e-9 && Math.abs(fit.eta - 1000) < 1e-6 && Math.abs(fit.r2 - 1) < 1e-9);
  });
  test('MRR rejects fewer than 3 failures', 'ok = false with a warning', function () {
    var fit = M.fitWeibullMRR([{ hours: 100, type: 'failure' }, { hours: 200, type: 'failure' },
      { hours: 300, type: 'suspension' }]);
    return truthy('ok = ' + fit.ok, !fit.ok && /3 failure/.test(fit.message));
  });
  test('MRR on sample bearing data gives wear-out (beta > 1)', 'beta > 1, R2 > 0.9', function () {
    var recs = [1420, 1580, 1650, 1710, 1900, 2050].map(function (h) { return { hours: h, type: 'failure' }; });
    var fit = M.fitWeibullMRR(recs);
    return truthy('beta ' + fit.beta.toFixed(2) + ', eta ' + fit.eta.toFixed(0) + ', R2 ' + fit.r2.toFixed(3),
      fit.ok && fit.beta > 1 && fit.r2 > 0.9);
  });

  /* ---- Cost optimisation ---- */
  test('Cost rate T -> large approaches Cf / MTTF', 'Cf / MTTF = 10000 / 886.227', function () {
    var R = function (t) { return M.weibullR(t, 2, 1000); };
    return rel(M.costRate(10000, R, 1000, 10000, 20000), 10000 / 886.227, 1e-3);
  });
  test('Optimum exists for beta = 2, Cf = 10 x Cp', 'T* found, C(T*) <= C(T* +/- 10%)', function () {
    var o = M.optimalReplacementAge(2, 1000, 1000, 10000);
    var R = function (t) { return M.weibullR(t, 2, 1000); };
    var ok = o.exists && o.cost <= M.costRate(o.T * 0.9, R, 1000, 10000, 2000) + 1e-9 &&
      o.cost <= M.costRate(o.T * 1.1, R, 1000, 10000, 2000) + 1e-9;
    return truthy(o.exists ? 'T* = ' + o.T.toFixed(1) + ' h' : 'none', ok);
  });
  test('Optimum is earlier when failures cost more', 'T*(Cf = 20 Cp) < T*(Cf = 5 Cp)', function () {
    var a = M.optimalReplacementAge(2.5, 1000, 1000, 20000).T;
    var b = M.optimalReplacementAge(2.5, 1000, 1000, 5000).T;
    return truthy(a.toFixed(1) + ' < ' + b.toFixed(1), a < b);
  });
  test('No optimum when beta <= 1', 'exists = false, reason given', function () {
    var o = M.optimalReplacementAge(1, 1000, 1000, 10000);
    return truthy('exists = ' + o.exists, !o.exists && o.reason.length > 20);
  });
  test('No optimum when Cf <= Cp', 'exists = false, reason given', function () {
    var o = M.optimalReplacementAge(2.5, 1000, 5000, 5000);
    return truthy('exists = ' + o.exists, !o.exists && o.reason.length > 20);
  });

  /* ---- Model layer: condition factors, health, schedule, cost, validation ---- */
  var Mo = PM.model, St = PM.store, DS = Mo.defaultSettings();
  function comp(id, beta, eta, hs, temp, vib) {
    var c = Mo.defaultComponent(id);
    c.params = { beta: beta, eta: eta, source: 'manual' };
    c.inputs = { hoursSince: hs, tempC: temp, vibMms: vib, lastMaint: '' };
    return c;
  }
  test('Vibration zones: 0.5, 1.0, 3.0, 5.0 mm/s', 'A 1.0, B 1.1, C 1.4, D 2.0', function () {
    var z = [0.5, 1.0, 3.0, 5.0].map(function (v) { return Mo.vibrationZone(v, DS); });
    return truthy(z.map(function (q) { return q.zone + ' ' + q.k; }).join(', '),
      z[0].k === 1 && z[1].k === 1.1 && z[2].k === 1.4 && z[3].k === 2 && z[3].zone === 'D');
  });
  test('Vibration zone boundary: 0.71 belongs to zone B', 'zone B', function () {
    return truthy(Mo.vibrationZone(0.71, DS).zone, Mo.vibrationZone(0.71, DS).zone === 'B');
  });
  test('Motor temperature factor 2^((T - Trated)/10)', 'rated+10 = 2, rated+20 = 4, below rated = 1', function () {
    var r = DS.temperature.motor.rated;
    var a = Mo.temperatureFactor('motor', r + 10, DS).k, b = Mo.temperatureFactor('motor', r + 20, DS).k, c = Mo.temperatureFactor('motor', r - 15, DS).k;
    return truthy(a + ', ' + b + ', ' + c, Math.abs(a - 2) < 1e-12 && Math.abs(b - 4) < 1e-12 && c === 1);
  });
  test('Effective age t_eff = t x k_temp x k_vib', '1000 x 2 x 1.4 = 2800', function () {
    return near(Mo.effectiveAge(1000, 2, 1.4), 2800, 1e-9);
  });
  test('Sealer factor: inside the allowed band is 1', 'k = 1', function () {
    return near(Mo.temperatureFactor('sealer', 163, DS).k, 1, 1e-12);
  });
  test('Health GREEN for a young part in good condition', 'status = green', function () {
    var a = Mo.analyse(comp('bearing', 3, 1500, 100, 50, 0.3), DS);
    return truthy(a.status + ' (t_eff ' + Math.round(a.tEff) + ', ref ' + Math.round(a.refLife) + ')', a.status === 'green');
  });
  test('Health YELLOW between 70 % and 100 % of the reference life', 'status = yellow', function () {
    var base = Mo.analyse(comp('bearing', 3, 1500, 0, 50, 0.3), DS);
    var a = Mo.analyse(comp('bearing', 3, 1500, base.refLife * 0.85, 50, 0.3), DS);
    return truthy(a.status + ' at 85 % of ' + Math.round(base.refLife) + ' h', a.status === 'yellow');
  });
  test('Health RED once t_eff reaches the reference life', 'status = red', function () {
    var base = Mo.analyse(comp('bearing', 3, 1500, 0, 50, 0.3), DS);
    var a = Mo.analyse(comp('bearing', 3, 1500, base.refLife * 1.01, 50, 0.3), DS);
    return truthy(a.status, a.status === 'red');
  });
  test('Health RED for vibration zone D even on a new part', 'status = red', function () {
    var a = Mo.analyse(comp('bearing', 3, 1500, 10, 50, 9), DS);
    return truthy(a.status, a.status === 'red');
  });
  test('Health RED when temperature is over the alarm limit', 'status = red', function () {
    var a = Mo.analyse(comp('motor', 3, 8000, 10, DS.temperature.motor.alarm + 5, 0.3), DS);
    return truthy(a.status, a.status === 'red');
  });
  test('Reference life falls back to B10 when beta <= 1', 'basis = B10, no T*', function () {
    var a = Mo.analyse(comp('sealer', 0.9, 1000, 10, 160, 0), DS);
    return truthy(a.basis + ', T* = ' + a.Tstar, a.basis === 'B10' && a.Tstar === null && Math.abs(a.refLife - a.b10) < 1e-9);
  });
  test('Conditions that age the part faster shorten the remaining days', 'days(hot) < days(cool)', function () {
    var cool = Mo.analyse(comp('motor', 4, 7000, 1000, 70, 0.3), DS), hot = Mo.analyse(comp('motor', 4, 7000, 1000, 95, 0.3), DS);
    return truthy(hot.daysToRef.toFixed(1) + ' < ' + cool.daysToRef.toFixed(1), hot.daysToRef < cool.daysToRef);
  });
  test('Failure cost Cf and planned cost Cp', 'Cf = 45,000 + 6 x 15,000 = 135,000; Cp = 12,000 + 5,000 + 15,000 = 32,000', function () {
    var c = Mo.defaultComponent('bearing').costs;
    return truthy(Mo.failureCost(c) + ' / ' + Mo.plannedCost(c), Mo.failureCost(c) === 135000 && Mo.plannedCost(c) === 32000);
  });
  test('Monthly operating hours = 12 x 6 x 52 / 12', '312', function () { return near(Mo.monthlyHours(DS), 312, 1e-9); });
  test('Cost comparison: proposed policy never costs more than reactive (consistent MTBF)', 'savings >= 0 for every part', function () {
    var st = { settings: DS, components: { motor: comp('motor', 4, 7000, 0, 70, 0.3), bearing: comp('bearing', 3, 1500, 0, 50, 0.3), sealer: comp('sealer', 2.5, 900, 0, 160, 0) } };
    var cmp = Mo.costComparison(Mo.analyseAll(st), st);
    return truthy(cmp.rows.map(function (r) { return Math.round(r.savings); }).join(', '), cmp.rows.length === 3 && cmp.rows.every(function (r) { return r.savings >= -1; }));
  });
  test('Schedule: first replacement lands on the calendar day of the remaining hours', 'offset = hours / (12 h/day) x 7/6', function () {
    var st = { settings: DS, components: { motor: comp('motor', 4, 7000, 0, 70, 0.3), bearing: comp('bearing', 3, 1500, 0, 50, 0.3), sealer: comp('sealer', 2.5, 900, 0, 160, 0) } };
    var all = Mo.analyseAll(st), sc = Mo.buildSchedule(all, st, new Date(2026, 0, 1));
    var rep = sc.events.filter(function (e) { return e.compId === 'bearing' && e.type === 'replacement'; })[0];
    var expected = Math.round(M.hoursToCalendarDays(all.bearing.hrsToRef, 12, 6));
    return truthy('day ' + rep.offsetDays + ' (expected ' + expected + ')', rep.offsetDays === expected);
  });
  test('Schedule covers 12 months and is sorted by date', 'last event within 365 days, ascending', function () {
    var st = { settings: DS, components: { motor: comp('motor', 4, 7000, 0, 70, 0.3), bearing: comp('bearing', 3, 1500, 0, 50, 0.3), sealer: comp('sealer', 2.5, 900, 0, 160, 0) } };
    var ev = Mo.buildSchedule(Mo.analyseAll(st), st, new Date(2026, 0, 1)).events;
    var sorted = ev.every(function (e, i) { return i === 0 || ev[i - 1].date <= e.date; });
    return truthy(ev.length + ' events, max day ' + Math.max.apply(null, ev.map(function (e) { return e.offsetDays; })), sorted && ev.every(function (e) { return e.offsetDays <= 365; }));
  });
  test('Validation: failure counts as prevented only if replacement age < actual age', 'prevented, missed', function () {
    var a = Mo.analyse(comp('bearing', 3, 1500, 0, 50, 0.3), DS), all = { bearing: a };
    var v = Mo.validate([{ id: 'a', comp: 'bearing', hours: a.refLife + 100 }, { id: 'b', comp: 'bearing', hours: a.refLife - 100 }], all);
    return truthy(v.rows.map(function (r) { return r.prevented ? 'prevented' : 'missed'; }).join(', ') + ', hit rate ' + v.rate,
      v.rows[0].prevented && !v.rows[1].prevented && v.rate === 0.5);
  });

  /* ---- Store: CSV ---- */
  test('CSV parser: quotes, commas, CRLF, blank lines', '3 rows, 2 columns each', function () {
    var rows = St.parseCSV('hours,type\r\n"1,200",failure\r\n\r\n900,"suspension"\r\n');
    return truthy(rows.length + ' rows; ' + JSON.stringify(rows[1]), rows.length === 3 && rows[1][0] === '1,200' && rows[2][1] === 'suspension');
  });
  test('CSV export then parse round-trips the records', 'same hours and types', function () {
    var prev = St.state;
    St.state = St.blankState();
    St.state.components.motor.records = [{ id: 'x', hours: 5200, type: 'failure' }, { id: 'y', hours: 6000, type: 'suspension' }];
    var rows = St.parseCSV(St.recordsToCSV('motor'));
    St.state = prev;
    return truthy(JSON.stringify(rows.slice(1)), rows.length === 3 && rows[1][1] === '5200' && rows[2][2] === 'suspension');
  });
  test('Validation date: valid past date kept; future, malformed and empty are dropped', 'only 2026-03-22 is kept', function () {
    var a = St.cleanDate('2026-03-22'), b = St.cleanDate('2999-01-01'), c = St.cleanDate('22/03/2026'), d = St.cleanDate(''), e = St.cleanDate('2026-13-45');
    return truthy(JSON.stringify([a, b, c, d, e]), a === '2026-03-22' && b === '' && c === '' && d === '' && e === '');
  });
  test('Sample validation records carry dates', 'all 6 dated YYYY-MM-DD', function () {
    var st = St.sampleState();
    return truthy(st.validation.map(function (v) { return v.date; }).join(', '), st.validation.length === 6 && st.validation.every(function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(v.date); }));
  });
  test('Sample data: every component fits a Weibull model automatically', '3 fitted models, beta > 1', function () {
    var st = St.sampleState();
    var ok = Mo.COMPONENTS.every(function (c) { var p = st.components[c.id].params; return p && p.source === 'fit' && p.beta > 1; });
    return truthy(Mo.COMPONENTS.map(function (c) { return st.components[c.id].params.beta.toFixed(2); }).join(', '), ok);
  });

  /* ---- Components: create, edit, delete, priority order ---- */
  function freshStore() { var prev = St.state; St.state = St.sampleState(); St.commit = function () {}; return prev; }
  var realCommit = St.commit;
  test('Add component: new part gets its own name, type, tasks and costs', 'name kept, 1 task, general type', function () {
    var prev = freshStore();
    var id = St.addComponent({ name: '  Conveyor   gearbox ', kind: 'general' });
    var c = St.state.components[id];
    var ok = c.name === 'Conveyor gearbox' && c.kind === 'general' && c.tasks.length === 1 && c.records.length === 0 && Object.keys(St.state.components).length === 4;
    St.state = prev; St.commit = realCommit;
    return truthy(c.name + ', ' + c.tasks.length + ' task, ' + c.kind, ok);
  });
  test('Edit component: rename keeps records; changing type swaps the tasks', 'records kept, tasks = sealer tasks', function () {
    var prev = freshStore();
    var n = St.state.components.bearing.records.length;
    St.updateComponent('bearing', { name: 'Main bearing', kind: 'sealer', vibration: false });
    var c = St.state.components.bearing;
    var ok = c.name === 'Main bearing' && c.records.length === n && c.tasks.length === 2 && c.tasks[0].id === 'sealerClean' && c.vibration === false;
    St.state = prev; St.commit = realCommit;
    return truthy(c.name + ', ' + c.records.length + ' records, tasks ' + c.tasks.map(function (t) { return t.id; }).join('+'), ok);
  });
  test('Delete component: removes its validation entries; the last part cannot be deleted', 'motor gone, 3 validation left, last refused', function () {
    var prev = freshStore();
    var before = St.state.validation.length;
    var r1 = St.deleteComponent('motor');
    var left = St.state.validation.length;
    St.deleteComponent('bearing');
    var r2 = St.deleteComponent('sealer');
    var ok = r1.ok && !St.state.components.motor && left === before - 1 && !r2.ok && !!St.state.components.sealer;
    St.state = prev; St.commit = realCommit;
    return truthy('validation ' + before + ' -> ' + left + '; last delete ok = ' + r2.ok, ok);
  });
  test('Priority order: Critical first, then Monitor, Healthy, then parts with no model', 'red, yellow, green, none', function () {
    var all = { a: { status: 'green', valid: true, score: 90, hrsToRef: 900 }, b: { status: 'none', valid: false }, c: { status: 'red', valid: true, score: 10, hrsToRef: 0 },
      d: { status: 'yellow', valid: true, score: 40, hrsToRef: 100 }, e: { status: 'yellow', valid: true, score: 20, hrsToRef: 50 } };
    var o = Mo.prioritise(all);
    return truthy(o.join(', '), o.join('') === 'cedab');
  });
  test('Saved data round-trips custom components and keeps a deleted built-in deleted', 'custom kept, motor stays gone', function () {
    var prev = freshStore();
    var id = St.addComponent({ name: 'Cutter', kind: 'general' });
    St.deleteComponent('motor');
    var res = St.importJSON(St.exportJSON());
    var ok = res.ok && !!St.state.components[id] && St.state.components[id].name === 'Cutter' && !St.state.components.motor;
    St.state = prev; St.commit = realCommit;
    return truthy(res.message, ok);
  });
  test('Older backups (intervals in settings, no names) still load', 'tasks take the old intervals', function () {
    var prev = freshStore();
    var old = St.sampleState();
    delete old.components.motor.name; delete old.components.motor.tasks; delete old.components.motor.kind;
    old.settings.schedule = { intervals: { motorCheck: 777 } };
    var res = St.importJSON(JSON.stringify(old));
    var m = St.state.components.motor;
    var ok = res.ok && m.name === 'Electric Motor' && m.tasks[0].interval === 777;
    St.state = prev; St.commit = realCommit;
    return truthy(m.name + ', interval ' + m.tasks[0].interval, ok);
  });
  test('A part of type "Other" uses the warning/alarm temperature rule', 'k = warnK at warn, alarmK at alarm, 1 below', function () {
    var g = DS.temperature.general;
    var a = Mo.temperatureFactor('general', g.warn - 1, DS).k, b = Mo.temperatureFactor('general', g.warn, DS).k, c = Mo.temperatureFactor('general', g.alarm, DS);
    return truthy(a + ', ' + b + ', ' + c.k, a === 1 && b === g.warnK && c.k === g.alarmK && c.alarm);
  });

  test('Own temperature limits replace the shared type rule for that part only', 'motor with own limits ages by warnK; shared motor rule unchanged', function () {
    var c = comp('motor', 4, 7000, 100, 80, 0.3);
    var shared = Mo.temperatureFor(c, 80, DS).k;
    c.tempLimits = { warn: 78, alarm: 95, warnK: 1.5, alarmK: 2 };
    var own = Mo.temperatureFor(c, 80, DS).k, alarm = Mo.temperatureFor(c, 96, DS);
    return truthy(shared.toFixed(3) + ' -> ' + own + ', alarm ' + alarm.alarm, own === 1.5 && shared > 1 && shared < 1.5 && alarm.k === 2 && alarm.alarm);
  });
  test('Own limits are rejected when warning >= alarm or a multiplier is below 1', 'invalid ignored', function () {
    var prev = freshStore();
    var bad = St.sampleState();
    bad.components.motor.tempLimits = { warn: 90, alarm: 80, warnK: 1.2, alarmK: 1.6 };
    bad.components.bearing.tempLimits = { warn: 60, alarm: 80, warnK: 1.2, alarmK: 1.6 };
    St.importJSON(JSON.stringify(bad));
    var motorIgnored = St.state.components.motor.tempLimits === null;
    var ok = motorIgnored && St.state.components.bearing.tempLimits.alarm === 80;
    St.state = prev; St.commit = realCommit;
    return truthy('bad limits ignored = ' + motorIgnored + ', good limits kept', ok);
  });
  test('Tasks: add, rename, delete; schedule uses the part\'s own tasks and intervals', 'new task scheduled every 100 h', function () {
    var prev = freshStore();
    var c = St.state.components.motor, n0 = c.tasks.length;
    St.addTask('motor', { task: '  Tighten   belt ', type: 'check', interval: 100 });
    var t = c.tasks[c.tasks.length - 1];
    St.updateTask('motor', t.id, { task: 'Tighten drive belt' });
    var bad = St.addTask('motor', { task: '', type: 'check', interval: 100 }) || St.addTask('motor', { task: 'x', type: 'check', interval: 5 });
    var all = Mo.analyseAll(St.state), ev = Mo.buildSchedule(all, St.state, new Date(2026, 0, 1)).events.filter(function (e) { return e.task === 'Tighten drive belt'; });
    St.deleteTask('motor', t.id);
    var ok = n0 + 0 === c.tasks.length && !bad && ev.length > 10 && ev[1].atHours - ev[0].atHours === 100;
    St.state = prev; St.commit = realCommit;
    return truthy(ev.length + ' jobs, ' + (ev[1].atHours - ev[0].atHours) + ' h apart', ok);
  });
  test('Description and limits source survive a backup and restore', 'both kept', function () {
    var prev = freshStore();
    var id = St.addComponent({ name: 'Cutter', kind: 'general', description: 'Cuts the film roll.' });
    St.setOwnLimits(id, true); St.setLimitsSource(id, 'Manual p.4');
    St.importJSON(St.exportJSON());
    var c = St.state.components[id];
    var ok = c.description === 'Cuts the film roll.' && c.limitsSource === 'Manual p.4' && Mo.validLimits(c.tempLimits);
    St.state = prev; St.commit = realCommit;
    return truthy(c.description + ' / ' + c.limitsSource, ok);
  });

  PM.tests = {
    list: list,
    /** Run every test. @returns {{name:string, expected:string, actual:string, pass:boolean}[]} */
    run: function () {
      return list.map(function (t) {
        var res;
        try { res = t.fn(); } catch (e) { res = { actual: 'Error: ' + e.message, pass: false }; }
        var a = res.actual;
        if (typeof a === 'number') a = Number(a.toPrecision(8)).toString();
        return { name: t.name, expected: t.expected, actual: String(a), pass: res.pass };
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
