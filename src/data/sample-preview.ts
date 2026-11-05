import type { AgentProfile } from '../../shared/bridge';
import type { MemoryNode, MemoryNodeType, MemoryScope, MemoryState } from '../../shared/memory';

// Fictional display fixtures. Never inserted into either main-process repository.
const createdAt='2026-10-12T09:00:00.000Z';
const updatedAt='2026-10-18T16:30:00.000Z';
const agents:[string,AgentProfile['icon'],AgentProfile['color'],string,AgentProfile['sandbox']][]=[
  ['Forge','code','green','Builds thoughtful React interfaces and reusable components.','workspace-write'],
  ['Sentinel','shield','amber','Reviews changes for security, correctness, and edge cases.','read-only'],
  ['Scout','spark','blue','Explores codebases and maps out implementation options.','read-only'],
  ['Quill','book','pink','Turns complex systems into clear documentation.','workspace-write'],
  ['Patch','bug','violet','Reproduces tricky bugs and makes focused fixes.','workspace-write'],
  ['Atlas','code','blue','Plans architecture and traces dependencies across services.','read-only'],
  ['Pixel','spark','pink','Refines spacing, accessibility, and interaction details.','workspace-write'],
  ['Relay','code','green','Connects APIs with typed contracts and helpful errors.','workspace-write'],
  ['Keeper','shield','violet','Checks migrations, data integrity, and recovery paths.','read-only'],
  ['Spec','bug','amber','Adds meaningful tests for the behavior that matters.','workspace-write'],
  ['Tempo','spark','green','Finds slow paths and suggests measured improvements.','read-only'],
  ['Harbor','book','blue','Prepares release notes and reviews deployment readiness.','read-only'],
];
export const sampleAgents:AgentProfile[]=agents.map(([name,icon,color,description,sandbox],i)=>({
  id:`sample-agent-${i}`,configurationVersion:1,name,icon,color,description,runtime:'codex',
  model:null,reasoningEffort:null,instructions:description,memory:i%3===0?'personal-project':i%3===1?'project':'none',
  sandbox,timeoutSeconds:1800,createdAt,updatedAt,defaultProjectPath:null,
}));
const personal:MemoryScope={kind:'personal'};
const orbit:MemoryScope={kind:'project',projectPath:'/sample-projects/orbit'};
const atlas:MemoryScope={kind:'project',projectPath:'/sample-projects/atlas'};
const garden:MemoryScope={kind:'project',projectPath:'/sample-projects/garden'};
const facts:[string,MemoryNodeType,string,MemoryScope][]=[
  ['Maya Chen','person','Fictional product designer collaborating on the desktop experience.',personal],
  ['Jordan Lee','person','Fictional engineer reviewing APIs and database changes.',personal],
  ['Small, focused commits','preference','Example preference: keep each commit focused on one understandable change.',personal],
  ['Explain the tradeoffs','preference','Example preference: compare alternatives before a large architectural change.',personal],
  ['Keyboard-first workflows','preference','Example preference: provide keyboard shortcuts for frequent actions.',personal],
  ['Accessible interfaces','goal','Example goal: ship readable, keyboard-accessible interfaces with clear feedback.',personal],
  ['Orbit desktop','project','Fictional project entry for a desktop coding-agent workspace.',orbit],
  ['React + TypeScript','technology','Example project stack for reusable, strongly typed UI components.',orbit],
  ['Electron','technology','Example desktop runtime with privileged operations isolated in the main process.',orbit],
  ['Dark, quiet surfaces','preference','Example project preference: restrained violet accents on dark neutral surfaces.',orbit],
  ['Reliable run recovery','goal','Example project goal: make interrupted runs and retained output easy to inspect.',orbit],
  ['Atlas API','project','Fictional service for organizing a shared research catalog.',atlas],
  ['PostgreSQL','technology','Example relational database used by the Atlas service.',atlas],
  ['Typed API contracts','preference','Example project preference: validate inputs and share explicit response schemas.',atlas],
  ['Fast search','goal','Example project goal: make catalog queries feel immediate at realistic data volumes.',atlas],
  ['Garden journal','project','Fictional app for tracking planting notes and seasonal observations.',garden],
  ['Local-first storage','technology','Example project approach: retain journal entries offline and sync deliberately.',garden],
  ['Gentle reminders','preference','Example project preference: allow people to choose when notifications arrive.',garden],
  ['Offline journal','goal','Example project goal: let people capture notes without a network connection.',garden],
];
const nodes:MemoryNode[]=facts.map(([label,nodeType,meaning,scope],i)=>({
  id:`sample-memory-${i}`,rootId:`sample-memory-${i}`,kind:'node',nodeType,label,meaning,scope,
  source:{kind:'manual',note:'Fictional sample · display preview only'},version:1,status:'current',createdAt,updatedAt,
}));
const links:[number,number,string][]=[
  [0,4,'prefers'],[0,5,'aims for'],[1,2,'prefers'],[1,3,'values'],[4,5,'supports'],
  [6,7,'built with'],[6,8,'runs on'],[6,9,'styled with'],[6,10,'aims for'],[7,8,'renders inside'],
  [11,12,'stores data in'],[11,13,'follows'],[11,14,'aims for'],[12,14,'enables'],
  [15,16,'uses'],[15,17,'follows'],[15,18,'aims for'],[16,18,'enables'],
];
export const sampleMemory:MemoryState={version:1,revision:0,projects:[{path:orbit.projectPath,name:'Orbit · sample'},{path:atlas.projectPath,name:'Atlas · sample'},{path:garden.projectPath,name:'Garden · sample'}],
  records:[...nodes,...links.map(([from,to,label],i)=>({id:`sample-link-${i}`,rootId:`sample-link-${i}`,kind:'relationship' as const,from:nodes[from].rootId,to:nodes[to].rootId,label,meaning:`Sample relationship: ${nodes[from].label} ${label} ${nodes[to].label}.`,scope:nodes[from].scope,source:{kind:'manual' as const,note:'Fictional sample · display preview only'},version:1,status:'current' as const,createdAt,updatedAt}))],
  positions:Object.fromEntries(nodes.map((n,i)=>{
    const cluster=i<6?0:i<11?1:i<15?2:3;
    const local=i-[0,6,11,15][cluster];
    return [n.rootId,{x:(cluster%2)*920+(local%3)*270,y:Math.floor(cluster/2)*640+Math.floor(local/3)*230}];
  })),
};
