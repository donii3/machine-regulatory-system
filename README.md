# SachetGuard PM

Predictive/preventive maintenance dashboard for the electric motor, bearing system and heat sealing element of a sachet water filling and sealing machine.

*Final-year B.Eng. Mechanical Engineering project – Elaigwu Wisdom Daniel, 21/57894/UE, Dept. of Mechanical Engineering, JOSTUM, 2026.*

Pure HTML5, CSS3 and vanilla JavaScript. No framework, no build step, no internet needed.

---

## 1. How to run

1. Open the `sachet-pm` folder.
2. **Double-click `index.html`.** It opens in your browser from `file://` and works offline.

Nothing is installed and no server is needed. Data is saved in the browser (localStorage) on the device you use.

**Single-file version (to email or put on a USB stick):**

```
node tools/bundle.js
```

This writes `dist/sachetguard-standalone.html`, one file containing all code and Chart.js. It needs Node 14+ only to build; the output runs anywhere.

**Validation tests:** double-click `tests/tests.html`. It shows a pass/fail table (69 tests) you can screenshot for the report.

---

## 2. How to present and defend it

1. Open the app. It starts with clearly labelled **sample data** so everything works at once.
2. Press **Presentation mode** (monitor icon, top right) for large text and charts on a projector.
3. Press **Guided demo** for a captioned walk-through: Dashboard → Component Detail → Calibration → Schedule → Cost → Validation. Use Next/Back, or Esc to leave.
4. For questions on the maths, open any component and expand **How was this calculated?**. Every formula is shown with the live numbers substituted.
5. To show the model reacting live, change *Hours since last replacement*, *Temperature* or *Vibration* on a component page. The status, remaining life, charts and recommendation update as you type.
6. Show the printed plan with **Maintenance Schedule → Print schedule** (clean black-on-white A4).
7. Show the unit tests (`tests/tests.html`) to prove the maths against hand-calculated values.

Suggested defence points:

- *Why Weibull?* The sample bearing data fits β ≈ 7.9, strongly wear-out, so a fixed-age replacement is justified. The exponential curve (constant risk) is drawn alongside for contrast.
- *Why condition-adjusted age?* A motor 10 °C over its rated temperature ages twice as fast (10-degree rule). Vibration zones follow ISO 10816-style limits.
- *How is the replacement age chosen?* Age-replacement model C(T) = [Cp·R(T) + Cf·(1−R(T))] / ∫R dt, minimised by grid search and golden-section refinement.
- *Limitations:* see the **How It Works** page. Mention the small sample and that thresholds are engineering assumptions.

---

## 3. How to enter real data

1. Open **Settings** and enter the machine name, operating hours per day and working days per week.
2. Press **Reset all data** (or keep the sample and overwrite it).
3. Add your own parts with **Add component** (Dashboard, or the + in the sidebar). Pick a name and a type (motor, bearing, heat element or other); the type sets the temperature rule and routine tasks. Use **Edit** or **Delete** on a part's page to change or remove it. Each part's page has three tabs: **Overview** (readings, status, charts), **Part setup** (description and its own warning/alarm temperature limits with a source note) and **Routine tasks** (add, rename or remove the repeating jobs). The sidebar and dashboard always list parts most urgent first.
4. Open **Model Calibration**, choose a component and add one record per failure: the operating hours the part had run when it failed.
   - A **suspension** is a part that was removed or is still running without failing. It still carries information, so include it.
   - Or **Import CSV** with columns `hours,type` (type is `failure` or `suspension`). A single column of hours is treated as failures.
5. Press **Fit Weibull**. At least 3 failures are needed. With fewer, enter β and η by hand if you have them from a manufacturer or earlier study.
6. Open **Cost Comparison** and replace the cost figures with the plant's own: repair cost, downtime hours, lost production per hour, new part cost, labour.
7. Open each component page and enter the current readings (hours since replacement, temperature, vibration, last maintenance date).
8. Use **Validation** to enter past failures and see whether the model would have prevented them.
9. **Settings → Back up data** downloads a JSON file with everything. **Restore backup** loads it again.

Limits for vibration and temperature in Settings are marked *engineering assumptions — cite source*. Check them against the machine manuals and cite the standard in the report.

---

## 4. Calculation engine (for the report appendix)

All maths is in `js/math.js` (pure functions, no DOM) and `js/model.js`. Every function has JSDoc stating the equation it implements.

| Quantity | Equation |
|---|---|
| MTBF, failure rate | MTBF = total hours ÷ failures; λ = 1/MTBF |
| Exponential | R(t) = exp(−λt); F(t) = 1 − R(t) |
| Weibull | R(t) = exp[−(t/η)^β]; f(t) = (β/η)(t/η)^(β−1)·R(t); h(t) = (β/η)(t/η)^(β−1) |
| Gamma, MTTF | Lanczos approximation; MTTF = η·Γ(1 + 1/β) |
| B10 life | t = η·(−ln 0.90)^(1/β) |
| Parameter fit | Median Rank Regression: Johnson adjusted ranks for suspensions, Bernard F = (i−0.3)/(n+0.4); y = ln(−ln(1−F)) on x = ln t; β = slope, η = exp(−intercept/β); R² reported |
| Conditional probability | P = 1 − R(t+Δt)/R(t), Δt = 100, 200, 500 h |
| Remaining useful life | RUL(t) = ∫ₜ^∞ R(x)dx / R(t), composite Simpson's rule, truncated where R < 10⁻⁶ |
| Effective age | t_eff = t·k_temp·k_vib |
| Cost rate | C(T) = [Cp·R(T) + Cf·(1−R(T))] / ∫₀ᵀ R(t)dt; T* by grid search + golden-section |
| Health status | GREEN: t_eff < 0.7·T* and P(200 h) < 10 %; RED: t_eff ≥ T*, P(200 h) ≥ 30 %, vibration zone D or temperature over alarm; otherwise YELLOW (B10 replaces T* when no optimum exists) |
| Monthly cost | Reactive = (monthly hours ÷ MTBF)·Cf; Proposed = C(T*)·monthly hours |

Implementation choices worth stating in the report:

- **Condition-adjusted time.** Wear runs `k = k_temp·k_vib` times faster, so the look-ahead window for failure probability is `k·Δt` in effective hours, and remaining life in real hours is the RUL divided by `k`. With `k = 1` these reduce to the plain formulas.
- **Vibration** is applied to the motor and bearing only. It is not used for the heat sealing element.
- **No optimum.** If β ≤ 1 or Cf ≤ Cp, no preventive optimum exists. The app says so in plain language and uses the B10 life as the replacement guide.
- **Reactive baseline** uses the MTBF from the records; if there are no failure records (hand-entered parameters), the Weibull MTTF is used.

---

## 5. Folder structure

```
sachet-pm/
  index.html
  css/   tokens.css  base.css  components.css  print.css
  js/    math.js  model.js  store.js  charts.js  ui.js  app.js
  vendor/chart.umd.min.js        Chart.js 4.5.1 (local copy, MIT licence)
  tests/ tests.html  tests.js    69 unit tests
  tools/ bundle.js               builds dist/sachetguard-standalone.html
```

Scripts are classic `<script>` tags loaded in dependency order and share the `window.PM` namespace (`PM.math`, `PM.model`, `PM.store`, `PM.ui`, `PM.charts`), so the app works from `file://`.

---

## 6. Browser support

Any current Chrome, Edge, Firefox or Safari, on desktop or phone. If the browser blocks local storage (some private windows), the app still works for the session and shows a warning in Settings. Use **Back up data** to save your work.
