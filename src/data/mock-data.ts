// MOCK DATA: copied from the design prototype. No provider, account, usage, or agent execution is live.
import { defaultKeys } from '../state/keyboard';
import type { AgentId, Agent, Project, MemoryGroup, Session, Source, Message, FileChange, Routine, QuickStart, SectionId, Settings } from '../types';

export const mockAgents: Record<AgentId, Agent> = {
  "orbit": {
    "n": "Theseus",
    "l": "T",
    "c": "#a79bff",
    "role": "Chief of staff",
    "model": "claude · opus",
    "p": "Plans, routes work to the crew, keeps your memory up to date. Asks before anything irreversible."
  },
  "forge": {
    "n": "Forge",
    "l": "F",
    "c": "#a3e635",
    "role": "Builder",
    "model": "codex · gpt-5",
    "p": "Writes code in a worktree. Small commits, draft PRs, TypeScript strict, pnpm."
  },
  "sentinel": {
    "n": "Sentinel",
    "l": "S",
    "c": "#fb923c",
    "role": "Reviewer & tests",
    "model": "claude · sonnet",
    "p": "Reviews every PR Forge opens, writes missing tests, blocks merges on red CI."
  },
  "scout": {
    "n": "Scout",
    "l": "S",
    "c": "#2dd4bf",
    "role": "Researcher",
    "model": "claude · sonnet",
    "p": "Finds and reads sources. Prefers primary sources, cites everything, flags opinion."
  },
  "quill": {
    "n": "Quill",
    "l": "Q",
    "c": "#f472b6",
    "role": "Writer",
    "model": "claude · opus",
    "p": "Drafts in your voice: short sentences, no hype, one idea per paragraph."
  }
};

export const mockProjects: Record<string, Project> = {
  "habit": {
    "n": "habit-tracker-app",
    "sp": "code"
  },
  "cli": {
    "n": "cli-tools",
    "sp": "code"
  },
  "dot": {
    "n": "dotfiles",
    "sp": "code"
  },
  "agents": {
    "n": "Agent frameworks",
    "sp": "research"
  },
  "notes": {
    "n": "Weekly AI notes",
    "sp": "research"
  },
  "ev": {
    "n": "EV supply chain",
    "sp": "research"
  },
  "me": {
    "n": "Personal",
    "sp": "all"
  }
};

export const mockMemory: Record<string, MemoryGroup> = {
  "code": {
    "ic": "code",
    "t": "How I code",
    "xs": [
      "TypeScript strict, no any",
      "pnpm, never npm",
      "Small commits, open PRs as drafts",
      "Vitest for tests, colocated *.test.ts",
      "Ask before adding a dependency"
    ]
  },
  "research": {
    "ic": "book",
    "t": "How I research",
    "xs": [
      "Primary sources first; flag opinion pieces",
      "Cite every claim inline",
      "Comparison tables over long prose",
      "Stop at ~15 good sources"
    ]
  },
  "voice": {
    "ic": "pen",
    "t": "How I write",
    "xs": [
      "Short sentences, no hype words",
      "One idea per paragraph",
      "Lead with the takeaway",
      "Never use \"delve\" or \"game-changer\""
    ]
  },
  "rhythm": {
    "ic": "sun",
    "t": "My rhythm",
    "xs": [
      "Morning brief at 8:00, 5 bullets max",
      "Deep work 9–12: only ping me for blockers",
      "Heavy builds after the Codex reset",
      "Weekly AI notes ship Friday"
    ]
  }
};

mockMemory.code.xs.push({ t: 'Prefer recharts for charts', nw: 1 });

