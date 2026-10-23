/**
 * @file charts.js
 * All Chart.js configuration for SachetGuard PM. Colours come from the CSS
 * design tokens so charts follow the light/dark theme. Chart.js is loaded
 * locally from /vendor (no CDN).
 */
(function (root) {
  'use strict';

  var PM = root.PM = root.PM || {};
  var M = PM.math, fmt = PM.fmt;
  var C = PM.charts = {};
  var registry = {};

  /** Read a CSS custom property from :root. */
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  function palette() {
    return {
      weibull: css('--c-weibull'), exp: css('--c-exp'), hazard: css('--c-hazard'), cost: css('--c-cost'),
      marker: css('--c-marker'), grid: css('--c-grid'), text: css('--c-text'), ok: css('--ok-strong'),
      bad: css('--bad-strong'), surface: css('--surface'), warn: css('--warn-strong'), ink: css('--ink')
    };
  }

  function reduced() {
    return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) || document.body.classList.contains('reduce-motion');
  }

  /** Destroy a chart by canvas id. */
  C.destroy = function (id) { if (registry[id]) { registry[id].destroy(); delete registry[id]; } };
  /** Destroy every chart (called before the page is re-rendered). */
  C.destroyAll = function () { Object.keys(registry).forEach(C.destroy); };

  function axisTitle(text, p) {
    return { display: true, text: text, color: p.text, font: { weight: '700', size: 12 } };
  }

  function baseOptions(p, opts) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: (opts && opts.animate === false) || reduced() ? false : { duration: 900, easing: 'easeOutQuart' },
      interaction: { mode: 'nearest', intersect: false, axis: 'x' },
      plugins: {
        legend: { position: 'bottom', labels: { color: p.text, usePointStyle: true, boxWidth: 8, padding: 14, font: { size: 12, weight: '600' } } },
        tooltip: { backgroundColor: '#062a3a', titleColor: '#fff', bodyColor: '#dff1f6', padding: 10, cornerRadius: 8 }
      }
    };
  }

  function make(id, config) {
    var canvas = document.getElementById(id);
    if (!canvas || !root.Chart) return null;
    C.destroy(id);
    var ch = new root.Chart(canvas.getContext('2d'), config);
    registry[id] = ch;
    return ch;
  }

  /** Inline plugin: draws labelled vertical marker lines at given x values. */
  function markerPlugin(markers) {
    return {
      id: 'markers',
      afterDatasetsDraw: function (chart) {
        var ctx = chart.ctx, x = chart.scales.x, y = chart.scales.y;
        markers.forEach(function (m, idx) {
          if (!isFinite(m.x)) return;
          var px = x.getPixelForValue(m.x);
          if (px < x.left - 1 || px > x.right + 1) return;
          ctx.save();
          ctx.strokeStyle = m.color; ctx.lineWidth = 2; ctx.setLineDash(m.dash || []);
          ctx.beginPath(); ctx.moveTo(px, y.top); ctx.lineTo(px, y.bottom); ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = '700 12px system-ui, sans-serif';
          var tw = ctx.measureText(m.label).width + 14;
          var tx = Math.min(Math.max(px - tw / 2, x.left), x.right - tw);
          var ty = y.top + 6 + idx * 24;
          ctx.fillStyle = m.color;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(tx, ty, tw, 20, 6); else ctx.rect(tx, ty, tw, 20);
          ctx.fill();
          ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
          ctx.fillText(m.label, tx + 7, ty + 10.5);
          ctx.restore();
        });
      }
    };
  }

  function range(max, n) {
    var pts = [];
    for (var i = 0; i <= n; i++) pts.push(max * i / n);
    return pts;
  }

  /** Exponential vs Weibull reliability with a "You are here" marker at t_eff. */
  C.reliability = function (id, a, opts) {
    var p = palette();
    var xmax = Math.max(a.eta * 1.5, a.tEff * 1.25, a.refLife * 1.2);
    var ts = range(xmax, 160);
    var markers = [{ x: a.tEff, color: p.marker, label: 'You are here' }];
    markers.push({ x: a.refLife, color: p.bad, label: a.basis === 'T*' ? 'Replace here (T*)' : 'Replace here (B10)', dash: [6, 4] });
    var o = baseOptions(p, opts);
    return make(id, {
      type: 'line',
      data: {
        datasets: [
          { label: 'Wear-out model (Weibull)', data: ts.map(function (t) { return { x: t, y: 100 * a.R(t) }; }), borderColor: p.weibull, backgroundColor: p.weibull, borderWidth: 3, pointRadius: 0, tension: .15 },
          { label: 'Constant-risk model (exponential)', data: ts.map(function (t) { return { x: t, y: 100 * M.expReliability(t, a.lambda) }; }), borderColor: p.exp, backgroundColor: p.exp, borderWidth: 2.5, borderDash: [7, 5], pointRadius: 0, tension: .15 }
        ]
      },
      options: Object.assign(o, {
        scales: {
          x: { type: 'linear', min: 0, max: xmax, title: axisTitle('Operating hours', p), grid: { color: p.grid }, ticks: { color: p.text, callback: function (v) { return fmt.num(v); }, maxTicksLimit: 8 } },
          y: { min: 0, max: 100, title: axisTitle('Chance the part is still working (%)', p), grid: { color: p.grid }, ticks: { color: p.text, callback: function (v) { return v + '%'; } } }
        }
      }),
      plugins: [markerPlugin(markers)]
    });
  };

  /** Hazard-rate curve (risk of failing in the next hour) with a marker at t_eff. */
  C.hazard = function (id, a, opts) {
    var p = palette();
    var xmax = Math.max(a.eta * 1.5, a.tEff * 1.25);
    var ts = range(xmax, 160).slice(1);
    var o = baseOptions(p, opts);
    return make(id, {
      type: 'line',
      data: {
        datasets: [{ label: 'Risk of failing (per 1,000 h)', data: ts.map(function (t) { return { x: t, y: 1000 * M.weibullHazard(t, a.beta, a.eta) }; }), borderColor: p.hazard, backgroundColor: p.hazard, borderWidth: 3, pointRadius: 0, tension: .15 }]
      },
      options: Object.assign(o, {
        scales: {
          x: { type: 'linear', min: 0, max: xmax, title: axisTitle('Operating hours', p), grid: { color: p.grid }, ticks: { color: p.text, callback: function (v) { return fmt.num(v); }, maxTicksLimit: 8 } },
          y: { min: 0, title: axisTitle('Risk of failing in the next 1,000 h', p), grid: { color: p.grid }, ticks: { color: p.text, callback: function (v) { return fmt.num(v, v < 10 ? 1 : 0); } } }
        }
      }),
      plugins: [markerPlugin([{ x: a.tEff, color: p.marker, label: 'You are here' }])]
    });
  };

  /** Cost per operating hour C(T) with the optimum T* marked. */
  C.cost = function (id, a, opts) {
    var p = palette();
    var xmax = Math.max(a.eta * 1.8, (a.Tstar || 0) * 2.2);
    var xmin = xmax * 0.03;
    var pts = [], i, n = 90, minC = Infinity;
    for (i = 0; i <= n; i++) {
      var T = xmin + (xmax - xmin) * i / n;
      var c = M.costRate(T, a.R, a.Cp, a.Cf, 300);
      if (c < minC) minC = c;
      pts.push({ x: T, y: c });
    }
    var o = baseOptions(p, opts);
    var datasets = [{ label: 'Cost per operating hour', data: pts, borderColor: p.cost, backgroundColor: p.cost, borderWidth: 3, pointRadius: 0, tension: .15 }];
    if (a.opt.exists) {
      datasets.push({ label: 'Best replacement age (T*)', data: [{ x: a.opt.T, y: a.opt.cost }], borderColor: p.bad, backgroundColor: p.bad, pointRadius: 8, pointHoverRadius: 10, showLine: false });
    }
    return make(id, {
      type: 'line',
      data: { datasets: datasets },
      options: Object.assign(o, {
        scales: {
          x: { type: 'linear', min: 0, max: xmax, title: axisTitle('Replace the part after this many operating hours', p), grid: { color: p.grid }, ticks: { color: p.text, callback: function (v) { return fmt.num(v); }, maxTicksLimit: 8 } },
          y: { min: 0, max: Math.ceil(minC * 4), title: axisTitle('Cost per operating hour (' + fmt.symbol + ')', p), grid: { color: p.grid }, ticks: { color: p.text, callback: function (v) { return fmt.symbol + fmt.num(v); } } }
        }
      }),
      plugins: [markerPlugin([{ x: a.tEff, color: p.marker, label: 'You are here' }])]
    });
  };

  /** Weibull probability plot: ln(t) against ln(-ln(1-F)) with the regression line. */
  C.probabilityPlot = function (id, fit, opts) {
    var p = palette();
    var xs = fit.points.map(function (q) { return q.x; });
    var xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs);
    var pad = (xmax - xmin) * 0.15 || 0.2;
    var lo = xmin - pad, hi = xmax + pad;
    var line = [{ x: lo, y: fit.line.slope * lo + fit.line.intercept }, { x: hi, y: fit.line.slope * hi + fit.line.intercept }];
    var o = baseOptions(p, opts);
    var timeTicks = function (scale) {
      var out = [], minH = Math.exp(scale.min), maxH = Math.exp(scale.max);
      var raw = (maxH - minH) / 6, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = mag;
      [1, 2, 2.5, 5, 10].some(function (m) { step = m * mag; return step >= raw; });
      for (var h = Math.ceil(minH / step) * step; h <= maxH; h += step) out.push({ value: Math.log(h) });
      scale.ticks = out.length >= 2 ? out : scale.ticks;
    };
    var pctTicks = function (scale) {
      var out = [];
      [1, 2, 5, 10, 20, 30, 50, 63.2, 80, 90, 95, 99].forEach(function (pc) {
        var v = Math.log(-Math.log(1 - pc / 100));
        if (v >= scale.min && v <= scale.max) out.push({ value: v });
      });
      scale.ticks = out.length >= 2 ? out : scale.ticks;
    };
    return make(id, {
      type: 'scatter',
      data: {
        datasets: [
          { label: 'Your failure records', data: fit.points.map(function (q) { return { x: q.x, y: q.y }; }), backgroundColor: p.weibull, borderColor: p.surface, borderWidth: 2, pointRadius: 7, pointHoverRadius: 9 },
          { type: 'line', label: 'Best-fit straight line', data: line, borderColor: p.exp, backgroundColor: p.exp, borderWidth: 2.5, pointRadius: 0 }
        ]
      },
      options: Object.assign(o, {
        interaction: { mode: 'nearest', intersect: true },
        plugins: Object.assign({}, o.plugins, {
          tooltip: Object.assign({}, o.plugins.tooltip, {
            callbacks: {
              label: function (ctx) {
                if (ctx.datasetIndex !== 0) return ctx.dataset.label;
                var q = fit.points[ctx.dataIndex];
                return fmt.num(q.hours) + ' h  –  ' + fmt.pct(q.F, 1) + ' failed';
              }
            }
          })
        }),
        scales: {
          x: { type: 'linear', min: lo, max: hi, afterBuildTicks: timeTicks, title: axisTitle('Operating hours at failure (log scale)', p), grid: { color: p.grid }, ticks: { color: p.text, callback: function (v) { return fmt.num(Math.exp(v)); } } },
          y: { min: Math.min.apply(null, fit.points.map(function (q) { return q.y; })) - 0.5, max: Math.max.apply(null, fit.points.map(function (q) { return q.y; })) + 0.5, afterBuildTicks: pctTicks, title: axisTitle('Share of parts that have failed (%)', p), grid: { color: p.grid }, ticks: { color: p.text, callback: function (v) { var pc = 100 * (1 - Math.exp(-Math.exp(v))); return (pc < 10 ? pc.toFixed(1) : Math.round(pc)) + '%'; } } }
        }
      })
    });
  };

  /** Grouped bar chart: reactive versus proposed monthly cost per component. */
  C.costBars = function (id, cmp, opts) {
    var p = palette();
    var short = { motor: 'Motor', bearing: 'Bearing', sealer: 'Sealer' };
    var labels = cmp.rows.map(function (r) { return short[r.id] || r.name; }).concat(['All parts']);
    var o = baseOptions(p, opts);
    return make(id, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Run until it breaks (reactive)', data: cmp.rows.map(function (r) { return r.reactive; }).concat([cmp.total.reactive]), backgroundColor: p.bad, borderRadius: 6 },
          { label: 'Planned replacement (proposed)', data: cmp.rows.map(function (r) { return r.proposed; }).concat([cmp.total.proposed]), backgroundColor: p.weibull, borderRadius: 6 }
        ]
      },
      options: Object.assign(o, {
        interaction: { mode: 'index', intersect: false },
        plugins: Object.assign({}, o.plugins, { tooltip: Object.assign({}, o.plugins.tooltip, { callbacks: { label: function (c) { return c.dataset.label + ': ' + fmt.naira(c.parsed.y); } } }) }),
        scales: {
          x: { grid: { display: false }, ticks: { color: p.text, font: { weight: '700' } } },
          y: { beginAtZero: true, title: axisTitle('Cost per month (' + fmt.symbol + ')', p), grid: { color: p.grid }, ticks: { color: p.text, callback: function (v) { return fmt.symbol + fmt.num(v); } } }
        }
      })
    });
  };

  /** 12-month cumulative savings line chart. */
  C.cumulative = function (id, cmp, opts) {
    var p = palette();
    var o = baseOptions(p, opts);
    var labels = cmp.months.map(function (_, i) { return 'Month ' + (i + 1); });
    return make(id, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{ label: 'Money saved so far', data: cmp.months, borderColor: p.ok, backgroundColor: p.ok + '33', fill: true, borderWidth: 3, pointRadius: 3, tension: .25 }]
      },
      options: Object.assign(o, {
        plugins: Object.assign({}, o.plugins, { tooltip: Object.assign({}, o.plugins.tooltip, { callbacks: { label: function (c) { return 'Saved: ' + fmt.naira(c.parsed.y); } } }) }),
        scales: {
          x: { grid: { display: false }, ticks: { color: p.text, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
          y: { beginAtZero: true, title: axisTitle('Cumulative savings (' + fmt.symbol + ')', p), grid: { color: p.grid }, ticks: { color: p.text, callback: function (v) { return fmt.symbol + fmt.num(v); } } }
        }
      })
    });
  };

})(typeof window !== 'undefined' ? window : globalThis);
