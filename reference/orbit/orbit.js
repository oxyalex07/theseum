/* Theseus — Alex's personal agent app. Chat-first: Home → sessions → conversation + inspector.
   Two spaces (Code, Research), a named crew, memory of how Alex works, routines.
   Prototype: all state is in-page; agent activity and replies are simulated. Uses icon paths from shared.js. */
(function () {
const I = MC.I;
Object.assign(I, {
  msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  cols: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18"/>', sq: '<rect x="3" y="3" width="18" height="18" rx="2"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/>',
  term: '<path d="m4 17 6-6-6-6M12 19h8"/>', bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>', send: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  pr: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7M6 9v12"/>',
  fork: '<circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9M12 12v3"/>',
  ext: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
  slash: '<path d="M16 3 8 21"/>', ref: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M8 16H3v5"/>',
  home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>', code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  brain: '<path d="M12 5a3 3 0 0 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 0 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M12 5v13"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>', bug: '<rect x="8" y="6" width="8" height="14" rx="4"/><path d="M19 7l-3 2M5 7l3 2M19 19l-3-2M5 19l3-2M20 13h-4M4 13h4M10 4l1 2M14 4l-1 2"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>',
  news: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  wand: '<path d="m15 4-1 3M19 8l-3 1M6 21 18 9l-3-3L3 18z"/>', layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
});
const icon = (n, s) => `<svg class="od-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${s ? ` style="--od-icon-size:${s}px"` : ''}>${I[n] || ''}</svg>`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ── who's who ── */
const ME = { n: 'Alex', i: 'A' };
const AG = {
  orbit: { n: 'Theseus', l: 'T', c: '#a79bff', role: 'Chief of staff', model: 'claude · opus', p: 'Plans, routes work to the crew, keeps your memory up to date. Asks before anything irreversible.' },
  forge: { n: 'Forge', l: 'F', c: '#a3e635', role: 'Builder', model: 'codex · gpt-5', p: 'Writes code in a worktree. Small commits, draft PRs, TypeScript strict, pnpm.' },
  sentinel: { n: 'Sentinel', l: 'S', c: '#fb923c', role: 'Reviewer & tests', model: 'claude · sonnet', p: 'Reviews every PR Forge opens, writes missing tests, blocks merges on red CI.' },
  scout: { n: 'Scout', l: 'S', c: '#2dd4bf', role: 'Researcher', model: 'claude · sonnet', p: 'Finds and reads sources. Prefers primary sources, cites everything, flags opinion.' },
  quill: { n: 'Quill', l: 'Q', c: '#f472b6', role: 'Writer', model: 'claude · opus', p: 'Drafts in your voice: short sentences, no hype, one idea per paragraph.' },
};
const av = (k, s) => `<span class="av${k === 'orbit' ? ' av-brand' : ''}" style="--c:${AG[k].c};${s ? `--s:${s}px` : ''}" title="${AG[k].n} · ${AG[k].role}">${k === 'orbit' ? '<img src="assets/brand/mark-color-dark.svg" alt="" width="24" height="24">' : AG[k].l}</span>`;
const PJ = {
  habit: { n: 'habit-tracker-app', sp: 'code' }, cli: { n: 'cli-tools', sp: 'code' }, dot: { n: 'dotfiles', sp: 'code' },
  agents: { n: 'Agent frameworks', sp: 'research' }, notes: { n: 'Weekly AI notes', sp: 'research' }, ev: { n: 'EV supply chain', sp: 'research' }, me: { n: 'Personal', sp: 'all' },
};
const TC = { READ: '#60a5fa', WRITE: '#f472b6', EDIT: '#a3e635', BASH: '#fbbf24', WEB: '#2dd4bf', SPAWN: '#fbbf24', TEST: '#4ade80', GIT: '#a79bff', THINK: '#a79bff', CITE: '#2dd4bf', MEM: '#a79bff' };
const SD = { running: 'run', thinking: 'run', waiting: 'wait', question: 'wait', error: 'err', review: 'rev', done: 'done', queued: 'q' };
const SL = { running: 'Working', thinking: 'Thinking', waiting: 'Needs approval', question: 'Needs your pick', error: 'Failed', review: 'Ready for you', done: 'Done', queued: 'Queued' };
const SP = { running: 'run', thinking: 'run', waiting: 'wait', question: 'wait', error: 'err', review: 'rev' };
const NEEDY = ['waiting', 'question', 'error', 'review'];

/* ── memory: how Alex works ── */
const MEM = {
  code: { ic: 'code', t: 'How I code', xs: ['TypeScript strict, no any', 'pnpm, never npm', 'Small commits, open PRs as drafts', 'Vitest for tests, colocated *.test.ts', 'Ask before adding a dependency'] },
  research: { ic: 'book', t: 'How I research', xs: ['Primary sources first; flag opinion pieces', 'Cite every claim inline', 'Comparison tables over long prose', 'Stop at ~15 good sources'] },
  voice: { ic: 'pen', t: 'How I write', xs: ['Short sentences, no hype words', 'One idea per paragraph', 'Lead with the takeaway', 'Never use "delve" or "game-changer"'] },
  rhythm: { ic: 'sun', t: 'My rhythm', xs: ['Morning brief at 8:00, 5 bullets max', 'Deep work 9–12: only ping me for blockers', 'Heavy builds after the Codex reset', 'Weekly AI notes ship Friday'] },
};
MEM.code.xs.push({ t: 'Prefer recharts for charts', nw: 1 });
const memText = m => typeof m === 'string' ? m : m.t;

/* ── sessions ── */
const SS = [
  { id: 'c1', ag: 'forge', pj: 'habit', t: 'Streak chart on habit screen', st: 'waiting', time: '3:28 PM', br: 'feat/streak-chart', prn: 48, loop: [12, 24], add: 82, del: 4, mem: 3, prev: ['BASH', 'wants to run pnpm add recharts'] },
  { id: 'r2', ag: 'quill', pj: 'notes', t: 'Draft: Weekly AI notes #12', st: 'question', time: '3:22 PM', words: 940, mem: 4, prev: ['ASK', 'Pick a headline'] },
  { id: 'c3', ag: 'forge', pj: 'cli', t: 'Fix parser null check', st: 'error', time: '3:14 PM', br: 'fix/parser-null', prn: 45, ci: 'fail', prev: ['BASH', 'TS2345 parser.ts:88 · 3 retries'] },
  { id: 'c2', ag: 'sentinel', pj: 'habit', t: 'Review PR #47 · reminders', st: 'review', time: '3:05 PM', prn: 47, ci: 'ok', add: 36, del: 12, prev: ['GIT', '3 findings · 1 high'] },
  { id: 'r1', ag: 'scout', pj: 'agents', t: 'Compare agent orchestration frameworks', st: 'thinking', time: '3:31 PM', srcN: 11, loop: [6, 10], mem: 2, prev: ['WEB', 'reading docs.crewai.com/concepts'] },
  { id: 'c5', ag: 'sentinel', pj: 'habit', t: 'Timezone tests for reminders', st: 'running', time: '3:27 PM', br: 'test/reminder-tz', prev: ['TEST', 'vitest reminders.tz — 6/9 passing'] },
  { id: 'r3', ag: 'scout', pj: 'ev', t: 'Cathode supplier risk map', st: 'done', time: '12:40 PM', srcN: 24, prev: ['WRITE', 'report · 24 sources · 6 pages'] },
  { id: 'r4', ag: 'quill', pj: 'agents', t: 'Blog: why I built Theseus', st: 'queued', time: '3:10 PM', prev: ['', 'starts after Scout’s comparison'] },
  { id: 'c4', ag: 'forge', pj: 'dot', t: 'Sync zsh config to new Mac', st: 'done', time: '11:02 AM', prev: ['GIT', 'merged · 14 files'] },
  { id: 'o1', ag: 'orbit', pj: 'me', t: 'Morning brief', st: 'done', time: '8:00 AM', routine: 1, prev: ['', '5 bullets · 2 decisions for you'] },
];
const ss = id => SS.find(s => s.id === id);
const space = s => PJ[s.pj].sp;

/* ── threads ── */
const SRC = [
  ['LangGraph docs', 'langchain-ai.github.io/langgraph', 'p', '#1c3c3c', 4], ['CrewAI concepts', 'docs.crewai.com/concepts', 'p', '#ef4444', 3], ['Claude Agent SDK', 'docs.anthropic.com/agent-sdk', 'p', '#d97757', 5],
  ['AutoGen v0.4 release', 'microsoft.github.io/autogen', 'p', '#2563eb', 2], ['“Multi-agent is overrated”', 'someblog.substack.com', 'o', '#f59e0b', 1], ['OpenAI Agents SDK', 'openai.github.io/agents', 'p', '#10a37f', 2],
  ['Mastra docs', 'mastra.ai/docs', 'p', '#6366f1', 1], ['GitHub stars, Oct', 'star-history.com', 's', '#24292f', 2], ['HN thread: agent frameworks', 'news.ycombinator.com', 'o', '#ff6600', 1],
  ['Pydantic AI', 'ai.pydantic.dev', 'p', '#e92063', 1], ['State of AI agents 2026', 'research.example.org', 's', '#0ea5e9', 3],
];
const T = {
  c1: [
    { sys: 'Started 22m ago · feat/streak-chart · Loop 12/24' },
    { r: 'you', t: 'Add a 30-day streak chart to the habit detail screen. Keep it under 80 lines.' },
    { mem: ['TypeScript strict', 'pnpm', 'draft PRs'] },
    { r: 'ag', t: 'Reading the detail screen and the tokens first.', tools: [{ tag: 'READ', title: 'src/screens/HabitDetail.tsx', meta: '180 lines' }, { tag: 'READ', title: 'src/styles/tokens.css', meta: '64 lines' }] },
    { card: 'plan', items: [[1, 'Read detail screen + tokens'], [1, 'Extend useStreak() to return history'], [1, 'Create StreakChart component'], [2, 'Install chart library'], [0, 'Wire chart under header'], [0, 'Hand to Sentinel for review']] },
    { r: 'ag', t: 'Added <code>StreakChart</code> and extended <code>useStreak()</code> to return the last 30 days.', tools: [{ tag: 'EDIT', title: 'src/components/StreakChart.tsx', meta: '+64 −0', out: '<span class="a">+ export function StreakChart({ days }: Props) {</span>\n<span class="a">+   const data = days.slice(-30)</span>\n<span class="a">+   return &lt;Chart data={data} accent="var(--accent)" /&gt;</span>\n<span class="a">+ }</span>' }, { tag: 'EDIT', title: 'src/hooks/useStreak.ts', meta: '+18 −4', out: '<span class="d">- return streak.current</span>\n<span class="a">+ return { current: streak.current, history: streak.days }</span>' }] },
    { r: 'ag', t: 'You asked me to check before adding dependencies. <code>recharts</code> is the smallest option that already matches your design tokens.' },
    { card: 'approval', cmd: 'pnpm add recharts@2.12.7', why: 'StreakChart renders with recharts. You remembered “Prefer recharts for charts” last week.', aff: [['file', 'package.json'], ['file', 'pnpm-lock.yaml'], ['globe', 'registry.npmjs.org']], risk: 'Medium' },
  ],
  c2: [
    { sys: 'Auto-review · PR #47 fix/reminder-tz by Forge' },
    { r: 'ag', t: 'Reviewed 2 files and ran the suite. Checks are green, but I found three things worth fixing before you merge.', tools: [{ tag: 'GIT', title: 'diff main…fix/reminder-tz', meta: '+36 −12' }, { tag: 'TEST', title: 'pnpm test', meta: '54 passed' }] },
    { card: 'review', items: [['h', 'DST jump drops the 2:30am reminder', 'src/reminders/schedule.ts:42'], ['m', 'Timezone read from Date, not user settings', 'src/reminders/schedule.ts:18'], ['l', 'Test name says UTC+12, fixture is UTC+13', 'src/reminders/tz.test.ts:77']] },
  ],
  c3: [
    { sys: 'cli-tools · fix/parser-null · PR #45' },
    { r: 'ag', t: 'Running the build after splitting the tokenizer.', tools: [{ tag: 'BASH', title: 'pnpm build', meta: 'exit 2', out: '<span class="d">src/parser.ts:88:21 - error TS2345: Argument of type \'Token | null\'\nis not assignable to parameter of type \'Token\'.</span>' }] },
    { r: 'ag', t: 'Three fixes failed: a non-null assertion (your lint rules ban it), an early return (breaks 4 tests), and widening the type (touches 11 files).', tools: [{ tag: 'EDIT', title: 'src/parser.ts', meta: 'reverted' }, { tag: 'TEST', title: 'vitest parser', meta: '4 failed' }] },
    { card: 'error', log: "src/parser.ts:88:21 - error TS2345\nArgument of type 'Token | null' is not assignable to 'Token'.", note: 'Failed after 3 retries. Last good commit a41c9e2.' },
  ],
  c5: [{ sys: 'habit-tracker-app · test/reminder-tz' }, { r: 'you', t: 'Cover reminders across DST and UTC+13.' }, { r: 'ag', t: 'Added fixtures for 9 timezones. Running them now.', tools: [{ tag: 'WRITE', title: 'src/reminders/tz.test.ts', meta: '+118' }, { tag: 'TEST', title: 'vitest reminders.tz', meta: '6/9 passing', run: 1 }] }],
  c4: [{ sys: 'dotfiles · merged' }, { r: 'ag', t: 'Copied zsh, git and starship config to the new Mac and symlinked them. 14 files.', tools: [{ tag: 'GIT', title: 'merge sync/new-mac', meta: '14 files' }] }, { card: 'done', t: 'Merged into main' }],
  r1: [
    { sys: 'Started 18m ago · Loop 6/10 · stops at ~15 sources' },
    { r: 'you', t: 'Compare the main agent orchestration frameworks for a personal multi-agent app. What would you pick for Theseus?' },
    { mem: ['primary sources first', 'comparison tables', 'cite inline'] },
    { r: 'ag', t: 'Starting with official docs, then release notes, then community takes (flagged as opinion).', tools: [{ tag: 'WEB', title: 'search “agent orchestration framework 2026”', meta: '12 results' }, { tag: 'WEB', title: 'docs.anthropic.com/agent-sdk', meta: '1.1s' }, { tag: 'WEB', title: 'langchain-ai.github.io/langgraph', meta: '0.8s' }] },
    { card: 'sources', n: 6 },
    { r: 'ag', t: 'Early read: LangGraph gives the most control over state <span class="cite">1</span>, CrewAI is fastest to a working crew <span class="cite">2</span>, and the Claude Agent SDK has the best built-in tools for coding work <span class="cite">3</span>. One community post argues single agents beat crews for most tasks <span class="cite">5</span> — opinion, but worth addressing.' },
    { card: 'table' },
    { r: 'ag', t: 'Reading CrewAI’s memory model next.', tools: [{ tag: 'WEB', title: 'docs.crewai.com/concepts/memory', meta: 'reading…', run: 1 }] },
  ],
  r2: [
    { sys: 'Weekly AI notes #12 · due Friday' },
    { r: 'ag', t: 'Draft is at 940 words across 5 sections, pulled from your saved links and Scout’s notes. Sections 1–4 are done.', tools: [{ tag: 'READ', title: 'notes/saved-links.md', meta: '23 links' }, { tag: 'WRITE', title: 'drafts/ai-notes-12.md', meta: '940 words' }] },
    { mem: ['short sentences', 'lead with takeaway', 'no hype words'] },
    { card: 'excerpt', t: 'Agents got cheaper this week. Not smarter — cheaper. That matters more than it sounds, because the bottleneck for most of us was never capability. It was cost per loop.' },
    { card: 'options', q: 'Pick a headline for #12', opts: [['Agents got cheaper, not smarter', 'Leads with the takeaway — matches your style', 1], ['The cost-per-loop issue', 'Shorter, more of a hook'], ['What $0.40 buys you now', 'Concrete number, slightly clickbait'], ['Write my own', 'I’ll wait for yours']] },
  ],
  r3: [{ sys: 'EV supply chain · finished 12:40 PM' }, { r: 'ag', t: 'Report done: 24 sources, 6 pages, 6 suppliers flagged high-risk. Quill tightened the summary.', tools: [{ tag: 'WRITE', title: 'reports/cathode-risk-map.md', meta: '6 pages' }] }, { card: 'done', t: 'Saved to Library · Reports' }],
  r4: [{ sys: 'Queued · starts after Scout’s comparison' }, { r: 'you', t: 'Once Scout is done, draft a post on why I built Theseus. Use the comparison as the backbone.' }, { r: 'ag', t: 'Queued. I’ll start the outline as soon as Scout’s table is final.' }],
  o1: [{ sys: 'Routine · every weekday at 8:00' }, { r: 'ag', t: 'Good morning, Alex. Overnight:<br>• Forge finished the streak chart up to the dependency step.<br>• Sentinel’s PR #47 review is ready (1 high finding).<br>• Scout found 6 sources on agent frameworks.<br>• cli-tools build is red since 11pm.<br>• Codex resets at 4:18 PM — heavy builds after that.', tools: [{ tag: 'READ', title: '6 sessions · 3 repos · 2 inboxes', meta: '0.9s' }] }, { card: 'done', t: 'Brief delivered · 2 decisions for you' }],
};
const thread = s => T[s.id] || (T[s.id] = [{ sys: `${AG[s.ag].n} · ${PJ[s.pj].n}` }, { r: 'ag', t: 'Ready. What should I work on?' }]);
const FILES = {
  c1: [['src/components/StreakChart.tsx', 64, 0, 'Added'], ['src/hooks/useStreak.ts', 18, 4], ['src/screens/HabitDetail.tsx', 9, 0], ['src/hooks/useStreak.test.ts', 22, 0, 'Added']],
  c2: [['src/reminders/schedule.ts', 22, 9], ['src/reminders/tz.test.ts', 14, 3]],
  c3: [['src/parser.ts', 412, 388], ['src/tokenizer.ts', 301, 0, 'Added'], ['src/cli.ts', 44, 61], ['test/parser.test.ts', 120, 98]],
  c5: [['src/reminders/tz.test.ts', 118, 0, 'Added']], c4: [['zsh/.zshrc', 40, 12], ['git/.gitconfig', 6, 2], ['starship.toml', 22, 0, 'Added']],
};
const ROUTINES = [['o1', 'sun', 'Morning brief', 'Weekdays 8:00', 'orbit', 1], ['', 'news', 'Weekly AI notes draft', 'Thu 14:00', 'quill', 1], ['', 'pr', 'Review open PRs', 'Every PR', 'sentinel', 1], ['', 'ref', 'Dependency updates', 'Mon 9:00', 'forge', 0]];

const S = { page: 'home', sel: null, open: ['c1', 'r1', 'r2'], view: 'focus', split2: null, itab: null, sub: 'changes', space: 'all', q: '', exp: new Set(['src/components/StreakChart.tsx']), tlo: new Set(), drafts: {}, homeAg: 'orbit', menu: null, fixed: new Set() };
const isCode = s => space(s) === 'code' || s.pj === 'me';

/* ── shared bits ── */
const sd = st => `<span class="sd ${SD[st]}" title="${SL[st]}"></span>`;
const spTag = s => s.pj === 'me' ? '' : `<span class="sp-tag ${space(s)}">${space(s) === 'code' ? 'CODE' : 'RSRCH'}</span>`;
function chips(s) {
  const c = [];
  if (s.loop) c.push(`<span class="ch vio">${icon('ref', 10)}${s.loop[0]}/${s.loop[1]}</span>`);
  if (s.prn) c.push(`<span class="ch">${icon('pr', 10)}#${s.prn}${s.ci === 'ok' ? ' <span class="a">✓</span>' : s.ci === 'fail' ? ' <span class="d">✕</span>' : ''}</span>`);
  if (s.add != null) c.push(`<span class="ch"><span class="a">+${s.add}</span><span class="d">−${s.del}</span></span>`);
  if (s.srcN) c.push(`<span class="ch" style="color:var(--teal)">${icon('link', 10)}${s.srcN} sources</span>`);
  if (s.words) c.push(`<span class="ch">${icon('pen', 10)}${s.words} words</span>`);
  if (s.routine) c.push(`<span class="ch vio">${icon('cal', 10)}routine</span>`);
  return c.length ? `<div class="ss-chips">${c.join('')}</div>` : '';
}
function prevLine(s) {
  if (s.st === 'thinking') return `<div class="ss-prev think"><span class="shimmer">Thinking…</span><span class="trunc" style="color:var(--meta)">${esc(s.prev[1])}</span></div>`;
  const cls = { waiting: 'amb', question: 'amb', error: 'red' }[s.st] || '';
  return `<div class="ss-prev ${cls}">${s.prev[0] ? `<span class="tg">${s.prev[0]}</span>` : ''}<span class="trunc">${esc(s.prev[1])}</span></div>`;
}
function sessItem(s) {
  return `<button class="ss${S.page === 'session' && S.sel === s.id ? ' on' : ''}${S.open.includes(s.id) ? ' open' : ''}" data-s="${s.id}">
    <div class="ss-top">${spTag(s)}<span class="proj trunc">${esc(PJ[s.pj].n)}</span><span class="t">${s.time}</span></div>
    <div class="ss-title">${sd(s.st)}${av(s.ag, 16)}<span class="trunc">${esc(s.t)}</span></div>${prevLine(s)}${chips(s)}</button>`;
}
const inSpace = s => S.space === 'all' || space(s) === S.space || s.pj === 'me';
function sidebar() {
  if (S.page === 'settings') return settingsNav();
  const m = s => inSpace(s) && (!S.q || (s.t + PJ[s.pj].n + AG[s.ag].n).toLowerCase().includes(S.q.toLowerCase()));
  const G = [['Needs you', NEEDY, 'amb'], ['Working', ['running', 'thinking', 'queued']], ['Done today', ['done']]];
  const needs = SS.filter(s => NEEDY.includes(s.st) && inSpace(s)).length;
  const list = G.map(([n, sts, cls]) => { const xs = SS.filter(s => sts.includes(s.st) && m(s)); return xs.length ? `<div class="grp ${cls || ''}">${cls ? icon('alert', 11) : ''}${n}<span class="c">${xs.length}</span></div>${xs.map(sessItem).join('')}` : ''; }).join('') || `<div style="padding:24px 10px;color:var(--meta);font-size:12px;text-align:center">Nothing here yet</div>`;
  return `<aside class="side" style="grid-template-rows:auto auto minmax(0,1fr) auto auto"><div class="side-h"><h2>${icon('msg', 15)}Sessions</h2><div class="split-btn"><button data-a="new">${icon('plus', 13)}New</button><button data-a="new" aria-label="New session options">${icon('down', 12)}</button></div></div>
  <label class="search">${icon('search', 13)}<input id="sq" placeholder="Search sessions, sources, files…" value="${esc(S.q)}"></label>
  <div class="slist"><button class="ss home${S.page === 'home' ? ' on' : ''}" data-pg="home"><span class="gl">${icon('home', 14)}</span><span>Home<small>${needs} need you · ${SS.filter(s => ['running', 'thinking'].includes(s.st)).length} working</small></span></button>${list}</div>
  <div class="routines"><div class="grp">${icon('cal', 11)}Routines<span class="c"><button data-pg="routines" style="color:var(--meta);font-size:10.5px">Manage</button></span></div>${ROUTINES.slice(0, 3).map(([id, ic, n, w]) => `<button class="rt-row" ${id ? `data-s="${id}"` : 'data-pg="routines"'}>${icon(ic, 13)}<span class="trunc">${n}</span><span class="when">${w}</span></button>`).join('')}</div>
  <div class="side-f"><button data-a="archived">${icon('clock', 12)}Older sessions</button><span style="margin-left:auto">${SS.length} today</span></div></aside>`;
}
function tool(t, sid, i, j) {
  const k = `${sid}-${i}-${j}`, o = S.tlo.has(k);
  return `<div class="tl${o ? ' open' : ''}${t.run ? ' run' : ''}"><button class="tl-h" data-tl="${k}"><span class="tg" style="--c:${TC[t.tag] || '#9696a8'}">${t.tag}</span><span class="tt2 trunc">${esc(t.title)}</span><span class="mt">${t.run ? '<span class="shimmer">' + esc(t.meta) + '</span>' : esc(t.meta || '')}</span>${t.out ? `<span class="chev">${icon('right', 11)}</span>` : ''}</button>${t.out ? `<div class="tl-b">${t.out}</div>` : ''}</div>`;
}
const srcCard = (x, i) => `<button class="src" data-a="src"><span class="fav" style="background:${x[3]}">${x[0][0] === '“' ? x[0][1] : x[0][0]}</span><span style="min-width:0;flex:1"><b class="trunc">${esc(x[0])}</b><small class="trunc">${esc(x[1])}</small></span><span class="kind ${x[2]}">${{ p: 'primary', s: 'data', o: 'opinion' }[x[2]]}</span></button>`;
function card(c, s, i, mini) {
  const nm = AG[s.ag].n;
  if (c.card === 'approval') return `<div class="card appr"><div class="card-h">${icon('shield', 14)}${nm} wants to run a command<span class="k">${c.risk} risk</span></div><div class="card-b"><pre class="code"><span class="p">$ </span>${esc(c.cmd)}</pre>${mini ? '' : `<div class="why">${esc(c.why)}</div><div class="aff">${c.aff.map(a => `<span>${icon(a[0], 11)}${esc(a[1])}</span>`).join('')}</div>`}<div class="btns"><button class="btn p sm" data-ap="${s.id}">${icon('check', 12)}Approve${mini ? '' : ' <kbd>⌘↵</kbd>'}</button>${mini ? '' : `<button class="btn sm" data-al="${s.id}">${icon('brain', 12)}Always allow + remember</button><button class="btn sm" data-a="edit">${icon('edit', 12)}Edit</button>`}<button class="btn g sm" data-dn="${s.id}">${icon('x', 12)}Deny</button></div></div></div>`;
  if (c.card === 'options') return `<div class="card"><div class="card-h">${icon('help', 14)}${esc(c.q)}<span class="k">${nm} asks</span></div><div class="card-b"><div class="opts">${c.opts.slice(0, mini ? 2 : 9).map((o, j) => `<button class="opt${c.pick === j ? ' picked' : ''}" data-op="${s.id}:${i}:${j}"><span class="n">${j + 1}</span><span style="min-width:0"><b>${esc(o[0])}</b>${mini ? '' : `<small>${esc(o[1])}</small>`}</span>${o[2] ? '<span class="rec">Your style</span>' : ''}</button>`).join('')}</div></div></div>`;
  if (c.card === 'error') return `<div class="card err"><div class="card-h">${icon('alert', 14)}Build failed<span class="k">3 retries</span></div><div class="card-b"><pre class="code"><span class="d">${esc(c.log)}</span></pre>${mini ? '' : `<div class="why">${esc(c.note)}</div>`}<div class="btns"><button class="btn p sm" data-rt="${s.id}">${icon('rot', 12)}Retry</button>${mini ? '' : `<button class="btn sm" data-a="fork">${icon('fork', 12)}Fork from a41c9e2</button><button class="btn sm" data-a="askorbit">${icon('spark', 12)}Ask Theseus to decide</button>`}</div></div></div>`;
  if (c.card === 'plan') return `<div class="card"><div class="card-h">${icon('list', 14)}Plan<span class="k">${c.items.filter(x => x[0] === 1).length}/${c.items.length}</span></div><div class="card-b"><ul class="plan">${c.items.map(([d, t]) => `<li class="${d === 1 ? 'd' : d === 2 ? 'c' : ''}"><span class="bx">${d === 1 ? icon('check', 10) : ''}</span>${esc(t)}</li>`).join('')}</ul></div></div>`;
  if (c.card === 'review') return `<div class="card"><div class="card-h">${icon('eye', 14)}Review findings<span class="k">${c.items.length - S.fixed.size} open</span></div><div class="card-b">${c.items.slice(0, mini ? 2 : 9).map((f, j) => `<div class="finding${S.fixed.has(j) ? ' fixed' : ''}"><span class="sev ${f[0]}">${{ h: 'HIGH', m: 'MED', l: 'LOW' }[f[0]]}</span><span style="min-width:0"><b>${esc(f[1])}</b><small>${esc(f[2])}</small></span>${S.fixed.has(j) ? `<span class="pill run">${icon('check', 11)}Fixed</span>` : `<button class="btn sm" data-fix="${j}">${icon('wand', 12)}Fix</button>`}</div>`).join('')}${mini ? '' : `<div class="btns"><button class="btn p sm" data-fixall="1">${icon('wand', 12)}Have Forge fix all</button><button class="btn sm" data-a="merge">${icon('branch', 12)}Merge anyway</button></div>`}</div></div>`;
  if (c.card === 'sources') return `<div class="card"><div class="card-h">${icon('link', 14)}Sources so far<span class="k">${s.srcN} found</span></div><div class="card-b"><div class="srcs">${SRC.slice(0, mini ? 2 : c.n).map(srcCard).join('')}</div></div></div>`;
  if (c.card === 'table') return mini ? '' : `<div class="card"><div class="card-h">${icon('grid', 14)}Draft comparison<span class="k">updating</span></div><div class="card-b"><table class="cmpt"><tr><th>Framework</th><th>Control</th><th>Setup speed</th><th>Coding tools</th><th>Cites</th></tr>${[['LangGraph', 5, 2, 3, '1'], ['CrewAI', 3, 5, 2, '2'], ['Claude Agent SDK', 4, 4, 5, '3'], ['AutoGen', 4, 2, 3, '4']].map(r => `<tr><td>${r[0]}</td>${[1, 2, 3].map(k => `<td><span class="dotr">${[1, 2, 3, 4, 5].map(n => `<i class="${n <= r[k] ? 'f' : ''}"></i>`).join('')}</span></td>`).join('')}<td><span class="cite">${r[4]}</span></td></tr>`).join('')}</table></div></div>`;
  if (c.card === 'excerpt') return `<div class="excerpt">${esc(c.t)}</div>`;
  if (c.card === 'done') return `<div class="done-note">${icon('check', 14)}${esc(c.t)}</div>`;
  return '';
}
function msg(m, s, i, mini) {
  if (m.sys) return mini ? '' : `<div class="sys">${icon('clock', 11)}${esc(m.sys)}</div>`;
  if (m.mem) return mini ? '' : `<div class="mem">${icon('brain', 12)}Using your preferences: <b>${m.mem.map(esc).join(' · ')}</b></div>`;
  if (m.r === 'you') return `<div class="m-you${m.nw ? ' new-in' : ''}">${m.t}</div>`;
  if (m.card) return mini ? card(m, s, i, 1) : `<div class="m-ag${m.nw ? ' new-in' : ''}"><span></span><div>${card(m, s, i)}</div></div>`;
  const tools = (m.tools || []).map((t, j) => tool(t, s.id, i, j)).join('');
  if (mini) return `<p class="${m.nw ? 'new-in' : ''}">${m.t}</p>${tools ? `<div class="tools">${tools}</div>` : ''}`;
  return `<div class="m-ag${m.nw ? ' new-in' : ''}">${av(s.ag, 24)}<div><div class="who">${AG[s.ag].n}<em>${AG[s.ag].role} · ${AG[s.ag].model}</em></div><p>${m.t}</p>${tools ? `<div class="tools">${tools}</div>` : ''}</div></div>`;
}
const SUG = { c1: ['Approve and keep going', 'Show the full diff', 'Make it 90 days'], r1: ['Add Mastra and Pydantic AI', 'Which fits Theseus best?', 'Stop at 10 sources'], r2: ['Make it shorter', 'More links, less commentary', 'Read it back in my voice'], c3: ['Try widening the type', 'Explain each fix', 'Revert to a41c9e2'], c2: ['Have Forge fix all', 'Explain the DST bug'] };
function convo(s, pane) {
  const th = thread(s), live = ['running', 'thinking'].includes(s.st);
  return `<section class="cv" data-cv="${s.id}">
  <header class="cv-h">${av(s.ag, 30)}<div class="ttl"><b class="trunc">${esc(s.t)}</b><span>${spTag(s)}${esc(PJ[s.pj].n)}${s.br ? ` · <span class="mono">${esc(s.br)}</span>` : ''} · ${AG[s.ag].n}, ${AG[s.ag].role.toLowerCase()}</span></div>
    ${s.mem && pane !== 2 ? `<button class="persona" data-it="context">${icon('brain', 11)}${s.mem} memories</button>` : ''}
    ${s.loop && pane !== 2 ? `<span class="loopc">${icon('ref', 11)}${s.loop[0]}/${s.loop[1]}<span class="bar"><b style="width:${s.loop[0] / s.loop[1] * 100}%"></b></span></span>` : ''}
    <span class="pill ${SP[s.st] || ''}">${sd(s.st)}${SL[s.st]}</span>
    <div class="acts">${live ? `<button class="ib" title="Pause" data-pause="${s.id}">${icon('pause')}</button>` : ''}<button class="ib" title="Fork" data-a="fork">${icon('fork')}</button>${S.view === 'split' ? `<button class="ib" title="Close pane" data-closepane="${pane}">${icon('x')}</button>` : `<button class="ib" title="Open side by side" data-v="split">${icon('cols')}</button>`}<button class="ib" title="More">${icon('more')}</button></div></header>
  <div class="thread" data-th="${s.id}"><div class="tw">${th.map((m, i) => msg(m, s, i)).join('')}${live ? `<div class="think"><span class="dots"><i></i><i></i><i></i></span><span class="shimmer">${s.st === 'thinking' ? 'Thinking' : 'Working'}…</span></div>` : ''}</div></div>
  <div class="cmp">${pane !== 2 && SUG[s.id] ? `<div class="sugs">${SUG[s.id].map(x => `<button data-sug="${s.id}">${icon('spark', 11)}${esc(x)}</button>`).join('')}</div>` : ''}
    <div class="box"><textarea data-in="${s.id}" placeholder="Message ${AG[s.ag].n}…  (@agent · /command · $skill)">${esc(S.drafts[s.id] || '')}</textarea>
    <div class="box-f"><button class="ib" title="Attach">${icon('plus')}</button><button class="ib" title="Mention an agent or file">${icon('at')}</button><button class="ib" title="Commands">${icon('slash')}</button>
    <button class="mchip" title="Save something to memory" data-a="remember">${icon('brain', 12)}Remember</button><span style="flex:1"></span>
    <button class="mchip hide-s" title="Model">${icon('cpu', 12)}${AG[s.ag].model}</button><button class="ib" title="Dictate">${icon('mic')}</button><button class="send" data-send="${s.id}" aria-label="Send">${icon('send', 15)}</button></div></div></div>
  </section>`;
}
function tile(s, noFoot) {
  const all = thread(s), th = all.filter(m => !m.sys && !m.mem).slice(-3), live = ['running', 'thinking'].includes(s.st);
  const cls = { waiting: 'wait', question: 'wait', error: 'err' }[s.st] || '';
  return `<article class="tile ${cls}" data-tile="${s.id}"><header class="tile-h">${av(s.ag, 24)}<div class="ttl"><b class="trunc">${esc(s.t)}</b><span class="trunc">${AG[s.ag].n} · ${esc(PJ[s.pj].n)}</span></div><span class="pill ${SP[s.st] || ''}">${sd(s.st)}${SL[s.st]}</span><button class="ib" title="Open" data-s="${s.id}" data-v="focus">${icon('ext', 13)}</button></header>
  <div class="tile-b">${th.map(m => msg(m, s, all.indexOf(m), 1)).join('')}${live ? `<div class="think" style="padding:0"><span class="dots"><i></i><i></i><i></i></span><span class="shimmer">${s.st === 'thinking' ? 'Thinking' : 'Working'}…</span></div>` : ''}</div>
  <footer class="tile-f"><input data-tin="${s.id}" placeholder="Reply to ${AG[s.ag].n}…"><button class="ib" data-tsend="${s.id}" title="Send">${icon('send', 13)}</button></footer></article>`;
}

/* ── pages ── */
const hour = new Date().getHours(), greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
const QS = [['rocket', 'Ship a feature', 'Forge builds it, Sentinel reviews it, you merge.', ['forge', 'sentinel'], 'code'], ['bug', 'Fix what’s broken', 'Paste an error or point at a red build.', ['forge'], 'code'], ['pr', 'Review my PRs', 'Sentinel checks every open PR across repos.', ['sentinel'], 'code'],
  ['book', 'Deep-dive a topic', 'Scout gathers ~15 primary sources and a comparison.', ['scout', 'quill'], 'research'], ['pen', 'Write a draft', 'Quill writes in your voice from your notes.', ['quill'], 'research'], ['news', 'Weekly AI notes', 'Turn this week’s saved links into #13.', ['scout', 'quill'], 'research']];
function homePage() {
  const needs = SS.filter(s => NEEDY.includes(s.st) && inSpace(s)), live = SS.filter(s => ['running', 'thinking'].includes(s.st) && inSpace(s));
  const nlabel = s => ({ waiting: ['Approve', 'p', `data-ap="${s.id}"`], question: ['Pick', 'p', `data-s="${s.id}"`], error: ['Retry', 'p', `data-rt="${s.id}"`], review: ['Review', '', `data-s="${s.id}"`] })[s.st];
  const ndesc = s => ({ c1: 'wants to run <code>pnpm add recharts@2.12.7</code>', r2: 'needs a headline for #12', c3: 'build failed 3 times on <code>parser.ts:88</code>', c2: 'found 3 issues in PR #47 (1 high)' })[s.id] || esc(s.prev[1]);
  return `<div class="home"><div class="home-w">
  <div class="hello"><h1>${greet}, <span>${ME.n}</span></h1><p><span><b class="a">${needs.length}</b> need you</span><span><b class="g">${live.length}</b> agents working</span><span><b>1</b> routine ran</span><span>Codex resets 4:18 PM</span></p></div>
  <div class="big-cmp"><textarea id="homein" placeholder="What should we work on? Theseus will pick the right crew…">${esc(S.drafts.home || '')}</textarea>
    <div class="box-f"><div class="who-pick">${['orbit', 'forge', 'sentinel', 'scout', 'quill'].map(k => `<button class="${S.homeAg === k ? 'on' : ''}" data-hag="${k}">${av(k, 18)}${AG[k].n}</button>`).join('')}</div><span style="flex:1"></span><button class="mchip">${icon('code', 12)}${S.space === 'research' ? 'Research' : S.space === 'code' ? 'Code' : 'Any space'}</button><button class="ib" title="Dictate">${icon('mic')}</button><button class="send" data-a="homesend" aria-label="Start">${icon('send', 15)}</button></div></div>
  <div><div class="hsec-h">${icon('alert', 12)}Needs you<span class="r"><button data-f="needs">See all</button></span></div>${needs.map(s => { const [l, c, a] = nlabel(s); return `<div class="nrow">${av(s.ag, 26)}<div class="tx"><b>${AG[s.ag].n} ${ndesc(s)}</b><span>${spTag(s)}${esc(PJ[s.pj].n)} · ${s.time}</span></div><button class="btn sm g" data-s="${s.id}">Open</button><button class="btn sm ${c}" ${a}>${l}</button></div>`; }).join('') || '<div class="nrow"><div class="tx"><b>All clear.</b><span>Nothing is waiting on you.</span></div></div>'}</div>
  <div><div class="hsec-h">${icon('zap', 12)}Live now<span class="r"><button data-v="grid">Watch all in grid →</button></span></div><div class="livegrid">${live.map(s => tile(s)).join('')}</div></div>
  <div><div class="hsec-h">${icon('rocket', 12)}Start something</div><div class="qs">${QS.filter(q => S.space === 'all' || q[4] === S.space).map(q => `<button class="qcard" data-qs="${q[1]}"><span class="r1"><span class="ic">${icon(q[0], 14)}</span>${q[1]}</span><p>${q[2]}</p><span class="crew">${q[3].map(k => av(k, 16)).join('')}<span style="margin-left:4px">${q[3].map(k => AG[k].n).join(' + ')}</span></span></button>`).join('')}</div></div>
  </div></div>`;
}
function memoryPage() {
  return `<div class="page"><div class="page-w"><h1>${icon('brain', 20)}What Theseus knows about you</h1><p>Every agent reads these before it starts. Edit anything — changes apply to the next message.</p>
  <div class="memg">${Object.entries(MEM).map(([k, g]) => `<div class="memc"><h3>${icon(g.ic, 14)}${g.t}<span style="margin-left:auto;font-size:11px;color:var(--meta);font-weight:400">${g.xs.length}</span></h3><ul>${g.xs.map((m, j) => `<li class="${m.nw ? 'new' : ''}">${esc(memText(m))}<button class="x" data-mdel="${k}:${j}" title="Forget">${icon('x', 12)}</button></li>`).join('')}</ul><div class="add"><input data-madd="${k}" placeholder="Add a preference…"><button class="btn sm" data-maddb="${k}">${icon('plus', 12)}</button></div></div>`).join('')}</div>
  <div class="memc"><h3>${icon('spark', 14)}Recently learned<span style="margin-left:auto;font-size:11px;color:var(--meta);font-weight:400">from your sessions</span></h3><ul><li class="new">Prefer recharts for charts<span style="color:var(--meta);font-size:11px">· from “Streak chart”, Oct 11</span></li><li>Weekly AI notes ship Friday<span style="color:var(--meta);font-size:11px">· from Quill, Oct 4</span></li></ul></div></div></div>`;
}
function crewPage() {
  return `<div class="page"><div class="page-w"><h1>${icon('users', 20)}Your crew</h1><p>Five agents, each with a role, a model and a personality you set.</p>
  <div class="crewg">${Object.entries(AG).map(([k, a]) => { const cur = SS.find(s => s.ag === k && !['done'].includes(s.st)); return `<div class="crewc"><div class="r1">${av(k, 38)}<span><b>${a.n}</b><small>${a.role}</small></span></div><p>${esc(a.p)}</p><div class="kv"><span>Model</span><span class="mono">${a.model}</span><span>Can</span><span>${k === 'forge' ? 'edit, run, git push (drafts)' : k === 'scout' ? 'web, read, save sources' : k === 'quill' ? 'read, write drafts' : k === 'sentinel' ? 'read, test, comment on PRs' : 'route, plan, spawn'}</span><span>Asks first</span><span>${k === 'forge' ? 'new deps, deletes' : k === 'orbit' ? 'anything irreversible' : 'publishing'}</span></div><div class="now">${cur ? `${sd(cur.st)}<span class="trunc">${esc(cur.t)}</span>` : `${sd('done')}Idle`}</div></div>`; }).join('')}<button class="tile add" style="min-height:220px" data-a="newagent"><span class="big">${icon('plus', 20)}</span><b style="color:var(--fg-2);font-weight:500">Add an agent</b><span style="font-size:12px">Designer, Analyst, Inbox…</span></button></div></div></div>`;
}
function routinesPage() {
  return `<div class="page"><div class="page-w"><h1>${icon('cal', 20)}Routines</h1><p>Work your crew does on a schedule or when something happens.</p>
  <div class="rtable">${ROUTINES.map(([id, ic, n, w, ag, on], j) => `<div class="rtr"><span class="ic" style="color:var(--violet-2)">${icon(ic, 18)}</span><span><b>${n}</b><small>${AG[ag].n} · ${['5 bullets, decisions first', 'From saved links + Scout’s notes', 'Runs on every PR Forge opens', 'Patch + minor only, opens a draft PR'][j]}</small></span><span class="mono" style="color:var(--fg-2)">${w}</span><span style="font-size:12px;color:var(--meta)">${['Ran 8:00 AM ✓', 'Next Thu', 'Ran 3:05 PM ✓', 'Paused'][j]}</span><button class="tog${on ? ' on' : ''}" data-tog="${j}" aria-label="Toggle"></button></div>`).join('')}</div>
  <button class="btn" data-a="newroutine" style="align-self:flex-start">${icon('plus', 13)}New routine</button></div></div>`;
}
function main() {
  const tabs = S.open.map(id => { const s = ss(id); return `<button class="tab${S.page === 'session' && S.sel === id ? ' on' : ''}" data-s="${id}">${sd(s.st)}<span class="trunc">${esc(s.t)}</span><span class="x" data-close="${id}" title="Close tab">${icon('x', 11)}</span></button>`; }).join('');
  const seg = [['focus', 'sq', 'Focus'], ['split', 'cols', 'Split'], ['grid', 'grid', 'Grid']].map(([k, ic, l]) => `<button class="${S.page === 'session' && S.view === k ? 'on' : ''}" data-v="${k}">${icon(ic, 12)}${l}</button>`).join('');
  let body;
  if (S.page === 'home') body = homePage(); else if (S.page === 'memory') body = memoryPage(); else if (S.page === 'crew') body = crewPage(); else if (S.page === 'routines') body = routinesPage(); else if (S.page === 'settings') body = settingsPage();
  else if (S.view === 'grid') { const xs = SS.filter(s => !['done', 'queued'].includes(s.st) && inSpace(s)); body = `<div class="gridv">${xs.map(s => tile(s)).join('')}<button class="tile add" data-a="new"><span class="big">${icon('plus', 20)}</span><b style="color:var(--fg-2);font-weight:500">Start another session</b><span class="chips">${['forge', 'sentinel', 'scout', 'quill'].map(k => `<span class="ch">${AG[k].n}</span>`).join('')}</span></button></div>`; }
  else if (S.view === 'split') { const b = S.split2 && S.split2 !== S.sel ? S.split2 : S.open.find(x => x !== S.sel) || SS.find(x => x.id !== S.sel).id; S.split2 = b; body = `<div class="stage split">${convo(ss(S.sel), 1)}${convo(ss(b), 2)}</div>`; }
  else body = `<div class="stage">${convo(ss(S.sel), 1)}</div>`;
  return `<main class="main"><nav class="tabs"><button class="tab${S.page === 'home' ? ' on' : ''}" data-pg="home" style="max-width:none">${icon('home', 13)}Home</button>${tabs}<button class="addt" data-a="new" title="New session">${icon('plus')}</button><div class="views"><div class="seg" aria-label="Layout">${seg}</div></div></nav>${body}</main>`;
}

/* ── inspector ── */
function inspector() {
  if (S.page !== 'session') return homeInsp();
  const s = ss(S.sel), code = isCode(s);
  const tabsDef = code ? [['changes', 'branch', 'Changes'], ['terminal', 'term', 'Terminal'], ['preview', 'globe', 'Preview'], ['context', 'brain', 'Context']] : [['sources', 'link', 'Sources'], ['outline', 'list', 'Outline'], ['draft', 'pen', 'Draft'], ['context', 'brain', 'Context']];
  if (!tabsDef.some(t => t[0] === S.itab)) S.itab = tabsDef[0][0];
  const tabs = tabsDef.map(([k, ic, l]) => `<button class="${S.itab === k ? 'on' : ''}" data-it="${k}">${icon(ic, 12)}${l}</button>`).join('');
  let b = '';
  if (S.itab === 'changes') {
    const f = FILES[s.id] || FILES.c1, tot = f.reduce((a, x) => [a[0] + x[1], a[1] + x[2]], [0, 0]);
    const pst = s.ci === 'fail' ? ['fail', 'Checks failing'] : s.st === 'review' ? ['open', 'Ready'] : s.st === 'done' ? ['merged', 'Merged'] : ['draft', 'Draft'];
    b = `<div class="prc"><div class="r">${icon('pr', 12)}PR #${s.prn || 49}<span class="st ${pst[0]}">${pst[1]}</span><span style="margin-left:auto" class="mono">${esc(s.br || 'main')} → main</span></div><h3>${esc(s.t)}</h3><div class="r">${av(s.ag, 16)}${AG[s.ag].n} · <span style="color:var(--green)">+${tot[0]}</span> <span style="color:var(--red)">−${tot[1]}</span><span style="margin-left:auto">${s.ci === 'fail' ? '<span style="color:var(--red)">✕ 3/12 checks</span>' : '<span style="color:var(--green)">✓ 12/12 checks</span>'}</span></div><div class="btns"><button class="btn p sm" data-a="review">${icon('eye', 12)}Ask Sentinel to review</button><button class="btn g sm" data-a="ghpr">${icon('ext', 12)}GitHub</button></div></div>
    <div class="subt">${[['changes', `Files ${f.length}`], ['commits', 'Commits 4'], ['checks', 'Checks']].map(([k, l]) => `<button class="${S.sub === k ? 'on' : ''}" data-sub="${k}">${l}</button>`).join('')}</div>`;
    if (S.sub === 'changes') b += `<div class="files">${f.map(([p, a, d, st]) => `<button class="fr" data-fx="${p}"><span class="chev" style="transform:rotate(${S.exp.has(p) ? 90 : 0}deg)">${icon('right', 11)}</span><span class="trunc">${esc(p)}</span><span class="st2 ${st ? 'add' : ''}">${st || 'Modified'}</span><span class="n"><span class="a">+${a}</span> <span class="d">−${d}</span></span></button>${S.exp.has(p) ? `<div class="diff"><div class="h">@@ -1,4 +1,12 @@</div><div>  import { useStreak } from '../hooks/useStreak'</div><div class="a">+ import { LineChart, Line } from 'recharts'</div><div class="a">+ export function StreakChart({ days }: Props) {</div><div class="a">+   const data = days.slice(-30)</div><div class="d">-   return null</div><div class="a">+   return &lt;LineChart data={data}&gt;…&lt;/LineChart&gt;</div><div>  }</div></div>` : ''}`).join('')}</div>`;
    else if (S.sub === 'commits') b += `<div class="agents-mini">${['feat: StreakChart component', 'feat: useStreak returns history', 'chore: chart accent token', 'test: streak history fixtures'].map((c, i) => `<div class="am"><span class="mono" style="color:var(--meta)">${['9f2c1a0', 'b71e3d4', '4c08aa2', 'e15d9b7'][i]}</span><span class="trunc">${c}</span><span class="s">${i * 4 + 2}m</span></div>`).join('')}</div>`;
    else b += `<div class="agents-mini">${['typecheck', 'lint', 'vitest', 'playwright', 'build'].map((c, i) => `<div class="am"><span style="color:${s.ci === 'fail' && i < 2 ? 'var(--red)' : 'var(--green)'}">${s.ci === 'fail' && i < 2 ? '✕' : '✓'}</span>${c}<span class="s">${[14, 9, 41, 88, 32][i]}s</span></div>`).join('')}</div>`;
  } else if (S.itab === 'terminal') {
    b = `<div class="term"><span class="m"># ${esc(PJ[s.pj].n)} · ${esc(s.br || 'main')} · ${AG[s.ag].n}</span>\n<span class="p">$</span> pnpm test streak\n  ✓ useStreak returns history (12ms)\n  ✓ StreakChart renders 30 bars (31ms)\n<span class="m">  42 passed, 1 skipped · 2.4s</span>\n<span class="p">$</span> pnpm build\n${s.id === 'c3' ? '<span class="e">src/parser.ts:88:21 - error TS2345</span>\n<span class="e">exit 2</span>\n' : '  ✓ built in 3.1s\n'}<span class="p">$</span> pnpm add recharts@2.12.7\n<span class="m">  ⏸ waiting for your approval…</span>\n<span class="cur"></span></div>`;
  } else if (S.itab === 'preview') {
    b = `<div class="prev"><div class="url">${icon('globe', 11)}localhost:5173/habits/meditate<span style="margin-left:auto">${icon('ref', 11)}</span></div><div class="pg"><h4>Meditate · 10 min</h4><small>🔥 18-day streak · best 31</small><div class="chart">${[3, 5, 4, 6, 7, 5, 8, 9, 7, 6, 8, 9, 10, 9, 11, 10, 12, 11, 13, 12, 14, 13, 12, 14, 15, 14, 16, 15, 17, 18].map(h => `<i style="height:${h * 5}%"></i>`).join('')}</div><small>Last 30 days</small></div></div><div class="btns"><button class="btn sm">${icon('eye', 12)}Ask Sentinel for screenshots</button></div>`;
  } else if (S.itab === 'sources') {
    const n = s.srcN || 0;
    b = `<div class="sec"><div class="sec-h">${icon('link', 12)}${n} sources<span class="r">${SRC.filter(x => x[2] === 'p').length} primary · ${SRC.filter(x => x[2] === 'o').length} opinion</span></div><div class="agents-mini">${SRC.slice(0, Math.max(3, n)).map((x, i) => `<button class="am" data-a="src"><span class="cite">${i + 1}</span><span class="fav" style="background:${x[3]};width:18px;height:18px;font-size:9px">${x[0][0] === '“' ? x[0][1] : x[0][0]}</span><span class="trunc" style="flex:1">${esc(x[0])}</span><span class="kind ${x[2]}">${{ p: 'primary', s: 'data', o: 'opinion' }[x[2]]}</span><span class="s">${x[4]}×</span></button>`).join('')}</div><div class="memc" style="padding:8px"><div class="add" style="margin:0"><input placeholder="Add a source URL for Scout…"><button class="btn sm">${icon('plus', 12)}</button></div></div></div>`;
  } else if (S.itab === 'outline') {
    const items = s.id === 'r2' ? [['Agents got cheaper, not smarter', 'd', 220], ['Three releases worth your time', 'd', 260], ['The cost-per-loop math', 'd', 190], ['What I’m trying this week', 'd', 170], ['Links', 'w', 100]] : [['The question: what should Theseus run on?', 'd', 120], ['Contenders and how I picked them', 'd', 180], ['Comparison table', 'w', 0], ['The case for one agent', 't', 0], ['My pick and why', 't', 0]];
    b = `<div class="sec"><div class="sec-h">${icon('list', 12)}Outline<span class="r">${items.reduce((a, x) => a + x[2], 0)} words</span></div><ul class="ol">${items.map((x, i) => `<li><span class="n">${i + 1}</span><span class="trunc">${esc(x[0])}</span><span class="s ${x[1]}">${{ d: '✓ drafted', w: '● writing', t: 'to do' }[x[1]]}</span></li>`).join('')}</ul></div>`;
  } else if (S.itab === 'draft') {
    b = s.id === 'r2' ? `<div class="doc"><h2>Agents got cheaper, not smarter</h2><div class="by">Weekly AI notes #12 · draft by Quill · 940 words</div><p>Agents got cheaper this week. Not smarter — cheaper. That matters more than it sounds.</p><h4>Three releases worth your time</h4><p>Two model updates cut per-token prices by roughly a third.<sup>[1]</sup> One framework added built-in memory.<sup>[2]</sup></p><h4>The cost-per-loop math</h4><p class="wip">A 20-step coding loop now costs about what a 12-step loop did in July…</p></div>` : `<div class="doc"><h2>What should Theseus run on?</h2><div class="by">Research notes · Scout · updating live</div><p>I want one place where my agents code and research for me, with memory of how I work. The framework decides how much of that I build myself.</p><h4>Contenders</h4><p>LangGraph gives the most control over state<sup>[1]</sup>. CrewAI gets a crew running fastest<sup>[2]</sup>. The Claude Agent SDK ships the best tools for coding work<sup>[3]</sup>.</p><p class="wip">Comparison table in progress…</p></div>`;
  } else {
    const ms = [...MEM.code.xs.slice(0, code ? 4 : 0), ...(code ? [] : [...MEM.research.xs.slice(0, 3), ...(s.ag === 'quill' ? MEM.voice.xs.slice(0, 3) : [])])].map(memText);
    b = `<div class="sec"><div class="sec-h">${icon('brain', 12)}Memories in use<span class="r"><button data-pg="memory" style="color:var(--violet-2)">Edit all</button></span></div><div class="ctxmem">${ms.map(m => `<div>${icon('brain', 12)}${esc(m)}</div>`).join('')}</div></div>
    <div class="sec"><div class="sec-h">${icon('file', 12)}In context<span class="r">${code ? '41k' : '58k'} / 200k tokens</span></div><div class="tokbar"><i style="width:9%;background:var(--violet)"></i><i style="width:8%;background:var(--teal)"></i><i style="width:4%;background:var(--pink)"></i></div><div class="aff">${(code ? ['HabitDetail.tsx', 'tokens.css', 'useStreak.ts', 'AGENTS.md'] : ['6 sources', 'notes/saved-links.md', 'orbit-goals.md']).map(x => `<span>${icon('file', 11)}${x}</span>`).join('')}</div></div>
    <div class="sec"><div class="sec-h">${icon('spark', 12)}Skills</div><div class="aff">${(code ? ['react-best-practices', 'vitest', 'git-hygiene'] : ['cite-sources', 'alex-voice', 'comparison-table']).map(x => `<span>${icon('spark', 11)}${x}</span>`).join('')}</div></div>`;
  }
  return `<aside class="insp"><nav class="itabs">${tabs}<span class="sp"></span><button class="ib" data-a="hideinsp" title="Hide panel">${icon('right', 13)}</button></nav><div class="ibody">${b}</div></aside>`;
}
function homeInsp() {
  return `<aside class="insp"><nav class="itabs"><button class="on">${icon('users', 12)}Crew</button><button data-pg="memory">${icon('brain', 12)}Memory</button><button data-pg="routines">${icon('cal', 12)}Routines</button></nav><div class="ibody">
  <div class="sec"><div class="sec-h">${icon('users', 12)}Your crew<span class="r"><button data-pg="crew" style="color:var(--muted)">Manage</button></span></div><div class="agents-mini">${Object.keys(AG).map(k => { const cur = SS.find(s => s.ag === k && !['done', 'queued'].includes(s.st)); return `<button class="am" ${cur ? `data-s="${cur.id}"` : 'data-pg="crew"'}>${av(k, 22)}<span style="min-width:0;flex:1"><span style="display:block;font-weight:500">${AG[k].n}</span><span class="trunc" style="display:block;font-size:11px;color:var(--meta)">${cur ? esc(cur.t) : 'Idle'}</span></span>${cur ? sd(cur.st) : sd('done')}</button>`; }).join('')}</div></div>
  <div class="sec"><div class="sec-h">${icon('sun', 12)}Morning brief<span class="r">8:00 AM</span></div><div class="why" style="font-size:12.5px;line-height:1.6;background:var(--bg-2);padding:10px 12px;border-radius:8px">Forge is one approval away on the streak chart. Sentinel flagged a DST bug in PR #47. cli-tools has been red since 11pm. Heavy builds after 4:18 PM.<br><button class="btn sm g" data-s="o1" style="margin-top:6px;padding:0">${icon('ext', 12)}Open brief</button></div></div>
  <div class="sec"><div class="sec-h">${icon('brain', 12)}Learned this week</div><div class="ctxmem"><div>${icon('brain', 12)}Prefer recharts for charts<span style="margin-left:auto;font-size:10.5px;color:var(--violet-2)">new</span></div><div>${icon('brain', 12)}Weekly AI notes ship Friday</div></div></div>
  <div class="sec"><div class="sec-h">${icon('zap', 12)}Usage</div>${[['Claude · 5-hour', 68, 'resets in 1h 42m'], ['Codex · 5-hour', 82, 'resets 4:18 PM', 1]].map(([n, p, sub, hot]) => `<div class="um${hot ? ' hot' : ''}"><div class="r"><span>${n}</span><span>${p}%</span></div><div class="bar"><b style="width:${p}%"></b></div><small>${sub}</small></div>`).join('')}</div>
  </div></aside>`;
}
function titlebar() {
  const c = sp => SS.filter(s => sp === 'all' || space(s) === sp).filter(s => NEEDY.includes(s.st)).length;
  return `<header class="tbar"><div class="lights"><i></i><i></i><i></i></div><span class="brand"><img src="assets/brand/lockup-horizontal-dark.svg" alt="theseus.ai" width="105" height="24"></span>
  <div class="spaces">${[['all', 'layers', 'All'], ['code', 'code', 'Code'], ['research', 'book', 'Research']].map(([k, ic, l]) => `<button class="${S.space === k ? 'on' : ''}" data-sp="${k}">${icon(ic, 12)}${l}<span class="c">${c(k)}</span></button>`).join('')}</div>
  <button class="kbar" data-a="cmdk" style="width:380px">${icon('search', 13)}Ask Theseus, search, or run a command…<kbd>⌘K</kbd></button>
  <div class="tright"><span class="slots" title="3 of ${SET.slots} agent slots in use"><i></i><i></i><i class="w"></i>${'<i class="e"></i>'.repeat(SET.slots - 3)}&nbsp;3/${SET.slots}</span><button class="ib" title="Notifications">${icon('bell')}<span class="dot"></span></button><span class="me"><span>${ME.n}</span><span class="pic">${ME.i}</span></span></div></header>`;
}
function rail() {
  const needs = SS.filter(s => NEEDY.includes(s.st)).length;
  const it = (ic, tip, on, pg, b) => `<button class="ri${on ? ' on' : ''}" ${pg} aria-label="${tip}">${icon(ic, 17)}${b ? `<span class="bdg">${b}</span>` : ''}<span class="tip">${tip}</span></button>`;
  return `<nav class="rail"><div class="logo"><img src="assets/brand/mark-color-dark.svg" alt="Theseus" width="34" height="34"></div>${it('home', 'Home', S.page === 'home', 'data-pg="home"', needs)}${it('msg', 'Sessions', S.page === 'session', `data-s="${S.sel || 'c1'}"`)}${it('users', 'Crew', S.page === 'crew', 'data-pg="crew"')}${it('brain', 'Memory', S.page === 'memory', 'data-pg="memory"')}${it('cal', 'Routines', S.page === 'routines', 'data-pg="routines"')}<span class="sep"></span>${it('file', 'Library', 0, 'data-a="library"')}${it('globe', 'Browser', 0, 'data-a="browser"')}<span class="gap"></span>${it('term', 'Terminal', 0, 'data-a="term"')}${it('settings', 'Settings', S.page === 'settings', 'data-pg="settings"')}</nav>`;
}
function statusbar() {
  const s = S.page === 'session' ? ss(S.sel) : null, run = SS.filter(x => ['running', 'thinking'].includes(x.st)).length;
  return `<footer class="sbar"><span class="g">● Local</span>${s ? `<span>${icon('folder', 11)}${esc(PJ[s.pj].n)}</span>${s.br ? `<span>${icon('branch', 11)}${esc(s.br)}</span>` : ''}<span>${icon('cpu', 11)}${AG[s.ag].model}</span>` : `<span>${icon('brain', 11)}${Object.values(MEM).reduce((a, g) => a + g.xs.length, 0)} memories</span>`}<span class="r">${run} working · ${SS.filter(x => x.st === 'queued').length} queued · next routine Thu 14:00</span></footer>`;
}

/* ── render ── */
const app = $('#app');
function render() {
  const a = document.activeElement, key = a && (a.dataset.in || a.dataset.tin || a.dataset.madd || a.id), pos = a && a.selectionStart;
  const scrolls = {}; $$('.thread').forEach(t => scrolls[t.dataset.th] = [t.scrollTop, t.scrollHeight - t.scrollTop - t.clientHeight < 40]);
  const keep = ['.gridv', '.slist', '.home', '.page'].map(q => [q, $(q) && $(q).scrollTop]);
  app.classList.toggle('no-insp', (S.page === 'session' && S.view !== 'focus') || ['memory', 'crew', 'routines', 'settings'].includes(S.page) || !!S.noInsp);
  app.innerHTML = titlebar() + `<div class="body">${rail()}${sidebar()}${main()}${inspector()}</div>` + statusbar() + (S.page === 'settings' ? settingsDialog() : '') + `<div class="toast"></div>`;
  if ($('.dlg')) $('.dlg [data-sno]').focus();
  $$('.thread').forEach(t => { const p = scrolls[t.dataset.th]; t.style.scrollBehavior = 'auto'; t.scrollTop = !p || p[1] ? t.scrollHeight : p[0]; t.style.scrollBehavior = ''; });
  keep.forEach(([q, v]) => { if (v != null && $(q)) $(q).scrollTop = v; });
  if (key) { const el = $(`[data-in="${key}"]`) || $(`[data-tin="${key}"]`) || $(`[data-madd="${key}"]`) || document.getElementById(key); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {} } }
}
let tt; const toast = m => { const t = $('.toast'); t.innerHTML = icon('check') + esc(m); t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2200); };
function select(id) { S.page = 'session'; S.sel = id; if (!S.open.includes(id)) { S.open.push(id); if (S.open.length > 4) S.open.splice(S.open.findIndex(x => x !== id), 1); } if (S.view === 'split' && S.split2 === id) S.split2 = S.open.find(x => x !== id); }
function push(id, m) { m.nw = 1; thread(ss(id)).push(m); setTimeout(() => { m.nw = 0; }, 400); }
function resolve(id, kind) {
  const s = ss(id), th = thread(s), ix = th.findIndex(m => m.card === 'approval' || m.card === 'error');
  if (ix < 0) return;
  if (kind === 'deny') { th.splice(ix, 1); push(id, { r: 'you', t: 'No. Find another way.' }); s.st = 'thinking'; s.prev = ['THINK', 'looking for an alternative']; toast('Denied — Forge will find another way'); }
  else if (kind === 'retry') { th.splice(ix, 1); push(id, { r: 'you', t: 'Retry from the last good commit.' }); s.st = 'running'; s.ci = null; s.prev = ['BASH', 'pnpm build · attempt 4']; push(id, { r: 'ag', t: 'Checking out a41c9e2 and re-applying the tokenizer split.', tools: [{ tag: 'GIT', title: 'checkout a41c9e2', meta: '0.2s' }, { tag: 'BASH', title: 'pnpm build', meta: 'running…', run: 1 }] }); toast('Retrying build'); }
  else {
    const c = th[ix]; th.splice(ix, 1, { r: 'ag', t: `Approved. Running it now.`, tools: [{ tag: 'BASH', title: c.cmd, meta: 'running…', run: 1 }] });
    if (kind === 'always') { MEM.code.xs.push({ t: 'Always allow: pnpm add (patch/minor)', nw: 1 }); th.splice(ix + 1, 0, { mem: ['saved: always allow pnpm add'] }); }
    s.st = 'running'; s.prev = ['BASH', c.cmd]; toast(kind === 'always' ? 'Approved · saved to your memory' : 'Approved'); setTimeout(() => finish(id), 2400);
  }
  render();
}
function finish(id) {
  const s = ss(id), th = thread(s); th.forEach(m => (m.tools || []).forEach(t => { if (t.run) { t.run = 0; t.meta = 'done · 2.1s'; } }));
  const pl = th.find(m => m.card === 'plan'); if (pl) { pl.items[3][0] = 1; pl.items[4][0] = 2; }
  if (s.loop) s.loop[0]++;
  push(id, { r: 'ag', t: 'recharts installed. Wiring the chart under the header, then I’ll hand it to Sentinel.', tools: [{ tag: 'EDIT', title: 'src/screens/HabitDetail.tsx', meta: '+9 −0', out: '<span class="a">+ &lt;StreakChart days={streak.history} /&gt;</span>' }] });
  s.prev = ['EDIT', 'src/screens/HabitDetail.tsx']; render();
}
function reply(s, text) {
  const r = { forge: `On it — I’ll fold “${text.slice(0, 50)}” into the current step and keep the PR as a draft.`, sentinel: `Noted. I’ll re-check that and add a test for it.`, scout: `Good call. Adding that to the search — I’ll flag anything that’s opinion.`, quill: `Got it. Rewriting in your voice: shorter, takeaway first.`, orbit: `Understood. I’ll route that to the right agent and tell you when it needs you.` }[s.ag];
  return { r: 'ag', t: esc(r), tools: [{ tag: 'MEM', title: 'checked your preferences', meta: '3 used' }] };
}
function send(id, text) {
  if (!text.trim()) return; const s = ss(id); push(id, { r: 'you', t: esc(text) }); S.drafts[id] = ''; const was = s.st;
  if (!NEEDY.includes(was)) { s.st = 'thinking'; s.prev = ['THINK', text]; }
  render(); setTimeout(() => { push(id, reply(s, text)); if (!NEEDY.includes(was)) { s.st = 'running'; s.prev = ['THINK', 'updating plan']; } render(); }, 1300);
}
function startNew(ag, title, text) {
  const id = 'n' + Date.now(), pj = ['scout', 'quill'].includes(ag) ? 'agents' : 'habit';
  SS.unshift({ id, ag, pj, t: title, st: 'thinking', time: 'now', mem: 3, prev: ['THINK', 'planning'] });
  T[id] = [{ sys: `New session · ${PJ[pj].n}` }, ...(text ? [{ r: 'you', t: esc(text) }] : []), { mem: ag === 'scout' ? ['primary sources first', 'cite inline'] : ag === 'quill' ? ['short sentences', 'lead with takeaway'] : ['TypeScript strict', 'pnpm', 'draft PRs'] }];
  select(id); S.view = 'focus'; render();
  setTimeout(() => { const s = ss(id); push(id, { r: 'ag', t: ag === 'orbit' ? `I’ll split this: Scout researches, Quill drafts, Forge builds anything code-shaped. Starting with a plan.` : `Starting with a short plan. I’ll check in before anything risky.`, tools: [{ tag: 'THINK', title: 'plan', meta: '4 steps' }] }); s.st = 'running'; s.prev = ['THINK', 'plan · 4 steps']; render(); }, 1200);
}

