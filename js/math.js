/**
 * @file math.js
 * Pure reliability mathematics for SachetGuard PM. No DOM access.
 * Every function documents the engineering equation it implements.
 * Loaded as a classic script; exposes everything on window.PM.math.
 */
(function (root) {
  'use strict';

  var PM = root.PM = root.PM || {};
  var M = PM.math = {};

  /* ------------------------------------------------------------------ *
   *  1. Basic reliability measures
   * ------------------------------------------------------------------ */

  /**
   * Mean Time Between Failures.
   * Equation:  MTBF = (total operating hours) / (number of failures)
   * @param {number} totalHours Total accumulated operating hours.
   * @param {number} failures   Number of failures observed (> 0).
   * @returns {number} MTBF in hours, or NaN if failures <= 0.
   */
  M.mtbf = function (totalHours, failures) {
    if (!(failures > 0) || !(totalHours >= 0)) return NaN;
    return totalHours / failures;
  };

  /**
   * Constant failure rate.
   * Equation:  lambda = 1 / MTBF
   * @param {number} mtbf Mean time between failures (h).
   * @returns {number} Failures per hour.
   */
  M.failureRate = function (mtbf) {
    return mtbf > 0 ? 1 / mtbf : NaN;
  };

  /**
   * Exponential reliability (probability of surviving to time t).
   * Equation:  R(t) = exp(-lambda * t)
   * @param {number} t      Operating time (h).
   * @param {number} lambda Failure rate (1/h).
   * @returns {number} R(t) in [0, 1].
   */
  M.expReliability = function (t, lambda) {
    return Math.exp(-lambda * Math.max(0, t));
  };

  /**
   * Exponential unreliability (probability of failure by time t).
   * Equation:  F(t) = 1 - R(t) = 1 - exp(-lambda * t)
   * @param {number} t Operating time (h).
   * @param {number} lambda Failure rate (1/h).
   * @returns {number} F(t) in [0, 1].
   */
  M.expUnreliability = function (t, lambda) {
    return 1 - M.expReliability(t, lambda);
  };

  /* ------------------------------------------------------------------ *
   *  2. Weibull distribution
   * ------------------------------------------------------------------ */

  /**
   * Weibull reliability function.
   * Equation:  R(t) = exp( -(t / eta)^beta )
   * @param {number} t    Operating time (h).
   * @param {number} beta Shape parameter (> 0).
   * @param {number} eta  Scale parameter / characteristic life (h, > 0).
   * @returns {number} R(t) in [0, 1].
   */
  M.weibullR = function (t, beta, eta) {
    if (t <= 0) return 1;
    return Math.exp(-Math.pow(t / eta, beta));
  };

  /**
   * Weibull unreliability (cumulative failure probability).
   * Equation:  F(t) = 1 - exp( -(t / eta)^beta )
   * @param {number} t Operating time (h).
   * @param {number} beta Shape parameter.
   * @param {number} eta Scale parameter (h).
   * @returns {number} F(t) in [0, 1].
   */
  M.weibullF = function (t, beta, eta) {
    return 1 - M.weibullR(t, beta, eta);
  };

  /**
   * Weibull probability density function.
   * Equation:  f(t) = (beta/eta) * (t/eta)^(beta-1) * R(t)
   * @param {number} t Operating time (h).
   * @param {number} beta Shape parameter.
   * @param {number} eta Scale parameter (h).
   * @returns {number} f(t), failures per hour per unit probability.
   */
  M.weibullPdf = function (t, beta, eta) {
    if (t < 0) return 0;
    if (t === 0) return beta === 1 ? 1 / eta : (beta < 1 ? Infinity : 0);
    return (beta / eta) * Math.pow(t / eta, beta - 1) * M.weibullR(t, beta, eta);
  };

  /**
   * Weibull hazard (instantaneous failure) rate.
   * Equation:  h(t) = f(t)/R(t) = (beta/eta) * (t/eta)^(beta-1)
   * @param {number} t Operating time (h).
   * @param {number} beta Shape parameter.
   * @param {number} eta Scale parameter (h).
   * @returns {number} h(t) in failures per hour.
   */
  M.weibullHazard = function (t, beta, eta) {
    if (t < 0) return 0;
    if (t === 0) return beta === 1 ? 1 / eta : (beta < 1 ? Infinity : 0);
    return (beta / eta) * Math.pow(t / eta, beta - 1);
  };

  /**
   * Gamma function by the Lanczos approximation (g = 7, 9 coefficients).
   * Equation:  Gamma(z) = sqrt(2*pi) * t^(z+0.5) * exp(-t) * A_g(z),
   *            with t = z + g + 0.5 and z shifted by -1 (for z >= 0.5);
   *            reflection  Gamma(z) = pi / (sin(pi z) * Gamma(1 - z))  for z < 0.5
   * @param {number} z Argument (real, not a non-positive integer).
   * @returns {number} Gamma(z).
   */
  M.gamma = function (z) {
    var g = 7;
    var c = [
      0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
    ];
    if (z < 0.5) {
      return Math.PI / (Math.sin(Math.PI * z) * M.gamma(1 - z));
    }
    z -= 1;
    var x = c[0];
    for (var i = 1; i < g + 2; i++) x += c[i] / (z + i);
    var t = z + g + 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  };

  /**
   * Weibull mean time to failure.
   * Equation:  MTTF = eta * Gamma(1 + 1/beta)
   * @param {number} beta Shape parameter.
   * @param {number} eta Scale parameter (h).
   * @returns {number} MTTF in hours.
   */
  M.weibullMTTF = function (beta, eta) {
    return eta * M.gamma(1 + 1 / beta);
  };

  /**
   * Weibull life at a given unreliability (B-life), closed form.
   * Equation:  R(t) = 1 - p  =>  t = eta * ( -ln(1 - p) )^(1/beta)
   * @param {number} p    Fraction failed by time t (0.10 gives B10 life).
   * @param {number} beta Shape parameter.
   * @param {number} eta  Scale parameter (h).
   * @returns {number} t in hours at which F(t) = p.
   */
  M.weibullBLife = function (p, beta, eta) {
    return eta * Math.pow(-Math.log(1 - p), 1 / beta);
  };

  /**
   * B10 life: time by which 10 % of units are expected to have failed (R = 0.90).
   * Equation:  t10 = eta * ( -ln(0.90) )^(1/beta)
   * @param {number} beta Shape parameter.
   * @param {number} eta Scale parameter (h).
   * @returns {number} B10 life in hours.
   */
  M.b10 = function (beta, eta) {
    return M.weibullBLife(0.10, beta, eta);
  };

  /* ------------------------------------------------------------------ *
   *  3. Parameter estimation: Median Rank Regression
   * ------------------------------------------------------------------ */

  /**
   * Ordinary least-squares straight line fit y = slope * x + intercept.
   * Equations:  slope = Sxy / Sxx,  intercept = ybar - slope * xbar,
   *             R^2 = 1 - SSres / SStot
   * @param {number[]} xs Independent values.
   * @param {number[]} ys Dependent values.
   * @returns {{slope:number, intercept:number, r2:number}|null} null if degenerate.
   */
  M.linearRegression = function (xs, ys) {
    var n = xs.length, i;
    if (n < 2) return null;
    var sx = 0, sy = 0;
    for (i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; }
    var xbar = sx / n, ybar = sy / n;
    var sxx = 0, sxy = 0, syy = 0;
    for (i = 0; i < n; i++) {
      sxx += (xs[i] - xbar) * (xs[i] - xbar);
      sxy += (xs[i] - xbar) * (ys[i] - ybar);
      syy += (ys[i] - ybar) * (ys[i] - ybar);
    }
    if (sxx === 0) return null;
    var slope = sxy / sxx;
    var intercept = ybar - slope * xbar;
    var r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
    return { slope: slope, intercept: intercept, r2: r2 };
  };

  /**
   * Bernard's approximation for the median rank of the i-th (adjusted) order.
   * Equation:  F = (i - 0.3) / (n + 0.4)
   * @param {number} rank Adjusted rank i (may be fractional with suspensions).
   * @param {number} n    Total number of records (failures + suspensions).
   * @returns {number} Median rank estimate of F.
   */
  M.bernardRank = function (rank, n) {
    return (rank - 0.3) / (n + 0.4);
  };

  /**
   * Johnson's adjusted ranks for data containing suspensions (censored units).
   * Equation (for the i-th record in ascending order, reverse rank r = n - i + 1):
   *   increment = (n + 1 - previous adjusted rank) / (1 + r)
   *   adjusted rank = previous adjusted rank + increment      (failures only)
   * Suspensions receive no rank but still reduce r for later failures.
   * At equal hours, failures are ordered before suspensions.
   * @param {{hours:number, type:string}[]} records Records with type "failure" or "suspension".
   * @returns {{hours:number, rank:number, F:number}[]} One entry per failure.
   */
  M.johnsonAdjustedRanks = function (records) {
    var sorted = records.slice().sort(function (a, b) {
      if (a.hours !== b.hours) return a.hours - b.hours;
      if (a.type === b.type) return 0;
      return a.type === 'failure' ? -1 : 1;
    });
    var n = sorted.length;
    var prev = 0;
    var out = [];
    for (var i = 0; i < n; i++) {
      if (sorted[i].type !== 'failure') continue;
      var r = n - i; // reverse rank, i is zero-based here
      var inc = (n + 1 - prev) / (1 + r);
      var adj = prev + inc;
      out.push({ hours: sorted[i].hours, rank: adj, F: M.bernardRank(adj, n) });
      prev = adj;
    }
    return out;
  };

  /**
   * Fit a two-parameter Weibull by Median Rank Regression (rank regression on Y).
   * Linearisation:  ln(-ln(1 - F)) = beta * ln(t) - beta * ln(eta)
   * so with y = ln(-ln(1-F)) and x = ln(t):
   *   beta = slope,   eta = exp(-intercept / beta)
   * Requires at least 3 failures.
   * @param {{hours:number, type:string}[]} records Failure / suspension records.
   * @returns {{ok:boolean, message?:string, beta?:number, eta?:number, r2?:number,
   *            failures?:number, suspensions?:number,
   *            points?:{x:number,y:number,hours:number,F:number}[],
   *            line?:{slope:number,intercept:number}}}
   */
  M.fitWeibullMRR = function (records) {
    var clean = (records || []).filter(function (r) {
      return r && isFinite(r.hours) && r.hours > 0 &&
        (r.type === 'failure' || r.type === 'suspension');
    });
    var failures = clean.filter(function (r) { return r.type === 'failure'; }).length;
    var suspensions = clean.length - failures;
    if (failures < 3) {
      return {
        ok: false, failures: failures, suspensions: suspensions,
        message: 'At least 3 failure records are needed to fit the model. ' +
          'You have ' + failures + '. Add more records or enter the shape and scale values by hand.'
      };
    }
    var ranks = M.johnsonAdjustedRanks(clean);
    var xs = [], ys = [], points = [];
    ranks.forEach(function (p) {
      var x = Math.log(p.hours);
      var y = Math.log(-Math.log(1 - p.F));
      xs.push(x); ys.push(y);
      points.push({ x: x, y: y, hours: p.hours, F: p.F });
    });
    var fit = M.linearRegression(xs, ys);
    if (!fit || !(fit.slope > 0)) {
      return {
        ok: false, failures: failures, suspensions: suspensions,
        message: 'The failure times are too similar to fit a curve. Check the data or enter the values by hand.'
      };
    }
    return {
      ok: true, failures: failures, suspensions: suspensions,
      beta: fit.slope,
      eta: Math.exp(-fit.intercept / fit.slope),
      r2: fit.r2,
      points: points,
      line: { slope: fit.slope, intercept: fit.intercept }
    };
  };

  /* ------------------------------------------------------------------ *
   *  4. Conditional probability, numerical integration, RUL
   * ------------------------------------------------------------------ */

  /**
   * Probability of failing in the next dt hours, given survival to time t.
   * Equation:  P = 1 - R(t + dt) / R(t)
   * @param {function(number):number} Rfn Reliability function R(t).
   * @param {number} t  Current age (h).
   * @param {number} dt Look-ahead window (h).
   * @returns {number} Conditional failure probability in [0, 1].
   */
  M.conditionalFailureProb = function (Rfn, t, dt) {
    var r0 = Rfn(t);
    if (!(r0 > 0)) return 1;
    return Math.min(1, Math.max(0, 1 - Rfn(t + dt) / r0));
  };

  /**
   * Composite Simpson's rule.
   * Equation:  integral_a^b f(x) dx ~ (h/3) [ f0 + 4 f1 + 2 f2 + ... + 4 f(n-1) + fn ],
   *            h = (b - a) / n,  n even
   * @param {function(number):number} f Integrand.
   * @param {number} a Lower limit.
   * @param {number} b Upper limit.
   * @param {number} [n=2000] Number of sub-intervals (rounded up to even).
   * @returns {number} Approximate integral.
   */
  M.simpson = function (f, a, b, n) {
    n = n || 2000;
    if (n % 2) n += 1;
    if (b === a) return 0;
    var h = (b - a) / n;
    var s = f(a) + f(b);
    for (var i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
    return s * h / 3;
  };

  /**
   * Remaining Useful Life as mean residual life.
   * Equation:  RUL(t) = [ integral_t^inf R(x) dx ] / R(t)
   * The infinite integral is truncated where R(x) < 1e-6 (upper limit found by
   * doubling the span) and evaluated with composite Simpson's rule.
   * @param {function(number):number} Rfn Reliability function R(x).
   * @param {number} t Current (effective) age in hours.
   * @returns {number} Expected remaining hours of life (0 if R(t) is negligible).
   */
  M.meanResidualLife = function (Rfn, t) {
    var r0 = Rfn(t);
    if (!(r0 > 1e-12)) return 0;
    var span = 1;
    while (Rfn(t + span) >= 1e-6 && span < 1e9) span *= 2;
    return M.simpson(Rfn, t, t + span, 4000) / r0;
  };

  /**
   * Convert operating hours to calendar days.
   * Equation:  days = hours / (hours per day) * (7 / days per week)
   * @param {number} hours Operating hours.
   * @param {number} hoursPerDay Operating hours per working day.
   * @param {number} [daysPerWeek=7] Working days per week.
   * @returns {number} Calendar days.
   */
  M.hoursToCalendarDays = function (hours, hoursPerDay, daysPerWeek) {
    if (!(hoursPerDay > 0)) return NaN;
    var d = daysPerWeek > 0 ? daysPerWeek : 7;
    return hours / hoursPerDay * (7 / d);
  };

  /* ------------------------------------------------------------------ *
   *  5. Age-replacement cost optimisation
   * ------------------------------------------------------------------ */

  /**
   * Long-run expected cost per operating hour of an age-replacement policy.
   * Equation:  C(T) = [ Cp * R(T) + Cf * (1 - R(T)) ] / integral_0^T R(t) dt
   * Cp = planned replacement cost, Cf = failure (unplanned) cost.
   * @param {number} T Replacement age (h, > 0).
   * @param {function(number):number} Rfn Reliability function.
   * @param {number} Cp Planned replacement cost (₦).
   * @param {number} Cf Failure cost (₦).
   * @param {number} [n=400] Simpson sub-intervals for the denominator.
   * @returns {number} Cost per hour (₦/h); Infinity if T <= 0.
   */
  M.costRate = function (T, Rfn, Cp, Cf, n) {
    if (!(T > 0)) return Infinity;
    var R = Rfn(T);
    var denom = M.simpson(Rfn, 0, T, n || 400);
    if (!(denom > 0)) return Infinity;
    return (Cp * R + Cf * (1 - R)) / denom;
  };

  /**
   * Find the cost-optimal replacement age T* for a Weibull component.
   * Method: fine grid search of C(T) over (0, 10*eta], then golden-section
   * refinement inside the bracket around the grid minimum.
   * A finite optimum only exists when beta > 1 (wear-out) and Cf > Cp.
   * @param {number} beta Weibull shape.
   * @param {number} eta  Weibull scale (h).
   * @param {number} Cp   Planned replacement cost (₦).
   * @param {number} Cf   Failure cost (₦).
   * @returns {{exists:boolean, T?:number, cost?:number, reason?:string}}
   *   reason is a plain-language explanation when no optimum exists.
   */
  M.optimalReplacementAge = function (beta, eta, Cp, Cf) {
    if (!(beta > 1)) {
      return {
        exists: false,
        reason: 'This part does not wear out with age (its failures are random or early-life). ' +
          'Replacing it on a fixed schedule would not reduce failures or cost, ' +
          'so use condition monitoring instead.'
      };
    }
    if (!(Cf > Cp)) {
      return {
        exists: false,
        reason: 'A planned replacement costs as much as, or more than, a breakdown. ' +
          'Waiting for the part to fail is the cheaper option on these cost figures.'
      };
    }
    var Rfn = function (t) { return M.weibullR(t, beta, eta); };
    var cost = function (T) { return M.costRate(T, Rfn, Cp, Cf, 400); };

    var N = 2000, hi = 10 * eta;
    var step = hi / N, best = Infinity, bestI = 1, i, c;
    for (i = 1; i <= N; i++) {
      c = cost(i * step);
      if (c < best) { best = c; bestI = i; }
    }
    if (bestI === N) {
      return {
        exists: false,
        reason: 'No clear best replacement age was found: the cost keeps falling the longer the part is run.'
      };
    }
    var a = Math.max(step * 0.5, (bestI - 1) * step);
    var b = (bestI + 1) * step;
    var gr = (Math.sqrt(5) - 1) / 2;
    var x1 = b - gr * (b - a), x2 = a + gr * (b - a);
    var f1 = cost(x1), f2 = cost(x2);
    for (i = 0; i < 80 && (b - a) > 1e-4; i++) {
      if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = b - gr * (b - a); f1 = cost(x1); }
      else { a = x1; x1 = x2; f1 = f2; x2 = a + gr * (b - a); f2 = cost(x2); }
    }
    var T = (a + b) / 2;
    return { exists: true, T: T, cost: M.costRate(T, Rfn, Cp, Cf, 2000) };
  };

})(typeof window !== 'undefined' ? window : globalThis);