export const mockSessions: Session[] = [
  {
    "id": "c1",
    "ag": "forge",
    "pj": "habit",
    "t": "Streak chart on habit screen",
    "st": "waiting",
    "time": "3:28 PM",
    "br": "feat/streak-chart",
    "prn": 48,
    "loop": [
      12,
      24
    ],
    "add": 82,
    "del": 4,
    "mem": 3,
    "prev": [
      "BASH",
      "wants to run pnpm add recharts"
    ]
  },
  {
    "id": "r2",
    "ag": "quill",
    "pj": "notes",
    "t": "Draft: Weekly AI notes #12",
    "st": "question",
    "time": "3:22 PM",
    "words": 940,
    "mem": 4,
    "prev": [
      "ASK",
      "Pick a headline"
    ]
  },
  {
    "id": "c3",
    "ag": "forge",
    "pj": "cli",
    "t": "Fix parser null check",
    "st": "error",
    "time": "3:14 PM",
    "br": "fix/parser-null",
    "prn": 45,
    "ci": "fail",
    "prev": [
      "BASH",
      "TS2345 parser.ts:88 · 3 retries"
    ]
  },
  {
    "id": "c2",
    "ag": "sentinel",
    "pj": "habit",
    "t": "Review PR #47 · reminders",
    "st": "review",
    "time": "3:05 PM",
    "prn": 47,
    "ci": "ok",
    "add": 36,
    "del": 12,
    "prev": [
      "GIT",
      "3 findings · 1 high"
    ]
  },
  {
    "id": "r1",
    "ag": "scout",
    "pj": "agents",
    "t": "Compare agent orchestration frameworks",
    "st": "thinking",
    "time": "3:31 PM",
    "srcN": 11,
    "loop": [
      6,
      10
    ],
    "mem": 2,
    "prev": [
      "WEB",
      "reading docs.crewai.com/concepts"
    ]
  },
  {
    "id": "c5",
    "ag": "sentinel",
    "pj": "habit",
    "t": "Timezone tests for reminders",
    "st": "running",
    "time": "3:27 PM",
    "br": "test/reminder-tz",
    "prev": [
      "TEST",
      "vitest reminders.tz — 6/9 passing"
    ]
  },
  {
    "id": "r3",
    "ag": "scout",
    "pj": "ev",
    "t": "Cathode supplier risk map",
    "st": "done",
    "time": "12:40 PM",
    "srcN": 24,
    "prev": [
      "WRITE",
      "report · 24 sources · 6 pages"
    ]
  },
  {
    "id": "r4",
    "ag": "quill",
    "pj": "agents",
    "t": "Blog: why I built Theseus",
    "st": "queued",
    "time": "3:10 PM",
    "prev": [
      "",
      "starts after Scout’s comparison"
    ]
  },
  {
    "id": "c4",
    "ag": "forge",
    "pj": "dot",
    "t": "Sync zsh config to new Mac",
    "st": "done",
    "time": "11:02 AM",
    "prev": [
      "GIT",
      "merged · 14 files"
    ]
  },
  {
    "id": "o1",
    "ag": "orbit",
    "pj": "me",
    "t": "Morning brief",
    "st": "done",
    "time": "8:00 AM",
    "routine": 1,
    "prev": [
      "",
      "5 bullets · 2 decisions for you"
    ]
  }
];

export const mockSources: Source[] = [
  [
    "LangGraph docs",
    "langchain-ai.github.io/langgraph",
    "p",
    "#1c3c3c",
    4
  ],
  [
    "CrewAI concepts",
    "docs.crewai.com/concepts",
    "p",
    "#ef4444",
    3
  ],
  [
    "Claude Agent SDK",
    "docs.anthropic.com/agent-sdk",
    "p",
    "#d97757",
    5
  ],
  [
    "AutoGen v0.4 release",
    "microsoft.github.io/autogen",
    "p",
    "#2563eb",
    2
  ],
  [
    "“Multi-agent is overrated”",
    "someblog.substack.com",
    "o",
    "#f59e0b",
    1
  ],
  [
    "OpenAI Agents SDK",
    "openai.github.io/agents",
    "p",
    "#10a37f",
    2
  ],
  [
    "Mastra docs",
    "mastra.ai/docs",
    "p",
    "#6366f1",
    1
  ],
  [
    "GitHub stars, Oct",
    "star-history.com",
    "s",
    "#24292f",
    2
  ],
  [
    "HN thread: agent frameworks",
    "news.ycombinator.com",
    "o",
    "#ff6600",
    1
  ],
  [
    "Pydantic AI",
    "ai.pydantic.dev",
    "p",
    "#e92063",
    1
  ],
  [
    "State of AI agents 2026",
    "research.example.org",
    "s",
    "#0ea5e9",
    3
  ]
];