/* ── events ── */
app.addEventListener('click', e => {
  const t = e.target.closest('[data-close], button, [data-s], [data-tile]'); if (!t) { $('.menu') && $('.menu').remove(); return; }
  const d = t.dataset;
  if (setClick(t, d)) return;
  if (d.close) { e.stopPropagation(); S.open = S.open.filter(x => x !== d.close); if (S.sel === d.close) { S.page = 'home'; S.sel = null; } return render(); }
  if (d.ap) return resolve(d.ap, 'ok'); if (d.al) return resolve(d.al, 'always'); if (d.dn) return resolve(d.dn, 'deny'); if (d.rt) return resolve(d.rt, 'retry');
  if (d.op) { const [id, i, j] = d.op.split(':'), s = ss(id), c = thread(s)[i]; if (c.pick != null) return; c.pick = +j; push(id, { r: 'you', t: esc(c.opts[j][0]) }); s.st = 'running'; s.prev = ['WRITE', 'finishing the Links section']; render(); setTimeout(() => { push(id, { r: 'ag', t: `“${esc(c.opts[j][0])}” it is. Finishing the Links section, then it’s ready for Friday.`, tools: [{ tag: 'WRITE', title: 'drafts/ai-notes-12.md', meta: '+180 words' }] }); s.words += 180; render(); }, 1200); return; }
  if (d.fix || d.fixall) { const s = ss('c2'); if (d.fixall) [0, 1, 2].forEach(j => S.fixed.add(j)); else S.fixed.add(+d.fix); if (S.fixed.size === 3) { s.st = 'done'; s.prev = ['GIT', 'all findings fixed by Forge']; } toast(d.fixall ? 'Forge is fixing all 3 findings' : 'Sent to Forge'); return render(); }
  if (d.tl) { S.tlo.has(d.tl) ? S.tlo.delete(d.tl) : S.tlo.add(d.tl); return render(); }
  if (d.fx) { S.exp.has(d.fx) ? S.exp.delete(d.fx) : S.exp.add(d.fx); return render(); }
  if (d.it) { S.itab = d.it; S.noInsp = false; S.view = 'focus'; return render(); }
  if (d.sub) { S.sub = d.sub; return render(); }
  if (d.pg) { S.page = d.pg; return render(); }
  if (d.sp) { S.space = d.sp; return render(); }
  if (d.hag) { S.homeAg = d.hag; return render(); }
  if (d.tog) { const r = ROUTINES[+d.tog]; r[5] = r[5] ? 0 : 1; toast(r[5] ? `${r[2]} on` : `${r[2]} paused`); return render(); }
  if (d.mdel) { const [k, j] = d.mdel.split(':'); const gone = memText(MEM[k].xs.splice(+j, 1)[0]); toast(`Forgot: ${gone}`); return render(); }
  if (d.maddb) { const ip = $(`[data-madd="${d.maddb}"]`); if (ip.value.trim()) { MEM[d.maddb].xs.push({ t: ip.value.trim(), nw: 1 }); toast('Saved to memory'); render(); } return; }
  if (d.qs) { const q = QS.find(x => x[1] === d.qs); return startNew(q[3][0], q[1]); }
  if (d.v) { if (d.s) select(d.s); else if (S.page !== 'session') select(S.sel || S.open[0] || 'c1'); S.view = d.v; return render(); }
  if (d.f === 'needs') { const n = SS.find(s => NEEDY.includes(s.st)); if (n) { select(n.id); render(); } return; }
  if (d.sug) return send(d.sug, t.textContent.trim());
  if (d.send) return send(d.send, $(`[data-in="${d.send}"]`).value);
  if (d.tsend) return send(d.tsend, $(`[data-tin="${d.tsend}"]`).value);
  if (d.pause) { const s = ss(d.pause); s.st = 'queued'; s.prev = ['', 'paused by you']; toast('Paused · slot freed'); return render(); }
  if (d.closepane) { S.view = 'focus'; if (d.closepane === '1') select(S.split2); return render(); }
  if (d.s) { select(d.s); return render(); }
  if (d.tile && !e.target.closest('input')) { select(d.tile); S.view = 'focus'; return render(); }
  const a = d.a;
  if (a === 'homesend') { const v = $('#homein').value.trim(); if (!v) { $('#homein').focus(); return; } S.drafts.home = ''; return startNew(S.homeAg, v.length > 42 ? v.slice(0, 40) + '…' : v, v); }
  if (a === 'hideinsp') { S.noInsp = true; return render(); }
  if (a === 'new') { const r = t.getBoundingClientRect(), ar = app.getBoundingClientRect(); $('.menu') && $('.menu').remove(); const m = document.createElement('div'); m.className = 'menu'; m.style.left = Math.min(r.left - ar.left, 1440 - 250) + 'px'; m.style.top = r.bottom - ar.top + 6 + 'px'; m.innerHTML = `<div class="lbl">Talk to</div>${Object.keys(AG).map(k => `<button data-ns="${k}">${av(k, 18)}${AG[k].n}<small>${AG[k].role}</small></button>`).join('')}<div class="lbl">Templates</div>${QS.slice(0, 4).map(q => `<button data-qs="${q[1]}">${icon(q[0], 14)}${q[1]}</button>`).join('')}`; app.appendChild(m); e.stopPropagation(); return; }
  if (d.ns) { $('.menu') && $('.menu').remove(); return startNew(d.ns, `New session with ${AG[d.ns].n}`); }
  if (a === 'remember') { toast('Type what to remember, then send — it goes to Memory'); return; }
  const msgs = { fork: 'Forked into a new session', review: 'Sentinel will review when Forge pushes', ghpr: 'Opening on GitHub', merge: 'Merge blocked: 1 high finding open', edit: 'Edit the command, then approve', archived: '41 older sessions', cmdk: 'Command palette', src: 'Opens the source in the browser pane', askorbit: 'Theseus suggests widening the type in a separate PR', library: 'Library: reports, drafts, sources', browser: 'Browser pane', term: 'Terminal', settings: 'Settings', newagent: 'New agent: pick a role and a model', newroutine: 'New routine: when + who + what', kid: '' };
  if (msgs[a]) toast(msgs[a]);
});
app.addEventListener('input', e => { const d = e.target.dataset; if (d.in) S.drafts[d.in] = e.target.value; if (e.target.id === 'homein') S.drafts.home = e.target.value; if (e.target.id === 'sq') { S.q = e.target.value; render(); } });
app.addEventListener('keydown', e => {
  const d = e.target.dataset;
  if (e.key === 'Enter' && !e.shiftKey && d.in) { e.preventDefault(); send(d.in, e.target.value); }
  if (e.key === 'Enter' && d.tin) { e.preventDefault(); send(d.tin, e.target.value); }
  if (e.key === 'Enter' && d.madd) { e.preventDefault(); $(`[data-maddb="${d.madd}"]`).click(); }
  if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'homein') { e.preventDefault(); $('[data-a="homesend"]').click(); }
});
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && S.page === 'session' && ss(S.sel).st === 'waiting') { e.preventDefault(); resolve(S.sel, 'ok'); }
  if ((e.metaKey || e.ctrlKey) && ['1', '2', '3'].includes(e.key)) { e.preventDefault(); if (S.page !== 'session') select(S.sel || 'c1'); S.view = ['focus', 'split', 'grid'][+e.key - 1]; render(); }
  if ((e.metaKey || e.ctrlKey) && e.key === '0') { e.preventDefault(); S.page = 'home'; render(); }
});

