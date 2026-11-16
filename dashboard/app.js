// Token Radar dashboard: renders window.RADAR (written by main.ts from the sealed
// snapshot) with no fetch and no network. Filter, sort, detail view and a live
// model sandbox all run on the snapshot's own figures.
//
// The value model, mirrored from lib/model.ts:
//   implied = TVL x categoryMultiple x growthMultiplier x maturityMultiplier
//   growthMultiplier   = 1 + clamp(change_7d, -60, 120) / 100 x growthWeight
//   maturityMultiplier = floor + min(ageDays, 1095) / 1095 x (1 - floor)
// The sandbox recomputes every row from those same stored figures when its
// dials move, so the board it re-ranks is the model's board, not a new list.
'use strict';

const RADAR = window.RADAR;
const $ = (id) => document.getElementById(id);

/** HTML-escape a string from the snapshot before it reaches the page. */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** $1,240,000,000 -> $1.24B; $342,000,000 -> $342M; $856,000 -> $856K. */
function fmtMoney(n) {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2).replace(/\.00$/, '') + 'B';
  if (abs >= 1e6) return '$' + (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (abs >= 1e3) return '$' + (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return '$' + Math.round(n);
}

/** Full dollars with commas, for the detail view. */
function fmtFull(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function fmtPct(v) {
  if (v === null || v === undefined) return '—';
  const sign = v > 0 ? '+' : '';
  return sign + v.toFixed(1) + '%';
}

function pctClass(v) {
  if (v === null || v === undefined) return 'flat';
  return v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
}

function fmtAge(days) {
  if (days === null || days === undefined) return '—';
  if (days < 365) return days + 'd';
  return (days / 365).toFixed(1) + 'y';
}

function fmtMult(m) {
  return '×' + m.toFixed(2);
}

function chainsShort(chains) {
  if (!chains || chains.length === 0) return '—';
  if (chains.length <= 2) return chains.join(', ');
  return chains.slice(0, 2).join(', ') + ' +' + (chains.length - 2);
}

/* ------------------------------------------------------------------ */
/* Sandbox state: the model's published settings, moved by the dials.  */
/* ------------------------------------------------------------------ */

const sandbox = {
  growthWeight: RADAR.model.growth_weight,
  maturityFloor: RADAR.model.maturity_floor,
  multipleCap: RADAR.model.multiple_max,
};

function sandboxIsDefault() {
  return (
    sandbox.growthWeight === RADAR.model.growth_weight &&
    sandbox.maturityFloor === RADAR.model.maturity_floor &&
    sandbox.multipleCap === RADAR.model.multiple_max
  );
}

/** Recompute one row's implied value under the sandbox dials. Mirrors impliedValue in lib/model.ts. */
function recompute(row) {
  const multiple = Math.min(row.category_multiple, sandbox.multipleCap);
  const growthPct = Math.min(RADAR.model.growth_cap, Math.max(RADAR.model.growth_floor, row.change_7d ?? 0));
  const growthMult = 1 + (growthPct / 100) * sandbox.growthWeight;
  const age = row.age_days ?? RADAR.model.unknown_age_days;
  const maturityMult = sandbox.maturityFloor + (Math.min(Math.max(age, 0), RADAR.model.maturity_days) / RADAR.model.maturity_days) * (1 - sandbox.maturityFloor);
  return Math.max(1, Math.round(row.tvl_usd * multiple * growthMult * maturityMult));
}

/** Every row with its live implied value: the published one, or the sandbox's. */
function liveRows() {
  const changed = !sandboxIsDefault();
  return RADAR.rows.map((r) => ({ row: r, implied: changed ? recompute(r) : r.implied_value_usd }));
}

/* ------------------------------------------------------------------ */
/* Filters and sorting.                                                */
/* ------------------------------------------------------------------ */

const filters = { q: '', category: '', chain: '', watchlistOnly: false, sort: 'value' };
let selectedSlug = null;

function applyFilters() {
  const q = filters.q.trim().toLowerCase();
  let list = liveRows().filter(({ row }) => {
    if (filters.watchlistOnly && !row.watchlist) return false;
    if (filters.category && row.category !== filters.category) return false;
    if (filters.chain && !(row.chains || []).includes(filters.chain)) return false;
    if (q && !(row.name.toLowerCase().includes(q) || row.slug.toLowerCase().includes(q))) return false;
    return true;
  });
  const by = {
    value: (a, b) => b.implied - a.implied,
    tvl: (a, b) => b.row.tvl_usd - a.row.tvl_usd,
    growth: (a, b) => (b.row.change_7d ?? -1e9) - (a.row.change_7d ?? -1e9),
    age: (a, b) => (b.row.age_days ?? -1) - (a.row.age_days ?? -1),
    name: (a, b) => (a.row.name < b.row.name ? -1 : 1),
  }[filters.sort];
  list.sort((a, b) => by(a, b) || (a.row.slug < b.row.slug ? -1 : 1));
  return list;
}

/* ------------------------------------------------------------------ */
/* Rendering.                                                          */
/* ------------------------------------------------------------------ */

function renderStats() {
  const total = liveRows().reduce((s, x) => s + x.implied, 0);
  $('stats').innerHTML =
    '<div><dt>Protocols ranked</dt><dd>' + RADAR.board_size + '</dd></div>' +
    '<div><dt>Watchlist covered</dt><dd>' + RADAR.watchlist_size + ' <small>/ ' + RADAR.watchlist_size + '</small></dd></div>' +
    '<div><dt>Early finds</dt><dd>' + RADAR.early_size + ' <small>below the floor</small></dd></div>' +
    '<div><dt>Total implied value</dt><dd>' + fmtMoney(total) + '</dd></div>';
  $('asof').textContent =
    'Snapshot ' + RADAR.as_of + ' · ' + RADAR.source + ' · watchlist floor $50,000,000 TVL · ' +
    RADAR.live_size + ' live-token protocols set aside as comparables.';
  $('boardSub').textContent =
    RADAR.board_size + ' protocols · ' + RADAR.watchlist_size + ' watchlist · ' + RADAR.early_size + ' early';
}

function renderMultiples() {
  const rows = RADAR.multiples.map((m) =>
    '<tr><td>' + esc(m.category) + '</td><td class="num">' + fmtMult(m.multiple) + '</td>' +
    '<td class="num">' + m.samples + '</td><td>category median</td></tr>',
  );
  rows.push(
    '<tr><td>All other categories</td><td class="num">' + fmtMult(RADAR.global_multiple) + '</td>' +
    '<td class="num">—</td><td>global median (fallback)</td></tr>',
  );
  $('multiplesTable').innerHTML =
    '<thead><tr><th>Category</th><th class="num">Multiple</th><th class="num">Live samples</th><th>Source</th></tr></thead><tbody>' +
    rows.join('') + '</tbody>';
}

function renderFilterOptions() {
  const cats = [...new Set(RADAR.rows.map((r) => r.category).filter(Boolean))].sort();
  const chains = [...new Set(RADAR.rows.flatMap((r) => r.chains || []))].sort();
  for (const c of cats) {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    $('category').appendChild(o);
  }
  for (const c of chains) {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    $('chain').appendChild(o);
  }
}

function badge(row) {
  return row.watchlist
    ? '<span class="badge watch">WATCHLIST</span>'
    : '<span class="badge early">EARLY</span>';
}

function renderBoard() {
  const list = applyFilters();
  const changed = !sandboxIsDefault();
  const total = list.reduce((s, x) => s + x.implied, 0);
  $('count').innerHTML =
    'Showing <strong>' + list.length + '</strong> of ' + RADAR.board_size + ' protocols' +
    (changed ? ' · <strong>sandbox values</strong> (dials moved from the published model)' : '') +
    ' · combined implied value <strong>' + fmtMoney(total) + '</strong>';
  $('empty').hidden = list.length > 0;
  $('boardBody').innerHTML = list.map(({ row, implied }, i) =>
    '<tr data-slug="' + esc(row.slug) + '"' + (row.slug === selectedSlug ? ' class="selected"' : '') + '>' +
    '<td class="num">' + (changed ? i + 1 : row.rank) + '</td>' +
    '<td class="name">' + esc(row.name) + badge(row) + '<span class="slug">' + esc(row.slug) + '</span></td>' +
    '<td>' + esc(row.category || '—') + '</td>' +
    '<td>' + esc(chainsShort(row.chains)) + '</td>' +
    '<td class="num">' + fmtMoney(row.tvl_usd) + '</td>' +
    '<td class="num ' + pctClass(row.change_7d) + '">' + fmtPct(row.change_7d) + '</td>' +
    '<td class="num">' + fmtAge(row.age_days) + '</td>' +
    '<td class="num mult">' + fmtMult(Math.min(row.category_multiple, sandbox.multipleCap)) +
    (row.multiple_source === 'global' ? ' <span title="global median fallback">*</span>' : '') + '</td>' +
    '<td class="num implied">' + fmtMoney(implied) + '</td>' +
    '<td><button class="plan" data-plan="' + esc(row.slug) + '">Farm plan</button></td>' +
    '</tr>',
  ).join('');
}

/** Split one farm step's "Action. Cost: X. Time: Y." into its three parts. */
function splitStep(step) {
  const costAt = step.indexOf(' Cost: ');
  const timeAt = step.indexOf('. Time: ');
  if (costAt < 0 || timeAt < 0) return { text: step, cost: '', time: '' };
  return {
    text: step.slice(0, costAt + 1),
    // ' Cost: ' is 7 characters: the cost starts right after it.
    cost: step.slice(costAt + 7, timeAt),
    time: step.slice(timeAt + 8).replace(/\.$/, ''),
  };
}

function renderDetail(slug) {
  const row = RADAR.rows.find((r) => r.slug === slug);
  const panel = $('detail');
  if (!row) { panel.hidden = true; selectedSlug = null; return; }
  selectedSlug = slug;
  const implied = sandboxIsDefault() ? row.implied_value_usd : recompute(row);
  const base = row.tvl_usd * Math.min(row.category_multiple, sandbox.multipleCap);
  const growthPct = Math.min(RADAR.model.growth_cap, Math.max(RADAR.model.growth_floor, row.change_7d ?? 0));
  const age = row.age_days ?? RADAR.model.unknown_age_days;
  const bar = (v, max) => '<span class="bar"><i class="' + (v >= max * 0.75 ? 'amber' : '') + '" style="width:' + Math.round((v / max) * 100) + '%"></i></span>';
  panel.innerHTML =
    '<button class="close" id="closeDetail">Close ✕</button>' +
    '<h2>' + esc(row.name) + badge(row) + '</h2>' +
    '<p class="meta">Rank #' + row.rank + ' · ' + esc(row.category || 'Uncategorized') + ' · ' +
    esc((row.chains || []).join(', ') || 'no chain listed') +
    ' · tracked since ' + esc(row.listed_at || 'unknown') +
    ' · records no token in the snapshot.</p>' +
    '<dl class="grid">' +
    '<div><dt>Implied value</dt><dd>' + fmtFull(implied) + '</dd></div>' +
    '<div><dt>TVL</dt><dd>' + fmtFull(row.tvl_usd) + '</dd></div>' +
    '<div><dt>7-day change</dt><dd class="' + pctClass(row.change_7d) + '">' + fmtPct(row.change_7d) + '</dd></div>' +
    '<div><dt>Age with no token</dt><dd>' + fmtAge(row.age_days) + '</dd></div>' +
    '</dl>' +
    '<h3>Why it is worth ' + fmtMoney(implied) + '</h3>' +
    '<div class="breakdown">' +
    '<div class="rowline"><span>TVL × category multiple</span>' + bar(Math.min(row.category_multiple, sandbox.multipleCap), 0.8) + '<span>' + fmtMoney(base) + '</span></div>' +
    '<div class="rowline"><span>Growth multiplier (' + fmtPct(growthPct) + ' in 7 days)</span>' + bar(row.growth_multiplier, 1.6) + '<span>' + fmtMult(row.growth_multiplier) + '</span></div>' +
    '<div class="rowline"><span>Maturity multiplier (' + fmtAge(row.age_days) + ' old)</span>' + bar(row.maturity_multiplier, 1) + '<span>' + fmtMult(row.maturity_multiplier) + '</span></div>' +
    '<div class="rowline"><span><strong>Implied value</strong></span>' + bar(1, 1) + '<span class="implied">' + fmtFull(implied) + '</span></div>' +
    '</div>' +
    '<p class="meta">Multiple ' + fmtMult(Math.min(row.category_multiple, sandbox.multipleCap)) +
    (row.multiple_source === 'global'
      ? ' — the global median: too few live-token protocols share this category to price it on its own.'
      : ' — the median market-cap-to-TVL ratio of live-token protocols in this category.') +
    ' The snapshot records no token for this protocol; that is the record, not proof.</p>' +
    '<h3>Farm plan — six steps</h3>' +
    '<ol class="steps">' + row.farm_steps.map((s) => {
      const p = splitStep(s);
      return '<li>' + esc(p.text) +
        (p.cost ? '<br><span class="cost"><b>Cost:</b> ' + esc(p.cost) + ' &nbsp;·&nbsp; <b>Time:</b> ' + esc(p.time) + '</span>' : '') + '</li>';
    }).join('') + '</ol>';
  panel.hidden = false;
  $('closeDetail').addEventListener('click', () => {
    panel.hidden = true;
    selectedSlug = null;
    setHash();
    renderBoard();
  });
}

function renderLive() {
  $('liveBody').innerHTML = RADAR.live.map((p) =>
    '<tr><td class="name">' + esc(p.name) + '<span class="slug">' + esc(p.slug) + '</span></td>' +
    '<td>' + esc(p.category || '—') + '</td>' +
    '<td>' + esc(chainsShort(p.chains)) + '</td>' +
    '<td class="num">' + fmtMoney(p.tvl_usd) + '</td>' +
    '<td class="num">' + fmtMoney(p.mcap_usd) + '</td>' +
    '<td class="num mult">' + (p.mcap_tvl === null ? '—' : fmtMult(p.mcap_tvl)) + '</td>' +
    '<td class="num ' + pctClass(p.change_7d) + '">' + fmtPct(p.change_7d) + '</td></tr>',
  ).join('');
}

/* ------------------------------------------------------------------ */
/* Hash state: #detail=<slug>&category=<c>&chain=<c>&q=<q>&watchlist=1   */
/* &sort=<s> — so each screenshot state is a linkable view.            */
/* ------------------------------------------------------------------ */

function setHash() {
  const params = new URLSearchParams();
  if (selectedSlug) params.set('detail', selectedSlug);
  if (filters.category) params.set('category', filters.category);
  if (filters.chain) params.set('chain', filters.chain);
  if (filters.q) params.set('q', filters.q);
  if (filters.watchlistOnly) params.set('watchlist', '1');
  if (filters.sort !== 'value') params.set('sort', filters.sort);
  const hash = params.toString();
  history.replaceState(null, '', hash ? '#' + hash : location.pathname + location.search);
}

function applyHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  const detail = params.get('detail');
  const category = params.get('category');
  const chain = params.get('chain');
  if (params.get('q')) { filters.q = params.get('q'); $('q').value = filters.q; }
  if (category && [...$('category').options].some((o) => o.value === category)) { filters.category = category; $('category').value = category; }
  if (chain && [...$('chain').options].some((o) => o.value === chain)) { filters.chain = chain; $('chain').value = chain; }
  if (params.get('watchlist') === '1') { filters.watchlistOnly = true; $('watchlistOnly').checked = true; }
  if (params.get('sort')) { filters.sort = params.get('sort'); $('sort').value = filters.sort; }
  if (detail) renderDetail(detail);
}

/* ------------------------------------------------------------------ */
/* Wiring.                                                             */
/* ------------------------------------------------------------------ */

function bindSandbox() {
  const note = $('sandboxNote');
  const update = () => {
    sandbox.growthWeight = parseFloat($('wGrowth').value);
    sandbox.maturityFloor = parseFloat($('wFloor').value);
    sandbox.multipleCap = parseFloat($('wCap').value);
    $('wOut').textContent = sandbox.growthWeight.toFixed(2);
    $('fOut').textContent = sandbox.maturityFloor.toFixed(2);
    $('cOut').textContent = sandbox.multipleCap.toFixed(2);
    note.textContent = sandboxIsDefault()
      ? 'Dials at the model’s published settings.'
      : 'Dials moved: growth weight ' + sandbox.growthWeight.toFixed(2) +
        ', maturity floor ' + sandbox.maturityFloor.toFixed(2) +
        ', multiple cap ' + sandbox.multipleCap.toFixed(2) +
        ' — the board above is re-ranked on those settings.';
    renderStats();
    renderBoard();
    if (selectedSlug) renderDetail(selectedSlug);
  };
  for (const id of ['wGrowth', 'wFloor', 'wCap']) $(id).addEventListener('input', update);
}

function bindControls() {
  $('q').addEventListener('input', () => { filters.q = $('q').value; renderBoard(); setHash(); });
  $('category').addEventListener('change', () => { filters.category = $('category').value; renderBoard(); setHash(); });
  $('chain').addEventListener('change', () => { filters.chain = $('chain').value; renderBoard(); setHash(); });
  $('sort').addEventListener('change', () => { filters.sort = $('sort').value; renderBoard(); setHash(); });
  $('watchlistOnly').addEventListener('change', () => { filters.watchlistOnly = $('watchlistOnly').checked; renderBoard(); setHash(); });
  $('boardBody').addEventListener('click', (e) => {
    const plan = e.target.closest('[data-plan]');
    const tr = e.target.closest('tr[data-slug]');
    const slug = plan ? plan.getAttribute('data-plan') : tr ? tr.getAttribute('data-slug') : null;
    if (!slug) return;
    renderDetail(slug);
    renderBoard();
    setHash();
    $('detail').scrollIntoView({ behavior: 'instant', block: 'start' });
  });
}

renderStats();
renderMultiples();
renderFilterOptions();
renderLive();
bindSandbox();
bindControls();
applyHash();
renderBoard();
if (selectedSlug) renderDetail(selectedSlug);
// Deep-link scrolling for the screenshot states: #scroll=board puts the ranked
// rows in view, and a detail link puts the protocol's detail view in view.
// window.scrollTo during initial script execution lands before first paint,
// so the scrolled region is rendered, not blank.
const scrollTarget = new URLSearchParams(location.hash.slice(1)).get('scroll');
if (scrollTarget === 'board') window.scrollTo(0, document.querySelector('.board').offsetTop - 12);
else if (selectedSlug) window.scrollTo(0, $('detail').offsetTop - 12);