export const mockThreads: Record<string, Message[]> = {
  "c1": [
    {
      "sys": "Started 22m ago · feat/streak-chart · Loop 12/24"
    },
    {
      "r": "you",
      "t": "Add a 30-day streak chart to the habit detail screen. Keep it under 80 lines."
    },
    {
      "mem": [
        "TypeScript strict",
        "pnpm",
        "draft PRs"
      ]
    },
    {
      "r": "ag",
      "t": "Reading the detail screen and the tokens first.",
      "tools": [
        {
          "tag": "READ",
          "title": "src/screens/HabitDetail.tsx",
          "meta": "180 lines"
        },
        {
          "tag": "READ",
          "title": "src/styles/tokens.css",
          "meta": "64 lines"
        }
      ]
    },
    {
      "card": "plan",
      "items": [
        [
          1,
          "Read detail screen + tokens"
        ],
        [
          1,
          "Extend useStreak() to return history"
        ],
        [
          1,
          "Create StreakChart component"
        ],
        [
          2,
          "Install chart library"
        ],
        [
          0,
          "Wire chart under header"
        ],
        [
          0,
          "Hand to Sentinel for review"
        ]
      ]
    },
    {
      "r": "ag",
      "t": "Added <code>StreakChart</code> and extended <code>useStreak()</code> to return the last 30 days.",
      "tools": [
        {
          "tag": "EDIT",
          "title": "src/components/StreakChart.tsx",
          "meta": "+64 −0",
          "out": "<span class=\"a\">+ export function StreakChart({ days }: Props) {</span>\n<span class=\"a\">+   const data = days.slice(-30)</span>\n<span class=\"a\">+   return &lt;Chart data={data} accent=\"var(--accent)\" /&gt;</span>\n<span class=\"a\">+ }</span>"
        },
        {
          "tag": "EDIT",
          "title": "src/hooks/useStreak.ts",
          "meta": "+18 −4",
          "out": "<span class=\"d\">- return streak.current</span>\n<span class=\"a\">+ return { current: streak.current, history: streak.days }</span>"
        }
      ]
    },
    {
      "r": "ag",
      "t": "You asked me to check before adding dependencies. <code>recharts</code> is the smallest option that already matches your design tokens."
    },
    {
      "card": "approval",
      "cmd": "pnpm add recharts@2.12.7",
      "why": "StreakChart renders with recharts. You remembered “Prefer recharts for charts” last week.",
      "aff": [
        [
          "file",
          "package.json"
        ],
        [
          "file",
          "pnpm-lock.yaml"
        ],
        [
          "globe",
          "registry.npmjs.org"
        ]
      ],
      "risk": "Medium"
    }
  ],
  "c2": [
    {
      "sys": "Auto-review · PR #47 fix/reminder-tz by Forge"
    },
    {
      "r": "ag",
      "t": "Reviewed 2 files and ran the suite. Checks are green, but I found three things worth fixing before you merge.",
      "tools": [
        {
          "tag": "GIT",
          "title": "diff main…fix/reminder-tz",
          "meta": "+36 −12"
        },
        {
          "tag": "TEST",
          "title": "pnpm test",
          "meta": "54 passed"
        }
      ]
    },
    {
      "card": "review",
      "items": [
        [
          "h",
          "DST jump drops the 2:30am reminder",
          "src/reminders/schedule.ts:42"
        ],
        [
          "m",
          "Timezone read from Date, not user settings",
          "src/reminders/schedule.ts:18"
        ],
        [
          "l",
          "Test name says UTC+12, fixture is UTC+13",
          "src/reminders/tz.test.ts:77"
        ]
      ]
    }
  ],
  "c3": [
    {
      "sys": "cli-tools · fix/parser-null · PR #45"
    },
    {
      "r": "ag",
      "t": "Running the build after splitting the tokenizer.",
      "tools": [
        {
          "tag": "BASH",
          "title": "pnpm build",
          "meta": "exit 2",
          "out": "<span class=\"d\">src/parser.ts:88:21 - error TS2345: Argument of type 'Token | null'\nis not assignable to parameter of type 'Token'.</span>"
        }
      ]
    },
    {
      "r": "ag",
      "t": "Three fixes failed: a non-null assertion (your lint rules ban it), an early return (breaks 4 tests), and widening the type (touches 11 files).",
      "tools": [
        {
          "tag": "EDIT",
          "title": "src/parser.ts",
          "meta": "reverted"
        },
        {
          "tag": "TEST",
          "title": "vitest parser",
          "meta": "4 failed"
        }
      ]
    },
    {
      "card": "error",
      "log": "src/parser.ts:88:21 - error TS2345\nArgument of type 'Token | null' is not assignable to 'Token'.",
      "commit": "a41c9e2",
      "note": "Failed after 3 retries. Last good commit a41c9e2."
    }
  ],
  "c5": [
    {
      "sys": "habit-tracker-app · test/reminder-tz"
    },
    {
      "r": "you",
      "t": "Cover reminders across DST and UTC+13."
    },
    {
      "r": "ag",
      "t": "Added fixtures for 9 timezones. Running them now.",
      "tools": [
        {
          "tag": "WRITE",
          "title": "src/reminders/tz.test.ts",
          "meta": "+118"
        },
        {
          "tag": "TEST",
          "title": "vitest reminders.tz",
          "meta": "6/9 passing",
          "run": 1
        }
      ]
    }
  ],
  "c4": [
    {
      "sys": "dotfiles · merged"
    },
    {
      "r": "ag",
      "t": "Copied zsh, git and starship config to the new Mac and symlinked them. 14 files.",
      "tools": [
        {
          "tag": "GIT",
          "title": "merge sync/new-mac",
          "meta": "14 files"
        }
      ]
    },
    {
      "card": "done",
      "t": "Merged into main"
    }
  ],
  "r1": [
    {
      "sys": "Started 18m ago · Loop 6/10 · stops at ~15 sources"
    },
    {
      "r": "you",
      "t": "Compare the main agent orchestration frameworks for a personal multi-agent app. What would you pick for Theseus?"
    },
    {
      "mem": [
        "primary sources first",
        "comparison tables",
        "cite inline"
      ]
    },
    {
      "r": "ag",
      "t": "Starting with official docs, then release notes, then community takes (flagged as opinion).",
      "tools": [
        {
          "tag": "WEB",
          "title": "search “agent orchestration framework 2026”",
          "meta": "12 results"
        },
        {
          "tag": "WEB",
          "title": "docs.anthropic.com/agent-sdk",
          "meta": "1.1s"
        },
        {
          "tag": "WEB",
          "title": "langchain-ai.github.io/langgraph",
          "meta": "0.8s"
        }
      ]
    },
    {
      "card": "sources",
      "n": 6
    },
    {
      "r": "ag",
      "t": "Early read: LangGraph gives the most control over state <span class=\"cite\">1</span>, CrewAI is fastest to a working crew <span class=\"cite\">2</span>, and the Claude Agent SDK has the best built-in tools for coding work <span class=\"cite\">3</span>. One community post argues single agents beat crews for most tasks <span class=\"cite\">5</span> — opinion, but worth addressing."
    },
    {
      "card": "table"
    },
    {
      "r": "ag",
      "t": "Reading CrewAI’s memory model next.",
      "tools": [
        {
          "tag": "WEB",
          "title": "docs.crewai.com/concepts/memory",
          "meta": "reading…",
          "run": 1
        }
      ]
    }
  ],
  "r2": [
    {
      "sys": "Weekly AI notes #12 · due Friday"
    },
    {
      "r": "ag",
      "t": "Draft is at 940 words across 5 sections, pulled from your saved links and Scout’s notes. Sections 1–4 are done.",
      "tools": [
        {
          "tag": "READ",
          "title": "notes/saved-links.md",
          "meta": "23 links"
        },
        {
          "tag": "WRITE",
          "title": "drafts/ai-notes-12.md",
          "meta": "940 words"
        }
      ]
    },
    {
      "mem": [
        "short sentences",
        "lead with takeaway",
        "no hype words"
      ]
    },
    {
      "card": "excerpt",
      "t": "Agents got cheaper this week. Not smarter — cheaper. That matters more than it sounds, because the bottleneck for most of us was never capability. It was cost per loop."
    },
    {
      "card": "options",
      "q": "Pick a headline for #12",
      "opts": [
        [
          "Agents got cheaper, not smarter",
          "Leads with the takeaway — matches your style",
          1
        ],
        [
          "The cost-per-loop issue",
          "Shorter, more of a hook"
        ],
        [
          "What $0.40 buys you now",
          "Concrete number, slightly clickbait"
        ],
        [
          "Write my own",
          "I’ll wait for yours"
        ]
      ]
    }
  ],
  "r3": [
    {
      "sys": "EV supply chain · finished 12:40 PM"
    },
    {
      "r": "ag",
      "t": "Report done: 24 sources, 6 pages, 6 suppliers flagged high-risk. Quill tightened the summary.",
      "tools": [
        {
          "tag": "WRITE",
          "title": "reports/cathode-risk-map.md",
          "meta": "6 pages"
        }
      ]
    },
    {
      "card": "done",
      "t": "Saved to Library · Reports"
    }
  ],
  "r4": [
    {
      "sys": "Queued · starts after Scout’s comparison"
    },
    {
      "r": "you",
      "t": "Once Scout is done, draft a post on why I built Theseus. Use the comparison as the backbone."
    },
    {
      "r": "ag",
      "t": "Queued. I’ll start the outline as soon as Scout’s table is final."
    }
  ],
  "o1": [
    {
      "sys": "Routine · every weekday at 8:00"
    },
    {
      "r": "ag",
      "t": "Good morning, Alex. Overnight:<br>• Forge finished the streak chart up to the dependency step.<br>• Sentinel’s PR #47 review is ready (1 high finding).<br>• Scout found 6 sources on agent frameworks.<br>• cli-tools build is red since 11pm.<br>• Codex resets at 4:18 PM — heavy builds after that.",
      "tools": [
        {
          "tag": "READ",
          "title": "6 sessions · 3 repos · 2 inboxes",
          "meta": "0.9s"
        }
      ]
    },
    {
      "card": "done",
      "t": "Brief delivered · 2 decisions for you"
    }
  ]
};