/* ── settings ── */
Object.assign(I, {
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M10 13h4M7 16h10"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
});
const KEYS0 = { cmdk: '⌘K', new: '⌘N', home: '⌘0', focus: '⌘1', split: '⌘2', grid: '⌘3', approve: '⌘↵', next: 'J / K', ad: 'A / D', search: '/' };
const SET = {
  sec: 'general', q: '', confirm: null, rebind: null, upd: 'idle',
  start: 'home', login: 1, menubar: 1, dspace: 'all', dview: 'focus', dag: 'orbit', density: 'comfortable', toolsCollapsed: 1,
  slots: 4, nearFull: 'queue', holdBuilds: 1,
  ask: { shell: 'wt', install: 'ask', push: 'wt', send: 'ask', del: 'ask', spawn: 'ask' },
  allow: ['pnpm test', 'pnpm lint', 'git status', 'git diff', 'vitest run'],
  steplimit: '30m', net: 'list', wtClean: 1,
  nNeeds: 1, nFail: 1, nDone: 0, nRoutine: 1, deliver: 'banner', deepOn: 1, deep: 'blockers', brief: '8:00',
  learn: 1, askMem: 0, keep: '90', crash: 0,
  ints: { github: 1, browser: 1, fs: 1, linear: 0, slack: 0 },
  channel: 'stable', keys: { ...KEYS0 },
};
const SECS = [
  ['general', 'settings', 'General', 'Startup, defaults and how Theseus looks.'],
  ['models', 'cpu', 'Models & usage', 'Your Claude and Codex subscriptions, the model each agent runs on, and how many agents run at once.'],
  ['safety', 'shield', 'Approvals & safety', 'What the crew can do on its own, and what waits for you.'],
  ['spaces', 'folder', 'Spaces & folders', 'Where your projects live on disk.'],
  ['notify', 'bell', 'Notifications & focus', 'When Theseus interrupts you, and when it stays quiet.'],
  ['memory', 'brain', 'Memory & privacy', 'What Theseus learns about you and how long it keeps it.'],
  ['ints', 'link', 'Integrations', 'Accounts and tools the crew can use.'],
  ['keys', 'keyboard', 'Keyboard', 'Shortcuts for the things you do most.'],
  ['about', 'help', 'About', 'Version, updates and logs.'],
];
const gv = p => p.split('.').reduce((o, k) => o[k], SET);
const sv = (p, v) => { const ks = p.split('.'), last = ks.pop(); ks.reduce((o, k) => o[k], SET)[last] = v; };
const sTog = (p, l) => `<button class="tog${gv(p) ? ' on' : ''}" role="switch" aria-checked="${!!gv(p)}" aria-label="${esc(l)}" data-stog="${p}"></button>`;
const sSeg = (p, opts, l) => `<div class="seg" role="radiogroup" aria-label="${esc(l)}">${opts.map(([v, t]) => `<button role="radio" aria-checked="${gv(p) === v}" class="${gv(p) === v ? 'on' : ''}" data-sseg="${p}|${v}">${t}</button>`).join('')}</div>`;
const sSel = (p, opts, l, cur, attr) => `<span class="ssel"><select ${attr || `data-ssel="${p}"`} aria-label="${esc(l)}">${opts.map(([v, t]) => `<option value="${v}"${(cur != null ? cur : gv(p)) === v ? ' selected' : ''}>${t}</option>`).join('')}</select>${icon('down', 12)}</span>`;
const sPath = (p, reveal) => `<span class="spath mono" title="${esc(p)}">${esc(p)}</span>${reveal ? `<button class="btn sm g" data-sa="reveal" data-p="${esc(p)}">Reveal</button>` : ''}`;
const R = (l, h, c, o) => Object.assign({ l, h, c }, o || {});
const ASK3 = [['ask', 'Always ask'], ['wt', 'In worktree'], ['allow', 'Never ask']], ASK2 = [['ask', 'Always ask'], ['allow', 'Never ask']];
const INTS = [['github', 'GitHub', 'pr', 'Forge opens draft PRs. Sentinel comments on reviews.'], ['browser', 'Browser pane', 'globe', 'The built-in browser Scout reads sources in.'], ['fs', 'Filesystem · MCP', 'folder', 'Local server for ~/Code and ~/Research.'], ['linear', 'Linear · MCP', 'list', 'Let agents read and update your issues.'], ['slack', 'Slack · MCP', 'msg', 'Quill drafts replies. Sending always asks.']];
const KEYROWS = [['Navigation', [['cmdk', 'Ask Theseus or run a command'], ['new', 'New session'], ['home', 'Go to Home'], ['search', 'Search settings']]], ['Layout', [['focus', 'Focus layout'], ['split', 'Split layout'], ['grid', 'Grid layout']]], ['Approvals', [['approve', 'Approve the waiting request'], ['next', 'Next / previous item'], ['ad', 'Approve / deny selected']]]];
const memCount = () => Object.values(MEM).reduce((a, g) => a + g.xs.length, 0);

