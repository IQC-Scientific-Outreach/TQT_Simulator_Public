/* =========================================================================
 * TQT Photonic Quantum Simulator — web front-end
 *
 * Boots Pyodide, loads the (unchanged) Python simulation drivers + the
 * sim_bridge, and drives them from a web UI that mirrors the PyQt desktop app.
 * ========================================================================= */

let pyodide = null;
let simProxy = null;

const PY_FILES = [
  "timetagger_uqd_sim.py",
  "laser_toptica_sim.py",
  "powermeter_thorlabs_sim.py",
  "sim_bridge.py",
];

/* ----- UI config (mirrors ui_config in interface_public.py) ----- */
const NUMBER_POINTS_MEM = 100;
const NUM_COUNT_PLOTS = 4;
let integrationMs = 1000;

/* ----- runtime state ----- */
let timer = null;
let isMeasuring = false;
let isContinuous = true;
let isDarkMode = true;

/* =========================================================================
 * Pyodide bootstrap
 * ========================================================================= */
async function boot() {
  const status = document.getElementById("loader-status");
  status.textContent = "Loading Python runtime…";
  pyodide = await loadPyodide();

  status.textContent = "Loading NumPy…";
  await pyodide.loadPackage("numpy");

  status.textContent = "Loading simulator…";
  pyodide.FS.mkdir("/sim");
  for (const f of PY_FILES) {
    const text = await (await fetch("py/" + f)).text();
    pyodide.FS.writeFile("/sim/" + f, text);
  }
  pyodide.runPython("import sys; sys.path.insert(0, '/sim')");
  await pyodide.runPythonAsync("from sim_bridge import sim");
  simProxy = pyodide.globals.get("sim");

  buildUI();
  wireEvents();
  document.getElementById("loader").style.display = "none";

  startTimer();
}

/* Call a method on the Python `sim` object, converting args/results. */
function pyCall(method, ...args) {
  const pyArgs = args.map((a) =>
    a !== null && typeof a === "object" ? pyodide.toPy(a) : a
  );
  let res = simProxy[method](...pyArgs);
  pyArgs.forEach((p) => p && p.destroy && p.destroy());
  if (res && res.toJs) {
    const j = res.toJs({ dict_converter: Object.fromEntries });
    res.destroy();
    return j;
  }
  return res;
}

/* =========================================================================
 * UI construction
 * ========================================================================= */
