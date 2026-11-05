// Disposable history and fixture Codex; built Electron uses file://, no preview port.
import { _electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, rm, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const root=await mkdtemp(join(tmpdir(),'theseus-search-')),profile=join(root,'profile'),project=join(root,'search-project');
await mkdir(join(profile,'run-history'),{recursive:true});await mkdir(project);await mkdir('artifacts/verification',{recursive:true});
const saved={id:randomUUID(),revision:1,workspaceId:randomUUID(),projectName:'Search fixture project',projectPath:project,task:'Saved lighthouse task',status:'completed',startedAt:new Date().toISOString(),endedAt:new Date().toISOString(),output:[{sequence:1,kind:'file',text:'update src/saved-lighthouse.ts'}],truncated:false,pageSelection:[{id:randomUUID(),title:'Lighthouse source manual',url:'https://example.org/lighthouse',capturedAt:new Date().toISOString()}],agentConfiguration:{profile:{id:randomUUID(),configurationVersion:1,name:'Lighthouse specialist',icon:'code',color:'blue',description:'Fixture agent',runtime:'codex',model:null,reasoningEffort:null,instructions:'',memory:'none',sandbox:'workspace-write',timeoutSeconds:1800,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),defaultProjectPath:null},approvalPolicy:'never',timeoutSeconds:1800}};
await writeFile(join(profile,'run-history',`${saved.id}.json`),JSON.stringify({version:1,run:saved}));
const fake=join(root,'fixture-codex');
await writeFile(fake,`#!${process.execPath}
if(process.argv.includes('--version')){console.log('fixture 1.0');process.exit(0);}
if(process.argv.includes('login')){console.log('Logged in');process.exit(0);}
(async()=>{for await(const chunk of process.stdin){}console.log(JSON.stringify({type:'item.completed',item:{type:'file_change',changes:[{kind:'update',path:'src/live-beacon.ts'}]}}));await new Promise(r=>setTimeout(r,2000));console.log(JSON.stringify({type:'turn.completed'}));})();
`);await chmod(fake,0o700);
let desktop;const errors=[];
try{
  const env={...process.env,THESEUS_USER_DATA_DIR:profile,THESEUS_CODEX_PATH:fake};
  delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_SAMPLE_PREVIEW;
  desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));
  const search=page.getByRole('textbox',{name:'Search sessions',exact:true}),rows=page.locator('.slist button.ss:not(.home)');
  await search.waitFor();await expect(rows.filter({hasText:'Saved lighthouse task'})).toHaveCount(1);
  if(process.argv.includes('--baseline')){
    for(const query of ['streak chart','LangGraph docs','src/components/StreakChart.tsx','Lighthouse source manual','src/saved-lighthouse.ts']){await search.fill(query);console.log(`BASELINE ${query}: ${await rows.count()} session(s)`);}
  }else{
    async function match(query,title,kind){await search.fill(query);const row=rows.filter({hasText:title});await expect(row).toHaveCount(1);if(kind)await expect(row).toContainText(kind);await row.click();await expect(page.locator('.tab.on .tab-title')).toContainText(title);return row;}
    await match('STREAK CHART','Streak chart on habit screen');
    await match('habit-tracker-app','Streak chart on habit screen');
    await match('scout','Compare agent orchestration frameworks');
    await match('LangGraph docs','Compare agent orchestration frameworks','Sample · Source');
    await match('src/components/StreakChart.tsx','Streak chart on habit screen','Sample · File');
    await match('drafts/ai-notes-12.md','Draft: Weekly AI notes #12','Sample · File');
    await match('Saved lighthouse','Saved lighthouse task');
    await match('Search fixture project','Saved lighthouse task');
    await match('Lighthouse specialist','Saved lighthouse task');
    await search.fill('Forge');await expect(rows.filter({hasText:'Saved lighthouse task'})).toHaveCount(0);
    await match('Lighthouse source manual','Saved lighthouse task','Live · Source');
    await match('src/saved-lighthouse.ts','Saved lighthouse task','Live · File');
    await page.getByRole('button',{name:'Run details',exact:true}).click();
    await page.screenshot({path:'artifacts/verification/search-recorded-file.png'});
    await search.fill('src/components/StreakChart.tsx');await expect(rows.filter({hasText:'Saved lighthouse task'})).toHaveCount(0);
    await search.fill('does-not-exist-anywhere');await expect(rows).toHaveCount(0);await expect(page.getByText('No sessions match your search.',{exact:true})).toBeVisible();
    await expect(page.locator('#session-search-scope')).toContainText('Workspace files and current Git snapshots are not indexed');
    await search.fill('');await desktop.evaluate(({dialog},project)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[project]});},project);
    const workspace=await page.evaluate(()=>window.theseus.selectWorkspace());
    const live=await page.evaluate(workspaceId=>window.theseus.startAgentRun({workspaceId,task:'Live beacon fixture'}),workspace.id);
    await match('src/live-beacon.ts','Live beacon fixture','Live · File');
    await expect.poll(async()=>(await page.evaluate(()=>window.theseus.getRunHistory())).runs.find(r=>r.id===live.id)?.status).toBe('completed');
    await page.reload();await match('src/live-beacon.ts','Live beacon fixture','Live · File');
    assert.deepEqual(errors,[]);console.log('PASS title/project/agent/source/file search, sample/live isolation, matching session navigation, live file events and saved reload; no provider calls or preview port');
  }
}finally{await desktop?.close();await rm(root,{recursive:true,force:true});}