function secRows(id) {
  const running = SS.filter(x => ['running', 'thinking'].includes(x.st)).length;
  if (id === 'general') return [
    ['Startup', [
      R('Open to', 'What you see when Theseus launches.', sSeg('start', [['home', 'Home'], ['last', 'Last session']], 'Open to')),
      R('Launch at login', 'Routines only run while Theseus is open.', sTog('login', 'Launch at login')),
      R('Show in menu bar', 'Needs-you count and a quick Ask box.', sTog('menubar', 'Show in menu bar')),
    ]],
    ['Defaults', [
      R('Default space', 'Which sessions the sidebar shows first.', sSeg('dspace', [['all', 'All'], ['code', 'Code'], ['research', 'Research']], 'Default space')),
      R('Session layout', 'For new windows. ⌘1–3 switches any time.', sSeg('dview', [['focus', 'Focus'], ['split', 'Split'], ['grid', 'Grid']], 'Session layout')),
      R('New sessions start with', 'Theseus routes the work unless you pick an agent.', sSel('dag', [['orbit', 'Theseus decides'], ...['forge', 'sentinel', 'scout', 'quill'].map(k => [k, AG[k].n])], 'New sessions start with')),
    ]],
    ['Appearance', [
      R('Density', 'Compact fits about a third more rows in lists.', sSeg('density', [['comfortable', 'Comfortable'], ['compact', 'Compact']], 'Density')),
      R('Collapse tool cards', 'Show WEB, EDIT and BASH steps as one line until you open them.', sTog('toolsCollapsed', 'Collapse tool cards')),
    ]],
  ];
  if (id === 'models') return [
    ['Subscriptions', [
      R('Claude', 'Max plan · signed in', `<span class="meter" title="62% of the 5-hour window used"><span class="bar"><b style="width:62%"></b></span>62% · resets 3:40 PM</span><button class="btn sm" data-sa="manage" data-p="Claude">Manage</button>`, { lead: `<span class="slead acc">C</span>`, kw: 'account usage window anthropic' }),
      R('Codex', 'Pro plan · signed in', `<span class="meter hot" title="88% of the weekly window used"><span class="bar"><b style="width:88%"></b></span>88% · resets Thu 9:00</span><button class="btn sm" data-sa="manage" data-p="Codex">Manage</button>`, { lead: `<span class="slead acc">X</span>`, kw: 'account usage window openai' }),
    ]],
    ['Crew models', ['orbit', 'forge', 'sentinel', 'scout', 'quill'].map(k => R(AG[k].n, AG[k].role, sSel('', [['claude · opus', 'claude · opus'], ['claude · sonnet', 'claude · sonnet'], ['claude · haiku', 'claude · haiku'], ['codex · gpt-5', 'codex · gpt-5'], ['codex · gpt-5-mini', 'codex · gpt-5-mini']], `${AG[k].n} model`, AG[k].model, `data-smodel="${k}"`), { lead: av(k, 26), kw: 'model runtime' }))],
    ['Capacity', [
      R('Agent slots', `${running} in use now. Extra sessions wait in the queue.`, `<div class="stepper" role="group" aria-label="Agent slots"><button data-sstep="-1" aria-label="Fewer slots"${SET.slots <= 3 ? ' disabled' : ''}>${icon('minus', 12)}</button><output aria-live="polite">${SET.slots}</output><button data-sstep="1" aria-label="More slots"${SET.slots >= 8 ? ' disabled' : ''}>${icon('plus', 12)}</button></div>`, { kw: 'concurrency parallel' }),
      R('When a window is nearly full', 'Kicks in at 90% of a usage window.', sSeg('nearFull', [['queue', 'Queue work'], ['switch', 'Use other runtime'], ['ask', 'Ask me']], 'When a window is nearly full'), { kw: 'rate limit usage' }),
      R('Hold heavy builds for the Codex reset', 'From your memory: “Heavy builds after the Codex reset”.', sTog('holdBuilds', 'Hold heavy builds for the Codex reset')),
    ]],
  ];
  if (id === 'safety') {
    const act = (k, tag, l, h, opts) => { const risky = gv(`ask.${k}`) === 'allow' && ['send', 'del'].includes(k); return R(l, risky ? 'Theseus won’t ask before doing this.' : h, sSeg(`ask.${k}`, opts, l), { lead: `<span class="stag${['BASH', 'SPAWN'].includes(tag) ? ' risk' : ''}">${tag}</span>`, cls: risky ? 'warn' : '', kw: 'approval permission ask first' }); };
    return [
      ['Ask first', [
        act('shell', 'BASH', 'Run shell commands', 'In a worktree, Forge runs builds and tests without asking.', ASK3),
        act('install', 'BASH', 'Install packages', 'Also asks when a lockfile changes.', ASK3),
        act('push', 'GIT', 'Push to GitHub', 'Draft PRs only. Merging always asks.', ASK3),
        act('send', 'SEND', 'Send email or messages', 'Anything that leaves your machine as you.', ASK2),
        act('del', 'EDIT', 'Delete files', 'Deleted files go to the Trash first.', ASK3),
        act('spawn', 'SPAWN', 'Start other agents', 'Theseus can split work across the crew.', ASK2),
      ]],
      ['Always allowed', [
        R('Commands', 'Run without asking, in any project. Added when you pick “Always allow” on an approval.', '', { cls: 'col', kw: 'allowlist always allow', below: `<div class="allow">${SET.allow.map((c, i) => `<span class="achip"><span class="mono">${esc(c)}</span><button data-sdel="${i}" aria-label="Remove ${esc(c)}" title="Remove">${icon('x', 11)}</button></span>`).join('') || '<span class="sh">Nothing yet. Every command asks first.</span>'}</div><div class="aadd"><input id="saddin" class="stext mono" placeholder="pnpm build" aria-label="Command to always allow"><button class="btn sm" data-saddb="1">${icon('plus', 12)}Add</button></div>` }),
      ]],
      ['Limits', [
        R('Max time per step', 'Longer steps pause and ask to keep going.', sSel('steplimit', [['10m', '10 minutes'], ['30m', '30 minutes'], ['1h', '1 hour'], ['none', 'No limit']], 'Max time per step')),
        R('Network for code agents', 'Research agents always have web access.', sSeg('net', [['off', 'Off'], ['list', 'Allowlist'], ['on', 'On']], 'Network for code agents')),
        ...(SET.net === 'list' ? [R('Allowed domains', 'github.com, npmjs.com, registry.npmjs.org, vitest.dev', `<button class="btn sm" data-sa="domains">Edit</button>`, { kw: 'network web' })] : []),
        R('Per-agent rules', 'Override any of these for one agent.', `<button class="btn sm" data-pg="crew">Edit in Crew${icon('right', 12)}</button>`),
        R('Pause everything', 'Stops every running agent and frees all slots.', `<button class="btn sm" data-sa="pauseall">${icon('pause', 12)}Pause all</button>`, { kw: 'stop kill' }),
      ]],
    ];
  }
  if (id === 'spaces') {
    const sp = (k, root) => { const ps = Object.values(PJ).filter(p => p.sp === k); return [
      R('Folder', 'New projects in this folder join the space.', sPath(root, 1) + `<button class="btn sm" data-sa="change">Change…</button>`, { kw: 'path directory' }),
      R('Projects', `${ps.length} found`, `<span class="pchips">${ps.map(p => `<span class="pchip">${esc(p.n)}</span>`).join('')}</span>`),
    ]; };
    return [
      ['Code', sp('code', '~/Code')],
      ['Research', sp('research', '~/Research')],
      ['Worktrees', [
        R('Location', 'Each code session gets its own git worktree.', sPath('~/.orbit/worktrees', 1), { kw: 'git branch' }),
        R('Remove merged worktrees', 'A day after the PR merges.', sTog('wtClean', 'Remove merged worktrees')),
        R('Add a space', 'For example Writing or Finance.', `<button class="btn sm" data-sa="addspace">${icon('plus', 12)}Add space</button>`),
      ]],
    ];
  }
  if (id === 'notify') return [
    ['Notify me when', [
      R('Something needs me', 'Approvals and questions. The badge always shows.', sTog('nNeeds', 'Something needs me')),
      R('A run fails', 'Includes red CI on a PR Forge opened.', sTog('nFail', 'A run fails')),
      R('A session finishes', 'When off, finished work just lands in Done today.', sTog('nDone', 'A session finishes')),
      R('A routine has results', 'Morning brief, weekly AI notes.', sTog('nRoutine', 'A routine has results')),
      R('Style', 'How notifications reach you.', sSeg('deliver', [['banner', 'Banner'], ['sound', 'Banner + sound'], ['badge', 'Badge only']], 'Notification style')),
    ]],
    ['Deep work', [
      R('Deep work hours', 'From your memory: deep work 9–12.', `<span class="mono sval">Mon–Fri · 9:00–12:00</span><button class="btn sm g" data-sa="hours">Edit</button>${sTog('deepOn', 'Deep work hours')}`, { kw: 'quiet focus do not disturb' }),
      R('During deep work, notify me about', '', sSeg('deep', [['blockers', 'Only blockers'], ['nothing', 'Nothing']], 'During deep work'), { kw: 'quiet focus' }),
      R('Morning brief', 'Theseus’s 5-bullet summary, decisions first.', sSel('brief', [['7:30', '7:30 AM'], ['8:00', '8:00 AM'], ['8:30', '8:30 AM'], ['9:00', '9:00 AM']], 'Morning brief time'), { kw: 'routine' }),
    ]],
  ];
  if (id === 'memory') return [
    ['Learning', [
      R('Learn from my sessions', 'Saves preferences it notices, like “Prefer recharts for charts”.', sTog('learn', 'Learn from my sessions')),
      R('Ask before saving', 'New memories wait for your OK instead of getting a “new” tag.', sTog('askMem', 'Ask before saving')),
      R('Saved memories', `${memCount()} across ${Object.keys(MEM).length} groups. Every agent reads them before it starts.`, `<button class="btn sm" data-pg="memory">Open Memory${icon('right', 12)}</button>`),
    ]],
    ['Privacy', [
      R('Keep session history', 'Older sessions are deleted. Memories stay.', sSel('keep', [['30', '30 days'], ['90', '90 days'], ['365', '1 year'], ['all', 'Forever']], 'Keep session history')),
      R('Send crash reports', 'Stack traces only, never session content.', sTog('crash', 'Send crash reports')),
      R('Export memory', 'A memory.json you can edit or move to another Mac.', `<button class="btn sm" data-sa="export">${icon('download', 12)}Export</button>`),
    ]],
    ['Danger zone', [
      R('Clear all memory', 'The crew forgets every preference. This can’t be undone.', `<button class="btn sm dgr" data-sconf="clearmem"${memCount() ? '' : ' disabled'}>${icon('trash', 12)}Clear memory…</button>`, { cls: 'danger', kw: 'delete reset' }),
    ]],
  ];
  if (id === 'ints') return [
    ['Connected tools', INTS.map(([k, n, ic, h]) => R(n, h, `<span class="sst${SET.ints[k] ? ' on' : ''}">${SET.ints[k] ? 'Connected' : 'Not connected'}</span><button class="btn sm" data-sint="${k}">${SET.ints[k] ? 'Manage' : 'Connect'}</button>`, { lead: `<span class="slead">${icon(ic, 15)}</span>`, kw: 'mcp integration account' }))],
    ['MCP servers', [R('Add a server', 'Any MCP server on this Mac or a URL.', `<button class="btn sm" data-sa="mcp">${icon('plus', 12)}Add server</button>`, { kw: 'mcp' })]],
  ];
  if (id === 'keys') return KEYROWS.map(([g, rows]) => [g, rows.map(([k, l]) => R(l, '', SET.rebind === k ? `<span class="kb rec" aria-live="polite">Press keys · Esc cancels</span>` : `<kbd class="kb">${esc(SET.keys[k])}</kbd><button class="btn sm g" data-srebind="${k}" aria-label="Rebind ${esc(l)}">Rebind</button>`, { kw: 'shortcut keyboard' }))]).concat([['', [R('Reset shortcuts', 'Back to the defaults.', `<button class="btn sm" data-skreset="1"${Object.keys(KEYS0).every(k => KEYS0[k] === SET.keys[k]) ? ' disabled' : ''}>Reset</button>`)]]]);
  if (id === 'about') return [
    ['Theseus', [
      R('Version', 'Theseus 0.9.2 · built Oct 14, 2026', SET.upd === 'checking' ? `<span class="sval">Checking…</span>` : SET.upd === 'done' ? `<span class="sst on">Up to date</span>` : `<button class="btn sm" data-supd="1">${icon('ref', 12)}Check for updates</button>`, { kw: 'update' }),
      R('Update channel', 'Beta gets new features about two weeks early.', sSeg('channel', [['stable', 'Stable'], ['beta', 'Beta']], 'Update channel')),
      R('Logs', 'Attach these when you report a problem.', sPath('~/Library/Logs/Theseus', 1)),
      R('Help & feedback', '', `<button class="btn sm" data-sa="help">Open help</button>`),
    ]],
  ];
  return [];
}
const hl = s => { if (!SET.q) return esc(s); const q = SET.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return String(s).split(new RegExp(`(${q})`, 'gi')).map((p, i) => i % 2 ? `<mark>${esc(p)}</mark>` : esc(p)).join(''); };
const sMatches = id => { const q = SET.q.trim().toLowerCase(); return secRows(id).flatMap(g => g[1]).filter(r => `${r.l} ${r.h} ${r.kw || ''}`.toLowerCase().includes(q)); };
const sRow = r => `<div class="srow${r.cls ? ' ' + r.cls : ''}">${r.lead || ''}<div class="sl-w"><span class="sl">${hl(r.l)}</span>${r.h ? `<span class="sh">${hl(r.h)}</span>` : ''}${r.below || ''}</div>${r.c ? `<div class="sc">${r.c}</div>` : ''}</div>`;
const sGrp = ([t, rows]) => `<section class="sgrp">${t ? `<h3>${t}</h3>` : ''}<div class="sbox">${rows.map(sRow).join('')}</div></section>`;

