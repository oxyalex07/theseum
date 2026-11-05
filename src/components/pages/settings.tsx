import { bindingConflict, eventBinding, keyboardLabels, type KeyboardAction } from '@/state/keyboard';
import { useDesktopSettings, UpdateControl } from './desktop-settings';
import { WorktreeSettings } from './worktree-settings';
import { RunRetentionControl } from './run-retention';
import { SafetySettings } from '../safety-settings';
import { AccountSettings, IntegrationSettings } from '../provider-settings';
import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '@/state/app-context';
import { useMemory } from '@/state/memory-context';
import { sections, mockProjects, mockSettings } from '@/data/mock-data';
import { memoryText, type AgentId, type SectionId, type SettingValue } from '@/types';
import { Avatar, Icon } from '../common';
import { brandAsset } from '@/lib/utils';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
interface Row { label:string; hint?:string; keywords?:string; control:ReactNode; below?:ReactNode; lead?:ReactNode; danger?:boolean }
type Group=[string,Row[]];
export function SettingsNavigation(){const {m,update}=useApp();return <aside className="side snav" style={{gridTemplateRows:'auto auto minmax(0,1fr) auto'}}><div className="side-h"><h2><Icon name="settings" size={15}/>Settings</h2></div><label className="search"><Icon name="search" size={13}/><input id="settings-search" aria-label="Search settings" placeholder="Search settings…" value={m.settingsQuery} onChange={e=>update(d=>{d.settingsQuery=e.target.value;})}/>{m.settingsQuery?<button aria-label="Clear search" onClick={()=>update(d=>{d.settingsQuery='';})}><Icon name="x" size={12}/></button>:<kbd>{m.settings.keys.search}</kbd>}</label><nav className="slist" aria-label="Settings sections">{sections.map(([id,ic,title])=><button key={id} className={`snav-i ${m.section===id&&!m.settingsQuery?'on':''}`} aria-current={m.section===id&&!m.settingsQuery?'page':undefined} onClick={()=>update(d=>{d.section=id;d.settingsQuery='';})}><Icon name={ic} size={15}/><span>{title}</span></button>)}</nav><div className="side-f"><Icon name="check" size={12}/>Desktop preferences, connections, Safety, and worktrees · sample controls are labeled</div></aside>;}
function Segmented({path,label,options,onRisk}:{path:string;label:string;options:[string,string][];onRisk?:(p:string)=>void}){const {m,update}=useApp();return <div className="seg" role="radiogroup" aria-label={label}>{options.map(([value,text])=><button key={value} role="radio" aria-checked={m.settings.values[path]===value} className={m.settings.values[path]===value?'on':''} onClick={()=>{if(onRisk&&value==='allow'&&['ask.send','ask.del'].includes(path)){onRisk(path);return;}update(d=>{d.settings.values[path]=value;});}}>{text}</button>)}</div>;}
function SettingToggle({path,label}:{path:string;label:string}){const {m,update}=useApp();return <Switch aria-label={label} checked={!!m.settings.values[path]} onCheckedChange={value=>update(d=>{d.settings.values[path]=value;})}/>;}
function SettingSelect({path,label,options}:{path:string;label:string;options:[string,string][]}){const {m,update}=useApp();return <span className="ssel"><select aria-label={label} value={String(m.settings.values[path])} onChange={e=>update(d=>{d.settings.values[path]=e.target.value;})}>{path==='dag'&&!options.some(([value])=>value===m.settings.values[path])&&<option value={String(m.settings.values[path])} disabled>Unavailable saved agent · Codex defaults</option>}{options.map(([value,text])=><option key={value} value={value}>{text}</option>)}</select><Icon name="down" size={12}/></span>;}
export function SettingsPage(){
  const {m,update,notify,info,workspace,chooseWorkspace,exportMemory,profiles}=useApp();const [confirmation,setConfirmation]=useState<string|null>(null);const [rebind,setRebind]=useState<string|null>(null);
  const desktop=useDesktopSettings();
  const desktopToggle=(label:string,path:'login'|'menubar'|'nFail'|'nDone'|'deepOn',hint?:string):Row=>({label,hint,control:desktop.toggle(path,label)});
  const {graph,loading:memoryLoading,error:memoryError}=useMemory();
  const savedCount=graph.records.filter(record=>record.status==='current').length;
  const savedMemoryHint=memoryLoading?'Loading saved memories…':memoryError||graph.warning?'Saved memories could not be loaded. Open Memory for details.':`${savedCount} current saved records on this device, including facts and relationships.`;
  const demoCount=Object.values(m.memory).reduce((n,g)=>n+g.xs.length,0);
  const toggle=(label:string,path:string,hint?:string):Row=>({label,hint,control:<SettingToggle label={label} path={path}/>});
  const seg=(label:string,path:string,options:[string,string][],hint?:string):Row=>({label,hint,control:<Segmented label={label} path={path} options={options} onRisk={setConfirmation}/>});
  const select=(label:string,path:string,options:[string,string][],hint?:string):Row=>({label,hint,control:<SettingSelect label={label} path={path} options={options}/>});
  const groups=(id:SectionId):Group[]=>{
    switch(id){
      case 'general':return [
        ['Startup',[seg('Open to','start',[['home','Home'],['last','Last session']],'What you see when Theseus launches.'),desktopToggle('Launch at login','login',desktop.state?.loginHint??'Available in an installed desktop application.'),desktopToggle('Show in menu bar','menubar','Keep Theseus running when the window closes. Open or quit it from the menu bar / system tray.')]],
        ['Defaults',[seg('Default space','dspace',[['all','All'],['code','Code'],['research','Research']],'Which sessions the sidebar shows first.'),seg('Session layout','dview',[['focus','Focus'],['split','Split'],['grid','Grid']],`Initial layout at launch and when starting a new session. ${m.settings.keys.focus} / ${m.settings.keys.split} / ${m.settings.keys.grid} switches any time.`),select('New sessions start with','dag',[...Object.entries(m.agents).map(([k,a]):[string,string]=>[k,k==='orbit'?'Theseus decides (demo)':`${a.n} (demo)`]),...profiles.filter(p=>!p.archivedAt).map((p):[string,string]=>[`profile:${p.id}`,`${p.name} (saved Codex agent)`])],'Demo agent for new tasks, or saved Codex configuration selected at launch. Existing conversations keep their agent.')]],
        ['Appearance',[seg('Density','density',[['comfortable','Comfortable'],['compact','Compact']],'Compact fits more rows in session lists.'),toggle('Collapse tool cards','toolsCollapsed','Tool output expands when clicked.')]],
      ];
      case 'models':return [
        ['Accounts & usage',[{label:'Provider accounts',hint:'Account status and quota windows from your installed runtime.',control:null,below:<AccountSettings/>}]],
        ['Live capacity',[{label:'Agent slots',hint:'Maximum concurrent Codex tasks, from 1 to 8. Tasks in the same checkout wait for each other. Lowering the limit lets running tasks finish.',control:<select aria-label="Agent slots" disabled={desktop.disabled} value={desktop.state?.preferences.slots??1} onChange={e=>void desktop.save({slots:Number(e.target.value)})}>{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n}</option>)}</select>},{label:'When execution is busy',hint:'Uses occupied live slots and project checkout ownership. Ask me offers a choice before adding pending work.',control:<select aria-label="When execution is busy" disabled={desktop.disabled} value={desktop.state?.preferences.overflow??'queue'} onChange={e=>void desktop.save({overflow:e.target.value as 'queue'|'ask'})}><option value="queue">Queue work</option><option value="ask">Ask me near capacity</option><option disabled>Use other runtime — unavailable</option></select>},{label:'Hold heavy builds for the Codex reset',hint:'Unavailable. The runtime does not provide an automatic, reliable quota-reset scheduling feed. Usage can be checked manually under Provider accounts.',control:null}]],
        ['Agent models',[{label:'Saved agent configuration',hint:'Choose models advertised by Codex in the agent editor. Claude and other runtimes require adapters before they can be enabled.',control:<Button size="sm" onClick={()=>update(d=>{d.page='crew';})}>Manage agents</Button>}]],
      ];
      case 'safety':return [
        ['Live execution',[{label:'Runtime approval and safety policy',keywords:'ask first shell commands install packages push send delete spawn allowlist network timeout limits stop all',control:null,below:<SafetySettings/>}]],
      ];
      case 'spaces':return [
        ['Workspace',[{label:'Selected folder',hint:workspace?'Codex can edit this folder when you start a live task from Home.':'Choose a project for live Codex runs. Sample projects remain below.',control:<><span className="spath mono">{workspace?.path??'Not selected'}</span><Button size="sm" onClick={()=>void chooseWorkspace()}>Choose folder…</Button></>,below:workspace&&<div className="workspace-summary">{workspace.entries.slice(0,8).map(e=><span className="pchip" key={e.name}><Icon name={e.kind==='directory'?'folder':'file'} size={12}/>{e.name}</span>)}{workspace.truncated&&<small>Showing a limited summary.</small>}</div>}]],
        ...(['code','research'] as const).map((sp):Group=>[sp==='code'?'Code':'Research',[{label:'Folder',hint:'Mock folder · not read from disk',control:<span className="spath mono">{sp==='code'?'~/Code':'~/Research'}</span>},{label:'Projects',hint:'Sample projects',control:<span className="pchips">{Object.values(mockProjects).filter(p=>p.sp===sp).map(p=><span className="pchip" key={p.n}>{p.n}</span>)}</span>}]]),
        ['Worktrees',[{label:'Storage & cleanup',keywords:'location remove merged worktrees',hint:'Create a separate Git branch and folder for a live task using the Run location control on Home.',control:null,below:<WorktreeSettings/>}]],
      ];
      case 'notify':return [
        ['Notify me when',[desktopToggle('A run fails','nFail','New failed runs and sample errors in the feed; future live failure system notifications. The app badge always counts live failures until you focus Theseus.'),desktopToggle('A session finishes','nDone','New completed live runs in the feed and future system notifications. Sample attention items, cancelled runs, and interrupted runs have no category toggle.'),{label:'Style',hint:`Future system notifications only; feed delivery and unread counts are unaffected. ${desktop.state?.notificationsSupported===false?'System notifications are unavailable.':'Delivery and sound depend on OS permissions. Notification text contains no task or output content.'}`,control:desktop.segmented('deliver','Style',[['banner','Banner'],['sound','Banner + sound'],['badge','Badge only']])}]],
        ['Deep work',[desktopToggle('Deep work hours','deepOn','Mon–Fri · 9:00–12:00 local time. Applies to new feed items and system notifications. Existing items stay; suppressed items are not delivered later.'),{label:'During deep work, notify me about',hint:'Feed blockers: failed/interrupted runs and samples awaiting approval, an answer, or error recovery. System blockers: failed live runs. Category toggles still apply. Nothing suppresses all new items; the app badge still updates.',control:desktop.segmented('deep','During deep work, notify me about',[['blockers','Only blockers'],['nothing','Nothing']])},select('Morning brief','brief',[['7:30','7:30 AM'],['8:00','8:00 AM'],['8:30','8:30 AM'],['9:00','9:00 AM']],'Demo schedule only; no brief is delivered.')]],
      ];
      case 'memory':return [
        ['Saved memory',[{label:'Saved memories',hint:savedMemoryHint,control:<Button size="sm" onClick={()=>update(d=>{d.page='memory';})}>Open Memory<Icon name="right" size={12}/></Button>}]],
        ['Demo preferences',[{label:'Demo memory preferences',hint:`${demoCount} simulated preferences across ${Object.keys(m.memory).length} groups. Separate from saved memories.`,control:null},toggle('Learn from my sessions','learn','Demo preference; no learning service is running.'),toggle('Ask before saving','askMem','Demo preference only. Real memories are saved explicitly in Memory.')]],
        ['Privacy',[{label:'Keep run history',hint:'Saved on this device. Expired finished runs are permanently deleted; active runs and memories are kept.',control:<RunRetentionControl/>},{label:'Crash reporting',hint:'No crash-reporting service is configured. Theseus does not upload crash reports.',control:null},{label:'Export demo memory',hint:'Exports simulated preferences only. Use Memory → Import, export & portable sync for real graph export.',control:<Button size="sm" onClick={()=>void exportMemory()}><Icon name="download" size={12}/>Export demo preferences</Button>}]],
        ['Danger zone',[{label:'Clear demo memory',hint:'Clears simulated preferences only. Delete real facts in Memory.',danger:true,control:<Button size="sm" variant="destructive" disabled={!demoCount} onClick={()=>setConfirmation('clearmem')}><Icon name="trash" size={12}/>Clear memory…</Button>}]],
      ];
      case 'ints':return [
        ['Tools & MCP',[{label:'Connections',hint:'Built-in tools and app-owned MCP configurations for live Codex tasks.',control:null,below:<IntegrationSettings/>}]],
      ];
      case 'keys':return [
        ['Navigation',Object.entries(m.settings.keys).map(([id,key])=>({label:keyboardLabels[id as KeyboardAction]??id,hint:rebind===id?'Press a key combination. Esc cancels.':id==='cmdk'?'Command and Control are interchangeable. Shortcuts are saved on this device.':undefined,control:<><kbd className="kb">{rebind===id?'Press keys…':key}</kbd><Button size="sm" variant="ghost" aria-label={`Rebind ${keyboardLabels[id as KeyboardAction]??id}`} onClick={()=>setRebind(id)}>Rebind</Button></>}))],
        ['',[{label:'Reset shortcuts',control:<Button size="sm" onClick={()=>{update(d=>{d.settings.keys=structuredClone(mockSettings.keys);});setRebind(null);}}>Reset</Button>}]],
      ];
      case 'about':return [
        ['Theseus',[{label:'Version',hint:`Theseus ${info?.version??'0.1.0'} · foundation milestone`,control:<span className="sst on">{info?'Electron desktop':'Browser preview'}</span>},{label:'Runtime',hint:info?`Electron ${info.electron} · Node ${info.node} · ${info.platform}`:'Renderer has no desktop access in browser preview.',control:<span className="sval">{info?'Isolated renderer':'Preview'}</span>},{label:'Agent execution',hint:'Live tasks run through Codex in the Electron app and can make provider calls. Built-in browser, terminal, memory, and configured MCP tools are available.',control:<span className="sst">Codex runtime</span>},{label:'Demo features',hint:'Demo tasks and sample previews are simulated and do not make provider calls. Demo memory preferences are separate from saved memories.',control:null},{label:'Updates',hint:'Checks public GitHub releases. This source distribution uses manual installation; automatic replacement is unavailable.',control:null,below:<UpdateControl/>}]],
      ];
    }
  };
  const q=m.settingsQuery.trim().toLowerCase();const current=sections.find(s=>s[0]===m.section)!;
  const matches=q?sections.map(s=>({section:s,groups:groups(s[0]).map(([title,rows]):Group=>[title,rows.filter(r=>`${r.label} ${r.hint??''} ${r.keywords??''}`.toLowerCase().includes(q))]).filter(([,rows])=>rows.length)})).filter(s=>s.groups.length):[{section:current,groups:groups(m.section)}];
  const renderRow=(row:Row,i:number)=><div className={`srow ${row.danger?'danger':''} ${row.below?'has-below':''}`} key={`${row.label}-${i}`}>{row.lead}<div className="sl-w"><span className="sl">{row.label}</span>{row.hint&&<span className="sh">{row.hint}</span>}{row.below}</div>{row.control&&<div className="sc">{row.control}</div>}</div>;
  const confirm=()=>{if(confirmation==='clearmem')update(d=>{Object.values(d.memory).forEach(g=>{g.xs=[];});});else if(confirmation)update(d=>{d.settings.values[confirmation]='allow';});setConfirmation(null);notify('Demo preference updated');};
  useEffect(()=>{
    if(!rebind)return;
    const capture=(e:KeyboardEvent)=>{
      if(e.isComposing||e.keyCode===229)return;
      e.preventDefault();e.stopPropagation();
      if(e.key==='Escape'){setRebind(null);return;}
      const combo=eventBinding(e);if(!combo)return;
      if(bindingConflict(m.settings.keys,rebind,combo)){notify('That shortcut is already assigned');return;}
      update(d=>{d.settings.keys[rebind]=combo;});setRebind(null);
    };
    document.addEventListener('keydown',capture,true);
    return()=>document.removeEventListener('keydown',capture,true);
  },[rebind,m.settings.keys,notify,update]);
  return <div className="page"><div className="page-w sw"><h1>{!q&&m.section==='about'?<img className="about-logo" src={brandAsset('app-icon.svg')} alt="" width={64} height={64}/>:<Icon name={q?'search':current[1]} size={20}/ >}{q?'Search':current[2]}</h1><p>{q?`${matches.reduce((n,x)=>n+x.groups.reduce((n,g)=>n+g[1].length,0),0)} settings match “${m.settingsQuery}”.`:current[3]}</p>{desktop.preview&&<p className="demo-note">Desktop startup, tray, notifications, and update checks require the Electron app.</p>}{desktop.error&&<p role="alert" className="run-error">{desktop.error}</p>}{matches.map(({section,groups:gs})=><div key={section[0]}>{q&&<button className="sjump" onClick={()=>update(d=>{d.section=section[0];d.settingsQuery='';})}>{section[2]}<Icon name="right" size={12}/></button>}{gs.map(([title,rows],i)=><section className="sgrp" key={`${section[0]}-${i}`}>{title&&<h3>{title}</h3>}<div className="sbox">{rows.map(renderRow)}</div></section>)}</div>)}{!matches.length&&<div className="sempty"><Icon name="search" size={22}/><b>No settings match “{m.settingsQuery}”</b><Button size="sm" onClick={()=>update(d=>{d.settingsQuery='';})}>Clear search</Button></div>}</div>
    <Dialog open={confirmation!==null} onOpenChange={open=>{if(!open)setConfirmation(null);}}><DialogContent><DialogTitle>{confirmation==='clearmem'?'Clear demo memory?':confirmation==='ask.send'?'Send without asking?':'Delete without asking?'}</DialogTitle><DialogDescription>{confirmation==='clearmem'?`The crew will forget ${demoCount} demo preferences for this session. Sessions are kept.`:'This changes a demo preference only. No real sending or deleting capability is enabled.'}</DialogDescription><div className="btns"><DialogClose asChild><Button>Cancel</Button></DialogClose><Button variant="destructive" onClick={confirm}>{confirmation==='clearmem'?'Clear memory':'Never ask'}</Button></div></DialogContent></Dialog>
  </div>;
}