const DEFAULT_DELAYS = [10.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

/* Stat-plot patterns: plot j has channel `ch` on if bit (ch-1) of (j+1) set. */
function defaultStatPattern(j) {
  const n = j + 1;
  const pat = [];
  for (let ch = 1; ch <= 16; ch++) pat.push(((n >> (ch - 1)) & 1) === 1);
  return pat;
}
const statPatterns = Array.from({ length: NUM_COUNT_PLOTS }, (_, j) =>
  defaultStatPattern(j)
);
const statPlotData = Array.from({ length: NUM_COUNT_PLOTS }, () =>
  new Array(NUMBER_POINTS_MEM).fill(0)
);
const statX = Array.from({ length: NUMBER_POINTS_MEM }, (_, i) =>
  -10 + (10 * i) / (NUMBER_POINTS_MEM - 1)
);

const SOURCE_PRESETS = [
  ["|01⟩", 0],
  ["|Ψ-⟩", 22.5],
  ["|10⟩", 45],
  ["|Ψ+⟩", 67.5],
];

const BASIS_BUTTONS = [
  // [col, row, label, key]
  [0, 0, "Z+", "Z+"], [0, 1, "Z-", "Z-"],
  [1, 0, "X+", "X+"], [1, 1, "X-", "X-"],
  [2, 0, "Y+", "Y+"], [2, 1, "Y-", "Y-"],
  [3, 0, "(-Z-X)/√2", "-Z-X"], [3, 1, "(-Z+X)/√2", "-Z+X"],
];
const BASIS_PRESETS = {
  "Z+": [0.0, 0.0], "Z-": [45.0, 0.0],
  "X+": [22.5, 45.0], "X-": [67.5, 45.0],
  "Y+": [22.5, 0.0], "Y-": [67.5, 0.0],
  "-Z-X": [56.25, 112.5], "-Z+X": [33.75, 67.5],
};

const partyControls = {}; // name -> {hwp, qwp, qwpCheck}

function buildUI() {
  buildDelaysTable();
  buildSourcePresets();
  buildParties();
  buildStatPlots();
  buildCountsModel();
  buildCountsTables();
}

function buildDelaysTable() {
  const tbody = document.querySelector("#delays-table tbody");
  tbody.innerHTML = "";
  for (let i = 0; i < 16; i++) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>Ch${i + 1}</td><td><input type="number" step="0.1"
      class="delay-input" data-ch="${i}" value="${DEFAULT_DELAYS[i]}" /></td>`;
    tbody.appendChild(tr);
  }
}

function buildSourcePresets() {
  const row = document.getElementById("source-presets");
  for (const [label, angle] of SOURCE_PRESETS) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.onclick = () => {
      setSlider("source-hwp", angle);
      updatePolarization();
    };
    row.appendChild(btn);
  }
}

function buildParties() {
  const parties = pyCall("get_parties");
  const container = document.getElementById("parties");
  container.innerHTML = "";
  for (const p of parties) {
    const div = document.createElement("div");
    div.className = "party";

    const headers = ["Z Basis", "X Basis", "Y Basis", "CHSH"];
    let gridCells = headers.map((h) => `<div class="col-head">${h}</div>`).join("");
    // place buttons by [col,row]; build a 4x2 grid below the header row
    const slots = {};
    for (const [col, row, label, key] of BASIS_BUTTONS) slots[`${col},${row}`] = [label, key];
    let body = "";
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) {
        const cell = slots[`${col},${row}`];
        if (cell)
          body += `<button data-party="${p.name}" data-key="${cell[1]}">${cell[0]}</button>`;
        else body += "<span></span>";
      }
    }

    div.innerHTML = `
      <h4>${p.name}</h4>
      <div class="basis-grid">${gridCells}</div>
      <div class="basis-grid presets">${body}</div>
      <div class="slider-row"><label>HWP</label>
        <input type="range" min="0" max="180" step="1" value="${p.hwp_deg}" data-party="${p.name}" data-kind="hwp" />
        <input type="number" min="0" max="180" step="1" value="${p.hwp_deg}" data-party="${p.name}" data-kind="hwp" /><span class="unit">°</span></div>
      <label class="check"><input type="checkbox" checked data-party="${p.name}" data-kind="qwpcheck" /> Use QWP?</label>
      <div class="slider-row"><label>QWP</label>
        <input type="range" min="0" max="180" step="1" value="${p.qwp_deg}" data-party="${p.name}" data-kind="qwp" />
        <input type="number" min="0" max="180" step="1" value="${p.qwp_deg}" data-party="${p.name}" data-kind="qwp" /><span class="unit">°</span></div>
    `;
    container.appendChild(div);

    // link range<->number for hwp and qwp, and stash refs
    const refs = { qwpCheck: div.querySelector('[data-kind="qwpcheck"]') };
    for (const kind of ["hwp", "qwp"]) {
      const range = div.querySelector(`input[type=range][data-kind="${kind}"]`);
      const num = div.querySelector(`input[type=number][data-kind="${kind}"]`);
      linkRangeNumber(range, num);
      refs[kind] = range;
    }
    partyControls[p.name] = refs;

    // basis preset buttons
    div.querySelectorAll(".presets button").forEach((btn) => {
      btn.onclick = () => setBasisPreset(btn.dataset.party, btn.dataset.key);
    });
  }
}

function buildStatPlots() {
  const wrap = document.getElementById("stat-plots");
  wrap.innerHTML = "";
  for (let j = 0; j < NUM_COUNT_PLOTS; j++) {
    const row = document.createElement("div");
    row.className = "stat-plot";

    const val = document.createElement("div");
    val.className = "count-val";
    val.id = `stat-val-${j}`;
    val.textContent = "0";

    const btns = document.createElement("div");
    btns.className = "chan-buttons";
    for (let ch = 0; ch < 16; ch++) {
      const b = document.createElement("button");
      b.className = "chan-btn" + (statPatterns[j][ch] ? " on" : "");
      b.setAttribute("aria-label", `Toggle channel ${ch + 1} on plot ${j + 1}`);
      b.setAttribute("aria-pressed", String(statPatterns[j][ch]));
      b.textContent = statPatterns[j][ch] ? "+" : " ";
      b.onclick = () => {
        statPatterns[j][ch] = !statPatterns[j][ch];
        b.classList.toggle("on", statPatterns[j][ch]);
        b.setAttribute("aria-pressed", String(statPatterns[j][ch]));
        b.textContent = statPatterns[j][ch] ? "+" : " ";
      };
      btns.appendChild(b);
    }

    const plot = document.createElement("div");
    plot.className = "plot";
    plot.id = `stat-plot-${j}`;

    row.appendChild(val);
    row.appendChild(btns);
    row.appendChild(plot);
    wrap.appendChild(row);

    Plotly.newPlot(
      plot,
      [{ x: statX, y: statPlotData[j], mode: "lines", line: { color: "#3498db" } }],
      plotLayout(),
      { displayModeBar: false, responsive: true }
    );
  }
}

function plotLayout() {
  return {
    autosize: true,
    margin: { l: 40, r: 8, t: 8, b: 8 },
    paper_bgcolor: "#e6e6ea",
    plot_bgcolor: "#e6e6ea",
    xaxis: { showticklabels: false, color: "#434A42" },
    yaxis: { color: "#434A42" },
  };
}

/* Re-flow all Plotly charts to their current container size. */
function resizeAllPlots() {
  for (let j = 0; j < NUM_COUNT_PLOTS; j++) {
    const el = document.getElementById(`stat-plot-${j}`);
    if (el && el.offsetParent !== null) Plotly.Plots.resize(el);
  }
  const h = document.getElementById("hist-plot");
  if (h && h.offsetParent !== null && h.data) Plotly.Plots.resize(h);
}

/* Counts-view model — derived from the Python parties (buildCountsModel) so
   channel assignments always match the simulator instead of being hardcoded. */
let SINGLES = [];       // [label, [ch]]
let COINC = [];         // [label, [chA, chB]]
let EXP_SINGLES = [];   // [label, [posCh], [negCh]]
let coupleLabel = "E(A, B)";
let coupleGroups = { plus: [], minus: [] }; // channel-pairs summed for E(A,B)

/* Build the counts model from the first two parties (the CHSH pair). */
function buildCountsModel() {
  const parties = pyCall("get_parties");
  if (parties.length < 2) return;
  const [A, B] = parties;
  const [a0, a1] = A.channels;
  const [b0, b1] = B.channels;

  SINGLES = [
    [`${A.name} 0 (Ch${a0})`, [a0]], [`${A.name} 1 (Ch${a1})`, [a1]],
    [`${B.name} 0 (Ch${b0})`, [b0]], [`${B.name} 1 (Ch${b1})`, [b1]],
  ];
  COINC = [
    ["A0 & B0", [a0, b0]], ["A0 & B1", [a0, b1]],
    ["A1 & B0", [a1, b0]], ["A1 & B1", [a1, b1]],
  ];
  EXP_SINGLES = [
    [`E(${A.name})`, [a0], [a1]], [`E(${B.name})`, [b0], [b1]],
  ];
  coupleLabel = `E(${A.name}, ${B.name})`;
  coupleGroups = {
    plus:  [[a0, b0], [a1, b1]],
    minus: [[a0, b1], [a1, b0]],
  };
}

function buildCountsTables() {
  fillKVTable("singles-table", SINGLES.map(([n]) => n));
  fillKVTable("coinc-table", COINC.map(([n]) => n));
  fillKVTable("exp-singles-table", EXP_SINGLES.map(([n]) => n));
  fillKVTable("exp-couples-table", [coupleLabel]);
}

function fillKVTable(id, names) {
  const t = document.getElementById(id);
  t.innerHTML = names
    .map((n, i) => `<tr><td>${n}</td><td class="val" id="${id}-v${i}">0</td></tr>`)
    .join("");
}

/* =========================================================================
 * Event wiring
 * ========================================================================= */
function wireEvents() {
  setupTabs("main-tabs", "tab-");
  setupTabs("dock-tabs", "dock-");

  // Laser power slider <-> number
  linkRangeNumber(
    document.getElementById("laser-power"),
    document.getElementById("laser-power-val")
  );
  // Source HWP slider <-> number
  linkRangeNumber(
    document.getElementById("source-hwp"),
    document.getElementById("source-hwp-val")
  );

  document.getElementById("laser-update").onclick = () => {
    const on = document.getElementById("laser-emission").checked;
    const power = parseFloat(document.getElementById("laser-power").value);
    if (on) {
      pyCall("laser_on");
      pyCall("set_laser_power", power);
    } else {
      pyCall("laser_off");
    }
    updatePowerReadout();
  };

  document.getElementById("tt-update").onclick = () => {
    const delays = Array.from(document.querySelectorAll(".delay-input")).map((el) =>
      parseFloat(el.value)
    );
    pyCall("set_delays", delays);
    pyCall("set_window", parseFloat(document.getElementById("coinc-window").value));
    integrationMs = parseFloat(document.getElementById("meas-time").value);
    if (isContinuous) startTimer();
  };

  document.getElementById("pol-update").onclick = updatePolarization;

  document.getElementById("source-type").onchange = (e) => {
    const idx = parseInt(e.target.value);
    pyCall("set_source_type", idx);
    document.getElementById("source-controls").style.display = idx === 0 ? "" : "none";
    updatePolarization();
  };

  // Acquisition mode
  document.querySelectorAll('input[name="mode"]').forEach((r) => {
    r.onchange = () => {
      isContinuous = document.querySelector('input[name="mode"]:checked').value === "cont";
      document.getElementById("refresh-btn").disabled = isContinuous;
      if (isContinuous) startTimer();
      else stopTimer();
    };
  });
  document.getElementById("refresh-btn").onclick = acquire;

  document.getElementById("hist-run").onclick = runHistogram;

  document.getElementById("lights-toggle").onclick = toggleLights;

  setupSplitter();
  // Plotly is responsive to window resizes; also re-flow our plots explicitly.
  window.addEventListener("resize", debounce(resizeAllPlots, 100));
}

/* Drag the divider to resize the dock; works with mouse and touch. */
function setupSplitter() {
  const splitter = document.getElementById("splitter");
  const dock = document.getElementById("dock");
  const layout = document.querySelector(".layout");
  if (!splitter || !dock) return;

  let dragging = false;

  const onMove = (clientX) => {
    const rect = layout.getBoundingClientRect();
    let width = rect.right - clientX; // dock sits on the right
    const min = 320;
    const max = rect.width - 320; // leave room for the control pane
    width = Math.max(min, Math.min(max, width));
    dock.style.width = width + "px";
    resizeAllPlots();
  };

  const start = (e) => {
    dragging = true;
    splitter.classList.add("dragging");
    document.body.classList.add("resizing");
    e.preventDefault();
  };
  const stop = () => {
    if (!dragging) return;
    dragging = false;
    splitter.classList.remove("dragging");
    document.body.classList.remove("resizing");
    resizeAllPlots();
  };

  splitter.addEventListener("mousedown", start);
  window.addEventListener("mousemove", (e) => dragging && onMove(e.clientX));
  window.addEventListener("mouseup", stop);

  splitter.addEventListener("touchstart", start, { passive: false });
  window.addEventListener("touchmove", (e) => {
    if (dragging && e.touches[0]) { onMove(e.touches[0].clientX); e.preventDefault(); }
  }, { passive: false });
  window.addEventListener("touchend", stop);
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function setupTabs(navId, panelPrefix) {
  const nav = document.getElementById(navId);
  nav.querySelectorAll(".tab").forEach((tab) => {
    tab.onclick = () => {
      nav.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const scope = nav.parentElement;
      scope.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      document.getElementById(panelPrefix + tab.dataset.tab).classList.add("active");
      resizeAllPlots();
    };
  });
}

function updatePolarization() {
  if (parseInt(document.getElementById("source-type").value) === 0) {
    pyCall("set_source_hwp", parseFloat(document.getElementById("source-hwp").value));
  }
  for (const [name, refs] of Object.entries(partyControls)) {
    pyCall("toggle_qwp", name, refs.qwpCheck.checked);
    pyCall(
      "set_waveplates",
      name,
      parseFloat(refs.hwp.value),
      parseFloat(refs.qwp.value)
    );
  }
}

function setBasisPreset(party, key) {
  const refs = partyControls[party];
  if (!refs || !(key in BASIS_PRESETS)) return;
  const [h, q] = BASIS_PRESETS[key];
  if (!refs.qwpCheck.checked) refs.qwpCheck.checked = true;
  setRange(refs.hwp, h);
  setRange(refs.qwp, q);
  updatePolarization();
}

function toggleLights() {
  isDarkMode = !isDarkMode;
  const btn = document.getElementById("lights-toggle");
  pyCall("set_lights", !isDarkMode); // lights on = not dark
  btn.textContent = isDarkMode ? "Turn on lights" : "Turn off lights";
  document.body.classList.toggle("light-mode", !isDarkMode);
}

/* =========================================================================
 * Acquisition loop
 * ========================================================================= */
function startTimer() {
  stopTimer();
  timer = setInterval(acquire, integrationMs);
}
function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

function acquire() {
  if (isMeasuring || !simProxy) return;
  isMeasuring = true;
  try {
    const duration = integrationMs / 1000.0;
    pyCall("read", duration);

    // One batched call covering everything the dock shows.
    const patterns = [];
    for (let j = 0; j < NUM_COUNT_PLOTS; j++) {
      const chans = channelsOf(statPatterns[j]);
      patterns.push(chans.length ? chans : [-1]); // [-1] -> guaranteed 0
    }
    const baseIdx = patterns.length;
    for (const [, ch] of SINGLES) patterns.push(ch);
    for (const [, ch] of COINC) patterns.push(ch);

    const counts = pyCall("get_counts_batch", patterns);

    updateStatPlots(counts.slice(0, NUM_COUNT_PLOTS));
    updateCountsView(counts.slice(baseIdx));
  } catch (err) {
    // Stop the runaway loop and surface the failure instead of throwing every tick.
    stopTimer();
    reportError(err);
  } finally {
    isMeasuring = false;
  }
}

function channelsOf(pattern) {
  const out = [];
  pattern.forEach((on, i) => { if (on) out.push(i + 1); });
  return out;
}

function updateStatPlots(counts) {
  for (let j = 0; j < NUM_COUNT_PLOTS; j++) {
    const c = counts[j] < 0 ? 0 : counts[j];
    statPlotData[j].push(c);
    if (statPlotData[j].length > NUMBER_POINTS_MEM) statPlotData[j].shift();
    document.getElementById(`stat-val-${j}`).textContent = c;
    Plotly.restyle(`stat-plot-${j}`, { y: [statPlotData[j]] });
  }
}

function updateCountsView(counts) {
  // order: SINGLES(4), COINC(4)
  const singles = counts.slice(0, 4);
  const coinc = counts.slice(4, 8);
  singles.forEach((c, i) => setText(`singles-table-v${i}`, c.toLocaleString()));
  coinc.forEach((c, i) => setText(`coinc-table-v${i}`, c.toLocaleString()));

  // Expectation (singles): map counts by channel using the SINGLES order.
  const sMap = {};
  SINGLES.forEach(([, ch], i) => (sMap[ch[0]] = singles[i]));
  EXP_SINGLES.forEach(([, pos, neg], i) => {
    const p = sMap[pos[0]], n = sMap[neg[0]];
    const total = p + n;
    setText(`exp-singles-table-v${i}`, total > 0 ? ((p - n) / total).toFixed(3) : "0.0000");
  });

  // Couples expectation E(A,B): plus/minus channel-pairs from coupleGroups.
  const cMap = {}; COINC.forEach(([, ch], i) => (cMap[ch.join(",")] = coinc[i]));
  const pairKey = (pair) => pair.join(",");
  const nPlus = coupleGroups.plus.reduce((s, p) => s + cMap[pairKey(p)], 0);
  const nMinus = coupleGroups.minus.reduce((s, p) => s + cMap[pairKey(p)], 0);
  const total = nPlus + nMinus;
  setText("exp-couples-table-v0", total > 0 ? ((nPlus - nMinus) / total).toFixed(4) : "0.0000");
}

/* =========================================================================
 * Histogram
 * ========================================================================= */
function runHistogram() {
  const btn = document.getElementById("hist-run");
  btn.disabled = true;
  btn.textContent = "Running…";
  // Pause continuous acquisition while we generate tags.
  const wasContinuous = isContinuous;
  stopTimer();
  setTimeout(() => {
    try {
      const res = pyCall(
        "histogram",
        parseFloat(document.getElementById("h-meas").value),
        parseInt(document.getElementById("h-cha").value),
        parseInt(document.getElementById("h-chb").value),
        parseFloat(document.getElementById("h-bin").value),
        parseFloat(document.getElementById("h-width").value)
      );
      drawHistogram(res);
    } finally {
      btn.disabled = false;
      btn.textContent = "Run cross-correlation";
      if (wasContinuous) startTimer();
    }
  }, 30);
}

function drawHistogram(res) {
  const x = res.x || [];
  const y = res.hist || [];
  const center = res.window_center || 0;
  const radius = res.radius || 0;
  Plotly.newPlot(
    "hist-plot",
    [{ x, y, mode: "lines", line: { color: "#3498db" }, name: "Counts" }],
    {
      margin: { l: 50, r: 20, t: 20, b: 40 },
      paper_bgcolor: "#e6e6ea",
      plot_bgcolor: "#e6e6ea",
      xaxis: { title: "Time (ns)", color: "#434A42" },
      yaxis: { title: "Counts", color: "#434A42" },
      shapes: [
        {
          type: "rect", xref: "x", yref: "paper",
          x0: center - radius, x1: center + radius, y0: 0, y1: 1,
          fillcolor: "green", opacity: 0.2, line: { width: 0 },
        },
      ],
    },
    { responsive: true }
  );
}

/* =========================================================================
 * Small helpers
 * ========================================================================= */
function linkRangeNumber(range, num) {
  range.addEventListener("input", () => (num.value = range.value));
  num.addEventListener("input", () => (range.value = num.value));
}
function setRange(range, value) {
  range.value = value;
  range.dispatchEvent(new Event("input"));
}
function setSlider(id, value) {
  setRange(document.getElementById(id), value);
}
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/* Read the virtual power meter and show it in the Laser Control card. */
function updatePowerReadout() {
  const mw = pyCall("get_power_mw");
  setText("power-readout", Number(mw).toFixed(2));
}

/* Show a one-time error banner (avoids spamming on every failed interval). */
let errorReported = false;
function reportError(err) {
  console.error("Acquisition error:", err);
  if (errorReported) return;
  errorReported = true;
  let bar = document.getElementById("error-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "error-bar";
    document.body.appendChild(bar);
  }
  bar.textContent = "Simulation error — acquisition stopped. See the console for details.";
}

boot().catch((err) => {
  document.getElementById("loader-status").textContent = "Error: " + err;
  console.error(err);
});