function settingsNav() {
  const q = SET.q.trim();
  return `<aside class="side snav" style="grid-template-rows:auto auto minmax(0,1fr) auto"><div class="side-h"><h2>${icon('settings', 15)}Settings</h2></div>
  <label class="search">${icon('search', 13)}<input id="setq" placeholder="Search settings…" value="${esc(SET.q)}" aria-label="Search settings">${q ? `<button class="sx" data-sclear="1" aria-label="Clear search">${icon('x', 12)}</button>` : `<kbd>${esc(SET.keys.search)}</kbd>`}</label>
  <nav class="slist" aria-label="Settings sections">${SECS.map(([id, ic, t]) => { const n = q ? sMatches(id).length : 0, on = !q && SET.sec === id; return `<button class="snav-i${on ? ' on' : ''}${q && !n ? ' dim' : ''}" data-ssec="${id}"${on ? ' aria-current="page"' : ''}>${icon(ic, 15)}<span>${t}</span>${id === 'models' && !q ? `<span class="c amb" title="Codex window 88% used">88%</span>` : ''}${q && n ? `<span class="c">${n}</span>` : ''}</button>`; }).join('')}</nav>
  <div class="side-f">${icon('check', 12)}Changes save automatically</div></aside>`;
}
function settingsPage() {
  const q = SET.q.trim();
  if (q) {
    const hits = SECS.map(s => [s, sMatches(s[0])]).filter(x => x[1].length), n = hits.reduce((a, x) => a + x[1].length, 0);
    return `<div class="page"><div class="page-w sw"><h1>${icon('search', 20)}Search</h1><p>${n ? `${n} setting${n > 1 ? 's' : ''} match “${esc(q)}”.` : '&nbsp;'}</p>
    ${hits.map(([s, rows]) => `<section class="sgrp"><h3><button class="sjump" data-ssec="${s[0]}">${icon(s[1], 13)}${s[2]}${icon('right', 12)}</button></h3><div class="sbox">${rows.map(sRow).join('')}</div></section>`).join('') || `<div class="sempty">${icon('search', 22)}<b>No settings match “${esc(q)}”</b><span>Try “model”, “approval” or “notifications”.</span><button class="btn sm" data-sclear="1">Clear search</button></div>`}</div></div>`;
  }
  const [id, ic, t, dsc] = SECS.find(s => s[0] === SET.sec) || SECS[0];
  return `<div class="page"><div class="page-w sw"><h1>${id === 'about' ? '<img class="about-logo" src="assets/brand/app-icon.svg" alt="" width="64" height="64">' : icon(ic, 20)}${t}</h1><p>${dsc}</p>${secRows(id).map(sGrp).join('')}</div></div>`;
}
function settingsDialog() {
  if (!SET.confirm) return '';
  const D = {
    clearmem: ['Clear all memory?', `Theseus and the crew will forget all ${memCount()} saved preferences, including how you code, research and write. Sessions are kept.`, 'Clear memory'],
    'ask.send': ['Send without asking?', 'Theseus and Quill could email or message people as you, with no review step.', 'Never ask'],
    'ask.del': ['Delete without asking?', 'Agents could delete files in your projects. They still go to the Trash first.', 'Never ask'],
  }[SET.confirm];
  return `<div class="scrim"><div class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t" aria-describedby="dlg-d"><h2 id="dlg-t">${icon('alert', 16)}${D[0]}</h2><p id="dlg-d">${D[1]}</p><div class="btns"><button class="btn" data-sno="1">Cancel</button><button class="btn dgr" data-syes="1">${D[2]}</button></div></div></div>`;
}
function setClick(t, d) {
  const label = () => t.getAttribute('aria-label') || (t.closest('[aria-label]') || {}).getAttribute?.('aria-label') || '';
  if (d.ssec) { SET.sec = d.ssec; SET.q = ''; SET.rebind = null; render(); const p = $('.page'); if (p) p.scrollTop = 0; return 1; }
  if (d.sclear) { SET.q = ''; render(); $('#setq').focus(); return 1; }
  if (d.stog) { const v = gv(d.stog) ? 0 : 1; sv(d.stog, v); toast(`${label()} ${v ? 'on' : 'off'}`); render(); return 1; }
  if (d.sseg) { const [p, v] = d.sseg.split('|'); if (gv(p) === v) return 1; if (['ask.send', 'ask.del'].includes(p) && v === 'allow') { SET.confirm = p; render(); return 1; } sv(p, v); toast(`${t.closest('[role=radiogroup]').getAttribute('aria-label')}: ${t.textContent}`); render(); return 1; }
  if (d.sstep) { SET.slots = Math.min(8, Math.max(3, SET.slots + +d.sstep)); toast(`${SET.slots} agent slots`); render(); return 1; }
  if (d.sconf) { SET.confirm = d.sconf; render(); return 1; }
  if (d.sno) { SET.confirm = null; render(); return 1; }
  if (d.syes) { const c = SET.confirm; SET.confirm = null; if (c === 'clearmem') { const n = memCount(); Object.values(MEM).forEach(g => { g.xs.length = 0; }); toast(`Cleared ${n} memories`); } else { sv(c, 'allow'); toast(c === 'ask.send' ? 'Sending no longer asks' : 'Deleting no longer asks'); } render(); return 1; }
  if (d.sdel) { const [c] = SET.allow.splice(+d.sdel, 1); toast(`${c} will ask again`); render(); return 1; }
  if (d.saddb) { const ip = $('#saddin'), v = ip.value.trim(); if (!v) { ip.focus(); return 1; } if (!SET.allow.includes(v)) SET.allow.push(v); toast(`${v} runs without asking`); render(); $('#saddin').focus(); return 1; }
  if (d.sint) { const k = d.sint, n = INTS.find(x => x[0] === k)[1]; if (SET.ints[k]) { toast(`${n}: scopes and account`); return 1; } SET.ints[k] = 1; toast(`${n} connected`); render(); return 1; }
  if (d.srebind) { SET.rebind = d.srebind; render(); return 1; }
  if (d.skreset) { SET.keys = { ...KEYS0 }; toast('Shortcuts reset'); render(); return 1; }
  if (d.supd) { SET.upd = 'checking'; render(); setTimeout(() => { SET.upd = 'done'; if (S.page === 'settings') render(); setTimeout(() => { SET.upd = 'idle'; if (S.page === 'settings') render(); }, 4000); }, 1200); return 1; }
  if (d.sa) {
    if (d.sa === 'pauseall') { let n = 0; SS.forEach(s => { if (['running', 'thinking'].includes(s.st)) { s.st = 'queued'; s.prev = ['', 'paused by you']; n++; } }); toast(n ? `Paused ${n} agent${n > 1 ? 's' : ''} · slots freed` : 'Nothing is running'); render(); return 1; }
    const m = { reveal: `Revealed ${d.p} in Finder`, manage: `${d.p}: plan and account`, change: 'Choose a folder', domains: 'Edit allowed domains', addspace: 'New space: name + folder', hours: 'Edit deep work hours', export: 'Exported memory.json to ~/Downloads', mcp: 'Add an MCP server: command or URL', help: 'Opening help' }[d.sa];
    if (m) toast(m); return 1;
  }
  return 0;
}
app.addEventListener('change', e => {
  const d = e.target.dataset;
  if (d.ssel) { sv(d.ssel, e.target.value); toast(`${e.target.getAttribute('aria-label')}: ${e.target.selectedOptions[0].textContent}`); render(); }
  if (d.smodel) { AG[d.smodel].model = e.target.value; toast(`${AG[d.smodel].n} now runs on ${e.target.value}`); render(); }
});
app.addEventListener('input', e => { if (e.target.id === 'setq') { SET.q = e.target.value; SET.rebind = null; render(); } });
app.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'saddin') { e.preventDefault(); $('[data-saddb]').click(); } });
document.addEventListener('keydown', e => {
  if (S.page !== 'settings') return;
  if (SET.confirm) { if (e.key === 'Escape') { e.preventDefault(); SET.confirm = null; render(); } else if (e.key === 'Tab') { const b = $$('.dlg button'), i = b.indexOf(document.activeElement); e.preventDefault(); b[(i + (e.shiftKey ? b.length - 1 : 1)) % b.length].focus(); } e.stopImmediatePropagation(); return; }
  if (SET.rebind) {
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.key === 'Escape') { SET.rebind = null; return render(); }
    if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return;
    const k = e.key === 'Enter' ? '↵' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
    const combo = (e.ctrlKey ? '⌃' : '') + (e.altKey ? '⌥' : '') + (e.shiftKey ? '⇧' : '') + (e.metaKey ? '⌘' : '') + k;
    const clash = Object.keys(SET.keys).find(x => x !== SET.rebind && SET.keys[x] === combo);
    if (clash) { toast(`${combo} is already used by “${KEYROWS.flatMap(g => g[1]).find(r => r[0] === clash)[1]}”`); return; }
    SET.keys[SET.rebind] = combo; SET.rebind = null; toast(`Shortcut set to ${combo}`); return render();
  }
  const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName);
  if (e.key === SET.keys.search && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); $('#setq').focus(); }
  if (e.key === 'Escape' && document.activeElement && document.activeElement.id === 'setq' && SET.q) { SET.q = ''; render(); $('#setq').focus(); }
}, true);

