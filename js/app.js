/**
 * @file app.js
 * Bootstraps SachetGuard PM: loads stored data, wires the UI and starts hash routing.
 */
(function (root) {
  'use strict';

  var PM = root.PM;

  function start() {
    if (PM.charts && root.Chart) {
      root.Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    }
    PM.store.init();
    PM.ui.init();
    root.addEventListener('hashchange', function () { PM.ui.render({}); });
    if (!root.location.hash) root.history.replaceState(null, '', '#/dashboard');
    PM.ui.start();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window);
