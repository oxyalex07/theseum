/* Mission Control — shared sample data, panel renderers, interactions. Panels are framework-free
   string templates using the class names in shared.css so they port 1:1 to Tailwind + shadcn/ui. */
(function () {
const I = {
  dash: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  down: '<path d="m6 9 6 6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
  branch: '<path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M8 13h8M8 17h8"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>', send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  minus: '<path d="M5 12h14"/>', msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  spark: '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/>',
  plus: '<path d="M5 12h14M12 5v14"/>', layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>',
  edit: '<path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  rot: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/>',
  wifi: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3"/>',
};
const icon = (n, s) => `<svg class="od-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${s ? ` style="--od-icon-size:${s}px"` : ''}>${I[n]}</svg>`;

const AG = {
  lead: { n: 'Lead', l: 'L', c: '#8b7cf6', rt: 'claude' }, researcher: { n: 'Researcher', l: 'R', c: '#60a5fa', rt: 'claude' },
  analyst: { n: 'Analyst', l: 'A', c: '#2dd4bf', rt: 'codex' }, writer: { n: 'Writer', l: 'W', c: '#f472b6', rt: 'claude' },
  builder: { n: 'Builder', l: 'B', c: '#a3e635', rt: 'codex' }, tester: { n: 'Tester', l: 'T', c: '#fb923c', rt: 'codex' },
};
const TT = { WEB: '#60a5fa', READ: '#94a3b8', EDIT: '#2dd4bf', BASH: '#fb923c', WRITE: '#f472b6', SPAWN: '#a78bfa' };
const PR = {
  ev: { n: 'EV Battery Supply Chain', k: 'research', st: 'running', ag: ['researcher', 'analyst', 'writer'], last: '2m ago', tags: ['lithium', 'cathode', 'suppliers'] },
  habit: { n: 'habit-tracker-app', k: 'coding', st: 'running', ag: ['builder', 'tester'], last: '1m ago', tags: ['react', 'vite', 'charts'] },
  q4: { n: 'Q4 Competitor Scan', k: 'research', st: 'waiting', ag: ['lead', 'researcher'], last: '9m ago', tags: ['pricing', 'market'] },
  cli: { n: 'CLI refactor', k: 'coding', st: 'error', ag: ['builder'], last: '14m ago', tags: ['typescript', 'parser'] },
  li: { n: 'Lithium Price Model', k: 'research', st: 'done', ag: ['analyst', 'writer'], last: '3h ago', tags: ['forecast'] },
  dot: { n: 'dotfiles-sync', k: 'coding', st: 'idle', ag: [], last: '2d ago', tags: ['bash', 'macos'] },
};
const LIVE = [
  { id: 'l1', ag: 'researcher', pr: 'ev', st: 'running', tag: 'WEB', step: 'fetch benchmarkminerals.com/lithium-q3', s: 872, pg: 62, sp: [2, 4, 3, 6, 5, 8, 7, 9, 6, 8] },
  { id: 'l2', ag: 'analyst', pr: 'ev', st: 'waiting', tag: 'BASH', step: 'python score.py — awaiting approval', s: 364, pg: 80, sp: [5, 6, 8, 7, 4, 2, 1, 1, 1, 1] },
  { id: 'l3', ag: 'builder', pr: 'habit', st: 'running', tag: 'EDIT', step: 'src/components/StreakChart.tsx', s: 1344, pg: 74, sp: [3, 5, 6, 4, 7, 9, 8, 6, 9, 10] },
  { id: 'l4', ag: 'tester', pr: 'habit', st: 'done', tag: 'BASH', step: 'pnpm test streak — 42 passed, 1 skipped', s: 205, pg: 100, sp: [1, 3, 5, 7, 8, 6, 3, 2, 1, 0] },
  { id: 'l5', ag: 'lead', pr: 'q4', st: 'waiting', tag: 'SPAWN', step: 'asks which 3 competitors to prioritise', s: 541, pg: 35, sp: [4, 3, 5, 2, 1, 1, 1, 1, 1, 1] },
  { id: 'l6', ag: 'builder', pr: 'cli', st: 'error', tag: 'BASH', step: 'pnpm build — TS2345 in parser.ts:88', s: 842, pg: 48, sp: [6, 7, 8, 9, 8, 5, 2, 0, 0, 0] },
  { id: 'l7', ag: 'writer', pr: 'ev', st: 'idle', tag: 'WRITE', step: 'draft v2 queued behind Analyst', s: 0, pg: 20, sp: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
];
const NEEDS = [
  { id: 'n1', kind: 'approval', ag: 'analyst', pr: 'ev', tag: 'BASH', verb: 'wants to run', cmd: 'python score.py --input data/suppliers.csv --out out/scores.json', reason: 'Score 38 cathode suppliers using the risk weights in methodology.md, then hand the table to Writer.', cwd: '~/Projects/ev-battery/analysis', risk: 'Low — reads data/, writes out/scores.json only', age: '2m' },
  { id: 'n2', kind: 'approval', ag: 'builder', pr: 'habit', tag: 'BASH', verb: 'wants to install', cmd: 'pnpm add recharts@2.12.7', reason: 'StreakChart needs a charting lib; recharts is already used by the design system.', cwd: '~/Projects/habit-tracker-app', risk: 'Medium — modifies package.json and lockfile', age: '4m' },
  { id: 'n3', kind: 'approval', ag: 'lead', pr: 'q4', tag: 'SPAWN', verb: 'wants to spawn', cmd: 'spawn 2× Researcher (claude) → pricing pages, review sites', reason: 'Competitor pricing pages are independent; two parallel Researchers finish in ~15m instead of ~30m.', cwd: '~/Projects/q4-competitor-scan', risk: 'Medium — uses 2 concurrency slots (3/4 → 4/4)', age: '6m' },
  { id: 'n4', kind: 'question', ag: 'lead', pr: 'q4', verb: 'asks', q: 'Which three competitors should I deep-dive first?', opts: ['Top 3 by funding', 'Top 3 by traffic', 'I will pick'], age: '9m' },
  { id: 'n5', kind: 'error', ag: 'builder', pr: 'cli', tag: 'BASH', verb: 'run failed', cmd: 'pnpm build', log: "src/parser.ts:88:21 - error TS2345: Argument of type 'Token | null'\nis not assignable to parameter of type 'Token'.", reason: 'Failed after 3 retries. Last good commit: a41c9e2 on refactor/cli-parser.', cwd: '~/Projects/cli-refactor', age: '14m' },
];
const OUT = {
  reports: [
    { id: 'o1', t: 'Cathode Risk Map — EV Battery Supply Chain', src: 24, ag: 'writer', age: '12m' },
    { id: 'o2', t: 'Lithium Price Drivers, Q3', src: 17, ag: 'analyst', age: '3h' },
    { id: 'o3', t: 'Pricing Teardown (draft) — Q4 Competitor Scan', src: 9, ag: 'researcher', age: '5h' },
  ],
  branches: [
    { id: 'o4', b: 'feat/streak-chart', a: 412, d: 38, ag: 'builder', age: '8m' },
    { id: 'o5', b: 'refactor/cli-parser', a: 1204, d: 987, ag: 'builder', age: '1h' },
    { id: 'o6', b: 'fix/reminder-tz', a: 36, d: 12, ag: 'builder', age: '1d' },
  ],
};
const FEED = [
  ['now', 'researcher', 'saved 6 sources to ev-battery/sources/', 'WRITE'], ['1m', 'builder', 'edited src/components/StreakChart.tsx (+64 −9)', 'EDIT'],
  ['2m', 'analyst', 'requested approval: python score.py', 'BASH'], ['4m', 'builder', 'requested approval: pnpm add recharts', 'BASH'],
  ['6m', 'lead', 'requested approval: spawn 2× Researcher', 'SPAWN'], ['8m', 'builder', 'finished feat/streak-chart (+412 −38)', 'EDIT'],
  ['9m', 'researcher', 'fetched benchmarkminerals.com/lithium-q3', 'WEB'], ['12m', 'writer', 'saved Cathode Risk Map (24 sources)', 'WRITE'],
  ['14m', 'builder', 'pnpm build failed in CLI refactor (TS2345)', 'BASH'], ['17m', 'tester', 'ran pnpm test streak — 42 passed', 'BASH'],
  ['21m', 'researcher', 'read data/suppliers.csv (38 rows)', 'READ'], ['26m', 'lead', 'drafted team for Q4 Competitor Scan', 'SPAWN'],
  ['34m', 'analyst', 'read methodology.md', 'READ'], ['41m', 'writer', 'outlined exec-summary.md', 'WRITE'],
];
const BRIEF = {
  when: 'Since 11:40 pm · generated by Lead 7:12 am',
  html: '<p><b>Overnight:</b> Researcher finished the lithium price pass (17 sources) and Builder landed <span class="mono">feat/streak-chart</span> (+412 −38), ready for review. Tester is green on 42 tests.</p><p><b>Blocked:</b> Analyst is waiting on one approval, and the CLI refactor build fails on a null-check in <span class="mono">parser.ts</span>. Codex is at 82% of its 5-hour window, so heavy builds are better after the reset.</p>',
  acts: ['Approve score.py', 'Review streak-chart', 'Retry CLI build after reset'],
};
const USAGE = [
  { l: 'Claude · 5-hour', p: 68, r: 'resets in 1h 42m', c: '#8b7cf6' }, { l: 'Claude · weekly', p: 41, r: 'resets Mon 09:00', c: '#8b7cf6' },
  { l: 'Codex · 5-hour', p: 82, r: 'resets in 0h 48m', c: '#60a5fa' }, { l: 'Codex · weekly', p: 55, r: 'resets Sun 23:00', c: '#60a5fa' },
];

const fmt = s => s >= 3600 ? `${Math.floor(s / 3600)}h ${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}m` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
const av = (k, s) => `<span class="av" style="--c:${AG[k].c};${s ? `--s:${s}px` : ''}" title="${AG[k].n}" aria-label="${AG[k].n}">${AG[k].l}</span>`;
const avs = ks => ks.length ? `<span class="av-stack">${ks.map(k => av(k)).join('')}</span>` : '<span class="muted">—</span>';
const tt = t => `<span class="tt" style="--c:${TT[t]}">${t}</span>`;
const rt = k => `<span class="rt">${AG[k].rt}</span>`;
const ST = { running: ['run', 'Running'], waiting: ['wait', 'Waiting', 'clock'], idle: ['idle', 'Idle', 'minus'], done: ['done', 'Done', 'check'], error: ['err', 'Error', 'alert'] };
const st = (s, short) => { const [c, t, i] = ST[s]; return `<span class="st st-${c}">${i ? icon(i) : '<i class="pulse"></i>'}${short ? '' : t}</span>`; };
const ago = s => s;
function spark(a, c, w = 64, h = 16) {
  const m = Math.max(...a, 1), p = a.map((v, i) => `${(i * (w - 2) / (a.length - 1) + 1).toFixed(1)},${(h - 1 - v / m * (h - 2)).toFixed(1)}`).join(' ');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${p}" fill="none" stroke="${c}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
const A = (n, t) => ` data-anno="${n}|${t}"`;
const annoB = n => `<i class="anno-b">${n}</i>`;

function panel(o) {
  return `<section class="panel ${o.cls || ''}" ${o.id ? `id="${o.id}"` : ''}><header class="panel-h">${o.i ? icon(o.i) : ''}<span>${o.t}</span>${o.count != null ? `<span class="count ${o.warn ? 'warn' : ''}" ${o.warn ? 'data-needs-count' : ''}>${o.count}</span>` : ''}<span class="sp">${o.act || ''}</span></header><div class="panel-b ${o.flush ? 'flush' : ''}">${o.body}</div></section>`;
}

/* ── Needs you ── */
function needItem(n, o = {}) {
  const pr = PR[n.pr], lg = o.lg, open = o.open === n.id;
  const k = { approval: 'shield', question: 'msg', error: 'alert' }[n.kind];
  let text;
  if (n.kind === 'approval') text = `<b>${AG[n.ag].n}</b> ${n.verb}: <span class="mono od-truncate">${n.cmd}</span>`;
  else if (n.kind === 'question') text = `<b>${AG[n.ag].n}</b> ${n.verb}: <span class="od-truncate">${n.q}</span>`;
  else text = `<b>${AG[n.ag].n}</b> ${n.verb}: <span class="mono od-truncate">${n.cmd} · TS2345</span>`;
  const acts = n.kind === 'approval' ? `<button class="btn sm p" data-act="approve">${icon('check')}Approve</button><button class="btn sm d" data-act="deny">${icon('x')}Deny</button>`
    : n.kind === 'question' ? `<button class="btn sm" data-act="open">Answer</button>`
    : `<button class="btn sm p" data-act="retry">${icon('rot')}Retry</button><button class="btn sm g" data-act="open">Thread</button>`;
  let det = '';
  if (n.kind === 'approval') det = `<pre class="code"><span class="pr">$ </span>${n.cmd}</pre><dl class="dl"><dt>Reason</dt><dd>${n.reason}</dd><dt>Directory</dt><dd class="mono">${n.cwd}</dd><dt>Risk</dt><dd>${n.risk}</dd><dt>Tool</dt><dd>${tt(n.tag)} requested by ${av(n.ag, 16)} ${AG[n.ag].n} · ${pr.n}</dd></dl><div class="ny-foot"><label><input type="checkbox"> Always allow this command in ${pr.n}</label><button class="btn sm g" data-act="open">${icon('edit')}Edit command</button><button class="btn sm d" data-act="deny">${icon('x')}Deny <kbd>D</kbd></button><button class="btn sm p" data-act="approve">${icon('check')}Approve <kbd>A</kbd></button></div>`;
  else if (n.kind === 'question') det = `<dl class="dl"><dt>Context</dt><dd>Lead found 11 competitors in ${pr.n}; a deep dive on all is ~2h of agent time.</dd></dl><div class="chip-row" style="margin-bottom:8px">${n.opts.map(x => `<button class="chip" data-act="answer">${x}</button>`).join('')}</div><label class="cmd" style="height:28px"><input placeholder="Or type an answer for Lead…" aria-label="Answer for Lead"><kbd>⏎</kbd></label>`;
  else det = `<pre class="code">${n.log}</pre><dl class="dl"><dt>Detail</dt><dd>${n.reason}</dd><dt>Directory</dt><dd class="mono">${n.cwd}</dd></dl><div class="ny-foot"><span style="margin-right:auto" class="muted">Retry uses 1 Codex slot; the 5-hour window is at 82%.</span><button class="btn sm g" data-act="dismiss">Dismiss</button><button class="btn sm" data-act="open">Open thread</button><button class="btn sm p" data-act="retry">${icon('rot')}Retry</button></div>`;
  return `<article class="ny ${lg ? '' : ''} ${open ? 'open' : ''} ${o.hover === n.id ? 'is-hover' : ''}" data-kind="${n.kind}" data-id="${n.id}"${n.id === 'n1' ? A(1, 'Approval: click expands inline with exact command + reason') : ''}>
    <div class="ny-head" role="button" tabindex="0" aria-expanded="${open}"><span class="ny-k" title="${n.kind}">${icon(k)}</span>${av(n.ag)}<span class="ny-text">${text}</span>${lg ? `<span class="pt">${icon(pr.k === 'research' ? 'book' : 'branch')}${pr.n}</span>` : `<span class="pt od-nowrap">${pr.n.length > 14 ? pr.n.slice(0, 13) + '…' : pr.n}</span>`}<span class="muted mono od-nowrap">${n.age}</span><span class="ny-actions">${acts}</span><span class="ny-chev">${icon('down')}</span></div>
    <div class="ny-detail">${det}</div>${n.id === 'n1' ? annoB(1) : ''}</article>`;
}
const needs = (o = {}) => `<div class="ny-list ${o.lg ? 'ny-lg' : ''}" data-needs>${(o.only ? NEEDS.filter(n => o.only.includes(n.kind)) : NEEDS).map(n => needItem(n, o)).join('')}</div>`;

/* ── Agents ── */
function agentCard(a, o = {}) {
  const ag = AG[a.ag], pr = PR[a.pr], c = ag.c, hv = o.hover === a.id ? 'is-hover' : '';
  const acts = `<span class="ac-act"><button class="btn ic sm" aria-label="Open thread" title="Open thread" data-act="open">${icon('msg')}</button><button class="btn ic sm" aria-label="Pause" title="Pause" data-act="pause">${icon('pause')}</button><button class="btn ic sm" aria-label="Steer" title="Steer" data-act="open">${icon('send')}</button></span>`;
  const an = a.id === 'l1' ? A(2, 'Agent card: click opens the chat thread (tool cards inline)') : '';
  if (o.compact) return `<article class="ac compact ${hv}" data-open="thread" tabindex="0"${an}>${acts}<div class="ac-top">${av(a.ag)}<span class="ac-name">${ag.n}</span>${rt(a.ag)}<span class="pt od-truncate" style="flex:1">${pr.n}</span>${st(a.st)}</div><div class="ac-step">${tt(a.tag)}<span class="mono od-truncate">${a.step}</span>${spark(a.sp, c, 48, 14)}<span class="mono muted od-nowrap" ${a.st === 'running' ? `data-el="${a.s}"` : ''}>${a.s ? fmt(a.s) : '—'}</span></div>${a.id === 'l1' ? annoB(2) : ''}</article>`;
  return `<article class="ac ${hv}" data-open="thread" tabindex="0" style="--c:${c}"${an}>${acts}<div class="ac-top">${av(a.ag, 22)}<span class="ac-name">${ag.n}</span>${rt(a.ag)}<span style="flex:1"></span>${st(a.st)}</div><span class="pt od-truncate">${icon(pr.k === 'research' ? 'book' : 'branch')}${pr.n}</span><div class="ac-step">${tt(a.tag)}<span class="mono od-truncate">${a.step}</span></div><div class="bar" style="--w:${a.pg}%"><i></i></div><div class="ac-foot">${spark(a.sp, c, 56, 14)}<span class="grow"></span><span class="mono" ${a.st === 'running' ? `data-el="${a.s}"` : ''}>${a.s ? fmt(a.s) : '—'}</span></div>${a.id === 'l1' ? annoB(2) : ''}</article>`;
}
function agentRow(a, o = {}) {
  return `<div class="ar ${o.hover === a.id ? 'is-hover' : ''}" data-open="thread" tabindex="0">${av(a.ag)}<b style="width:68px;font-weight:600">${AG[a.ag].n}</b>${rt(a.ag)}${st(a.st, true)}${tt(a.tag)}<span class="mono od-truncate">${a.step}</span><span class="mono muted od-nowrap">${a.s ? fmt(a.s) : '—'}</span></div>`;
}
const agents = (o = {}) => o.layout === 'rows' ? `<div class="od-stack" style="--od-gap:1px">${LIVE.map(a => agentRow(a, o)).join('')}</div>`
  : o.layout === 'rail' ? `<div class="od-rail" style="--od-rail-pad:0;--od-gap:6px">${LIVE.map(a => `<div style="width:${o.w || 200}px">${agentCard(a, o)}</div>`).join('')}</div>`
  : `<div class="${o.cols === 2 ? 'cards-2' : 'od-grid'}" style="--od-cols:${o.cols || 3};--od-gap:6px">${LIVE.map(a => agentCard(a, o)).join('')}</div>`;

/* ── Projects ── */
const projIcon = k => icon(k === 'research' ? 'book' : 'branch');
function projects(o = {}) {
  const rows = Object.values(PR);
  if (o.layout === 'list') return `<div class="od-stack" style="--od-gap:0">${rows.map(p => `<div class="row click" data-open="project"${p === rows[0] ? A(4, 'Project: opens project workspace (agents, files, chat)') : ''}>${projIcon(p.k)}<b class="od-truncate od-fill" style="font-weight:500">${p.n}</b>${avs(p.ag)}${st(p.st, true)}<span class="mono muted od-nowrap" style="width:54px;text-align:right">${p.last}</span></div>`).join('')}</div>`;
  return `<div><div class="trow thead trow-proj"><span>Project</span><span>Status</span><span>Agents</span><span>Last</span><span>Tags</span></div>${rows.map((p, i) => `<div class="trow trow-proj" data-open="project" style="position:relative"${i === 0 ? A(4, 'Project: opens project workspace') : ''}><span class="od-row" style="--od-gap:6px;min-width:0">${projIcon(p.k)}<span class="od-truncate" style="font-weight:500">${p.n}</span></span>${st(p.st)}${avs(p.ag)}<span class="mono muted">${p.last.replace(' ago', '')}</span><span class="chip-row" style="flex-wrap:nowrap;overflow:hidden">${p.tags.slice(0, 2).map(t => `<span class="chip">${t}</span>`).join('')}</span>${i === 0 ? annoB(4) : ''}</div>`).join('')}</div>`;
}

/* ── Outputs ── */
function outputs(o = {}) {
  const rep = OUT.reports.map((r, i) => `<div class="row click" data-open="review" ${i === 0 ? A(3, 'Output: opens the review screen (diff / report reader)') : ''} style="position:relative">${icon('file', 14)}<span class="od-truncate od-fill">${r.t}</span><span class="chip">${r.src} sources</span>${av(r.ag, 16)}<span class="mono muted od-nowrap">${r.age}</span>${i === 0 ? annoB(3) : ''}</div>`).join('');
  const br = OUT.branches.map(b => `<div class="row click" data-open="review">${icon('branch', 14)}<span class="mono od-truncate od-fill">${b.b}</span><span class="mono add od-nowrap">+${b.a.toLocaleString()}</span><span class="mono del od-nowrap">−${b.d.toLocaleString()}</span>${av(b.ag, 16)}<span class="mono muted od-nowrap">${b.age}</span></div>`).join('');
  return `<div><div class="sec-h">Reports · ${OUT.reports.length}</div>${rep}<div class="sec-h">Branches · ${OUT.branches.length}</div>${br}</div>`;
}

/* ── Usage ── */
function meter(u) {
  const hot = u.p >= 80;
  return `<div class="meter ${hot ? 'hot' : ''}"><div class="meter-top"><span>${u.l}</span><span class="pc">${hot ? '' : ''}${u.p}%</span></div><div class="track" role="progressbar" aria-valuenow="${u.p}" aria-valuemin="0" aria-valuemax="100" aria-label="${u.l}" style="--w:${u.p}%;--c:${u.c}"><i></i></div><div class="meter-sub">${hot ? icon('alert') + 'Near limit · ' : ''}${u.r}</div></div>`;
}
function usage(o = {}) {
  const slots = `<div class="od-row" style="--od-gap:8px"><span>Concurrency</span><span class="slots" aria-label="3 of 4 slots in use"><i class="on"></i><i class="on"></i><i class="wait"></i><i></i></span><b class="mono">3/4</b><span class="muted" style="margin-left:auto">${icon('layers', 12)} <span class="mono">2</span> queued</span></div>`;
  const ms = USAGE.map(meter);
  return `<div ${A(5, 'Usage: click opens window details + rate-limit history')} style="position:relative">${o.strip ? `<div class="od-grid" style="--od-cols:2;--od-gap:4px 16px">${ms.join('')}</div>` : ms.join('')}<div style="margin-top:6px">${slots}</div>${annoB(5)}</div>`;
}

/* ── Feed / briefing / capture ── */
const feedRow = f => `<div class="feed-row" data-open="thread"><time>${f[0]}</time>${av(f[1], 16)}<span class="tx od-truncate"><b style="font-weight:600">${AG[f[1]].n}</b> ${f[2]}</span>${tt(f[3])}</div>`;
const feed = (n = 99) => `<div data-feed ${A(7, 'Feed event: jumps to that thread + tool card')} style="position:relative">${FEED.slice(0, n).map(feedRow).join('')}</div>`;
function briefing(o = {}) {
  return `<div class="brief" ${A(8, 'Suggested action: click runs it (approve / open review / schedule)')} style="position:relative"><div class="meta">${icon('spark', 14)}<span>${BRIEF.when}</span></div>${BRIEF.html}<div class="chip-row">${BRIEF.acts.map(a => `<button class="chip" data-act="suggest">${a}</button>`).join('')}</div>${annoB(8)}</div>`;
}
const cmdbar = (o = {}) => `<label class="cmd" ${A(6, 'Quick capture: ⌘K — start a task or ask Lead')} style="${o.w ? `width:${o.w}px;` : ''}">${icon('search')}<span class="cmd-to">${icon('bot', 12)} Ask Lead</span><input data-cmd placeholder="${o.ph || 'Start a task or ask Lead…'}" aria-label="Quick capture"><kbd>⌘K</kbd>${annoB(6)}</label>`;

/* ── Chrome ── */
function nav(o = {}) {
  const it = (i, t, a, extra) => `<button class="nav-item ${a ? 'active' : ''}">${icon(i)}<span>${t}</span>${extra || ''}</button>`;
  return `<nav class="nav" aria-label="Primary">${it('dash', 'Mission Control', 1)}${it('folder', 'Projects', 0, `<span class="count" style="margin-left:auto">6</span>`)}${o.tree === false ? '' : Object.values(PR).map(p => `<button class="nav-proj"><span class="st st-${ST[p.st][0]}" style="padding:0;height:auto;background:none;border:0">${ST[p.st][2] ? icon(ST[p.st][2], 12) : '<i class="pulse"></i>'}</span><span class="od-truncate">${p.n}</span></button>`).join('')}
    ${it('bot', 'Agent library')}${it('book', 'Knowledge base')}${it('shield', 'Approvals', 0, '<span class="badge" data-needs-count>5</span>')}${it('settings', 'Settings')}
    <div class="nav-foot"><span class="av" style="--c:#8b7cf6;--s:22px">A</span><span>Local · all agents on this Mac</span></div></nav>`;
}
function titlebar(mid, right) {
  return `<header class="titlebar"><span class="lights"><i></i><i></i><i></i></span><span class="app-name">${icon('zap', 14)}Mission Control</span>${mid || ''}<span class="tb-right">${right || `<span class="chip">${icon('cpu', 12)} 3/4 slots</span><span class="chip" style="color:var(--success)">${icon('wifi', 12)} Local</span>`}</span></header>`;
}
const frame = o => `${titlebar(o.mid, o.right)}<div class="shell" style="--nav-w:${o.nw || 200}px">${o.nav === false ? o.pre || '' : nav(o)}<main class="main" ${o.mainStyle ? `style="${o.mainStyle}"` : ''}>${o.main}</main></div><div class="toast" role="status" aria-live="polite"></div>`;

/* ── Interactions ── */
let toastT;
function toast(msg) { const t = document.querySelector('.toast'); if (!t) return; t.innerHTML = icon('check') + msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }
function pushFeed(agent, text, tag) {
  const row = feedRow(['now', agent, text, tag]);
  document.querySelectorAll('[data-feed]').forEach(f => { f.insertAdjacentHTML('afterbegin', row); while (f.children.length > 40) f.lastElementChild.remove(); });
}
function recount() { const n = document.querySelectorAll('[data-needs] .ny:not(.resolved)').length / Math.max(1, document.querySelectorAll('[data-needs]').length > 1 ? 1 : 1); const c = [...document.querySelectorAll('[data-needs]')][0]; const v = c ? c.querySelectorAll('.ny:not(.resolved)').length : 0; document.querySelectorAll('[data-needs-count]').forEach(e => e.textContent = v); }
function resolve(item, msg, fa, ft, tg) {
  const id = item.dataset.id; item.classList.add('resolved');
  setTimeout(() => { document.querySelectorAll(`.ny[data-id="${id}"]`).forEach(e => e.remove()); recount(); }, 220);
  const n = NEEDS.find(x => x.id === id); toast(msg); if (n) pushFeed(fa || n.ag, ft || msg.toLowerCase(), tg || n.tag || 'BASH');
}
document.addEventListener('click', e => {
  const t = e.target, btn = t.closest('[data-act]'), item = t.closest('.ny');
  if (btn) {
    e.stopPropagation(); const act = btn.dataset.act;
    if (item) {
      const n = NEEDS.find(x => x.id === item.dataset.id), who = n ? AG[n.ag].n : '';
      if (act === 'approve') return resolve(item, `Approved · ${who} resumes`, n.ag, `resumed after approval (${n.cmd.slice(0, 32)})`);
      if (act === 'deny') return resolve(item, `Denied · ${who} told to find another way`, n.ag, 'was denied and is replanning');
      if (act === 'retry') return resolve(item, `Retry queued · waits for Codex window`, n.ag, 'retry queued for CLI refactor build');
      if (act === 'dismiss') return resolve(item, 'Dismissed');
      if (act === 'answer') return resolve(item, `Answered “${btn.textContent}” · Lead continues`, 'lead', `got your answer: ${btn.textContent}`, 'SPAWN');
      if (act === 'open') return toast('Opens the chat thread for this run');
    }
    if (act === 'suggest') return toast(`Queued: ${btn.textContent}`);
    if (act === 'open') return toast('Opens chat thread');
    if (act === 'pause') return toast('Agent paused after current step');
    return;
  }
  const head = t.closest('.ny-head'); if (head) { const open = !item.classList.contains('open'); item.classList.toggle('open', open); head.setAttribute('aria-expanded', open); document.querySelectorAll('.ny.sel').forEach(x => x.classList.remove('sel')); item.classList.add('sel'); return; }
  const o = t.closest('[data-open]'); if (o) { const m = { thread: 'Opens the agent chat thread', project: 'Opens the project workspace', review: 'Opens the review screen' }; toast(m[o.dataset.open]); return; }
  const tab = t.closest('[data-tab]'); if (tab) { const g = tab.closest('[data-tabs]'); g.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === tab)); g.querySelectorAll('[data-pane]').forEach(p => p.classList.toggle('on', p.dataset.pane === tab.dataset.tab)); }
  const fl = t.closest('[data-filter]'); if (fl) { const g = fl.closest('[data-filters]'); g.querySelectorAll('[data-filter]').forEach(x => x.classList.toggle('sel', x === fl)); const k = fl.dataset.filter; document.querySelectorAll('[data-needs] .ny').forEach(n => n.style.display = (k === 'all' || n.dataset.kind === k) ? '' : 'none'); }
});
document.addEventListener('keydown', e => {
  const inField = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); const c = document.querySelector('[data-cmd]'); c && c.focus(); return; }
  if (e.key === 'Enter' && document.activeElement.matches('[data-cmd]')) { const v = document.activeElement.value.trim(); if (v) { pushFeed('lead', `received your task: “${v.slice(0, 40)}”`, 'SPAWN'); toast('Sent to Lead · it will propose a team'); document.activeElement.value = ''; } return; }
  if (e.key === 'Enter' && document.activeElement.matches('.ny-head,.ac,.ar')) { document.activeElement.click(); return; }
  if (inField) return;
  const list = [...document.querySelectorAll('[data-needs] .ny:not(.resolved)')].filter(x => x.offsetParent);
  const cur = list.findIndex(x => x.classList.contains('sel')), go = i => { if (!list.length) return; const n = list[(i + list.length) % list.length]; list.forEach(x => x.classList.remove('sel', 'open')); n.classList.add('sel', 'open'); n.scrollIntoView({ block: 'nearest' }); };
  if (e.key === 'j') go(cur + 1); else if (e.key === 'k') go(cur - 1);
  else if ((e.key === 'a' || e.key === 'd') && cur > -1) list[cur].querySelector(e.key === 'a' ? '[data-act=approve],[data-act=retry]' : '[data-act=deny],[data-act=dismiss]')?.click();
});
setInterval(() => document.querySelectorAll('[data-el]').forEach(e => { const s = +e.dataset.el + 1; e.dataset.el = s; e.textContent = fmt(s); }), 1000);
const live = [['researcher', 'saved 2 more sources to ev-battery/sources/', 'WRITE'], ['builder', 'edited src/hooks/useStreak.ts (+18 −4)', 'EDIT'], ['researcher', 'fetched cathodes.example/producers-2025', 'WEB'], ['tester', 'queued pnpm test reminders', 'BASH']];
let li = 0; setInterval(() => { if (document.hidden) return; const f = live[li++ % live.length]; pushFeed(f[0], f[1], f[2]); }, 7000);
window.addEventListener('message', e => { if (e.data && e.data.anno !== undefined) document.documentElement.classList.toggle('annos', !!e.data.anno); });
if (/anno=1/.test(location.search)) document.documentElement.classList.add('annos');

window.MC = { I, icon, AG, PR, LIVE, NEEDS, OUT, FEED, USAGE, av, avs, tt, st, rt, spark, panel, needs, needItem, agents, agentCard, agentRow, projects, outputs, usage, feed, briefing, cmdbar, nav, titlebar, frame, toast, A, annoB, fmt };
})();