/* ── live activity ── */
const POOL = {
  r1: [['WEB', 'docs.crewai.com/concepts/memory', 'CrewAI memory is short-term + entity + long-term; long-term needs an external store.', 1], ['WEB', 'mastra.ai/docs', 'Mastra is TypeScript-first, which fits your stack.', 1], ['CITE', 'star-history.com', 'Pulled star history to sanity-check momentum, not quality.', 1], ['WRITE', 'research/agent-frameworks.md', 'Comparison table updated with memory and TypeScript support.', 0]],
  c5: [['TEST', 'vitest reminders.tz', 'UTC+13 passes now. Two DST cases still fail.'], ['EDIT', 'src/reminders/tz.test.ts', 'Pinned the clock with vi.setSystemTime for the DST fixtures.'], ['TEST', 'vitest reminders.tz', 'All 9 timezone tests pass.']],
};
const pi = { r1: 0, c5: 0 };
const P = new URLSearchParams(location.search);
if (P.get('s')) select(P.get('s')); if (P.get('view')) S.view = P.get('view'); if (P.get('page')) S.page = P.get('page'); if (P.get('tab')) S.itab = P.get('tab'); if (P.get('space')) S.space = P.get('space'); if (P.get('section')) SET.sec = P.get('section');
render();
if (!P.has('static')) setInterval(() => {
  const ae = document.activeElement; if ($('.menu') || (ae && /INPUT|TEXTAREA/.test(ae.tagName) && ae.value)) return;
  const ids = Object.keys(POOL).filter(id => ['running', 'thinking'].includes(ss(id).st)); if (!ids.length) return;
  const id = ids[Math.floor(Math.random() * ids.length)], s = ss(id), [tag, title, text, src] = POOL[id][pi[id]++ % POOL[id].length], th = thread(s);
  th.forEach(m => (m.tools || []).forEach(t => { if (t.run) { t.run = 0; t.meta = 'done'; } }));
  push(id, { r: 'ag', t: text, tools: [{ tag, title, meta: 'just now' }] });
  if (th.length > 16) th.splice(1, 1);
  if (src && s.srcN < SRC.length) s.srcN++;
  s.prev = [tag, title]; s.time = 'now'; s.st = s.st === 'thinking' ? 'running' : Math.random() < .35 ? 'thinking' : s.st;
  if (s.loop && s.loop[0] < s.loop[1]) s.loop[0]++;
  render();
}, 3400);
})();