export const mockFiles: Record<string, FileChange[]> = {
  "c1": [
    [
      "src/components/StreakChart.tsx",
      64,
      0,
      "Added"
    ],
    [
      "src/hooks/useStreak.ts",
      18,
      4
    ],
    [
      "src/screens/HabitDetail.tsx",
      9,
      0
    ],
    [
      "src/hooks/useStreak.test.ts",
      22,
      0,
      "Added"
    ]
  ],
  "c2": [
    [
      "src/reminders/schedule.ts",
      22,
      9
    ],
    [
      "src/reminders/tz.test.ts",
      14,
      3
    ]
  ],
  "c3": [
    [
      "src/parser.ts",
      412,
      388
    ],
    [
      "src/tokenizer.ts",
      301,
      0,
      "Added"
    ],
    [
      "src/cli.ts",
      44,
      61
    ],
    [
      "test/parser.test.ts",
      120,
      98
    ]
  ],
  "c5": [
    [
      "src/reminders/tz.test.ts",
      118,
      0,
      "Added"
    ]
  ],
  "c4": [
    [
      "zsh/.zshrc",
      40,
      12
    ],
    [
      "git/.gitconfig",
      6,
      2
    ],
    [
      "starship.toml",
      22,
      0,
      "Added"
    ]
  ]
};

export const mockRoutines: Routine[] = [
  [
    "o1",
    "sun",
    "Morning brief",
    "Weekdays 8:00",
    "orbit",
    1
  ],
  [
    "",
    "news",
    "Weekly AI notes draft",
    "Thu 14:00",
    "quill",
    1
  ],
  [
    "",
    "pr",
    "Review open PRs",
    "Every PR",
    "sentinel",
    1
  ],
  [
    "",
    "ref",
    "Dependency updates",
    "Mon 9:00",
    "forge",
    0
  ]
];

export const quickStarts: QuickStart[] = [
  [
    "rocket",
    "Ship a feature",
    "Forge builds it, Sentinel reviews it, you merge.",
    [
      "forge",
      "sentinel"
    ],
    "code"
  ],
  [
    "bug",
    "Fix what’s broken",
    "Paste an error or point at a red build.",
    [
      "forge"
    ],
    "code"
  ],
  [
    "pr",
    "Review my PRs",
    "Sentinel checks every open PR across repos.",
    [
      "sentinel"
    ],
    "code"
  ],
  [
    "book",
    "Deep-dive a topic",
    "Scout gathers ~15 primary sources and a comparison.",
    [
      "scout",
      "quill"
    ],
    "research"
  ],
  [
    "pen",
    "Write a draft",
    "Quill writes in your voice from your notes.",
    [
      "quill"
    ],
    "research"
  ],
  [
    "news",
    "Weekly AI notes",
    "Turn this week’s saved links into #13.",
    [
      "scout",
      "quill"
    ],
    "research"
  ]
];

export const sections: [SectionId, string, string, string][] = [
  [
    "general",
    "settings",
    "General",
    "Startup, defaults and how Theseus looks."
  ],
  [
    "models",
    "cpu",
    "Models & usage",
    "Codex account, provider usage windows, and saved agent models. Other runtimes are unavailable."
  ],
  [
    "safety",
    "shield",
    "Approvals & safety",
    "Live execution limits, supported permissions, and stopping local tasks."
  ],
  [
    "spaces",
    "folder",
    "Spaces & folders",
    "Where your projects live on disk."
  ],
  [
    "notify",
    "bell",
    "Notifications & focus",
    "When Theseus interrupts you, and when it stays quiet."
  ],
  [
    "memory",
    "brain",
    "Memory & privacy",
    "What Theseus learns about you and how long it keeps it."
  ],
  [
    "ints",
    "link",
    "Integrations",
    "Accounts and tools the crew can use."
  ],
  [
    "keys",
    "keyboard",
    "Keyboard",
    "Shortcuts for the things you do most."
  ],
  [
    "about",
    "help",
    "About",
    "Version, updates and logs."
  ]
];

export const mockSettings: Settings = {
  "values": {
    "start": "home",
    "dspace": "all",
    "dview": "focus",
    "dag": "orbit",
    "density": "comfortable",
    "toolsCollapsed": 1,
    "slots": 4,
    "nearFull": "queue",
    "holdBuilds": 1,
    "ask.shell": "wt",
    "ask.install": "ask",
    "ask.push": "wt",
    "ask.send": "ask",
    "ask.del": "ask",
    "ask.spawn": "ask",
    "steplimit": "30m",
    "net": "list",
    "wtClean": 1,
    "brief": "8:00",
    "learn": 1,
    "askMem": 0,
    "keep": "90",
    "channel": "stable"
  },
  "allow": [
    "pnpm test",
    "pnpm lint",
    "git status",
    "git diff",
    "vitest run"
  ],
  "integrations": {
    "github": true,
    "browser": true,
    "fs": true,
    "linear": false,
    "slack": false
  },
  "keys": { ...defaultKeys }
};
