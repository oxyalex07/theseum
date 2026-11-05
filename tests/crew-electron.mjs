// UI and IPC orchestration against a local runtime fixture; no provider/account calls.
import { _electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const root=await realpath(await mkdtemp(join(tmpdir(),'theseus-crew-')));
const project=join(root,'project'),profile=join(root,'profile'),fake=join(root,'codex');
await mkdir(project);await mkdir('artifacts/verification',{recursive:true});
await writeFile(fake,`#!${process.execPath}
const fs=require('node:fs'),path=require('node:path');
if(process.argv.includes('--version')){console.log('fixture 1');process.exit(0);}
if(process.argv.includes('login'))process.exit(0);
if(process.argv.includes('mcp')){console.log('[]');process.exit(0);}
if(process.argv.includes('app-server')){
 require('node:readline').createInterface({input:process.stdin}).on('line',line=>{const r=JSON.parse(line);if(r.id)console.log(JSON.stringify({id:r.id,result:r.method==='model/list'?{data:[]}:{}}));});
}else{
 let task='';process.stdin.on('data',c=>task+=c);process.stdin.on('end',()=>{
 const role=task.includes('Assigned crew role: sentinel')?'sentinel':'forge';
 fs.writeFileSync(path.join(${JSON.stringify(root)},role+'.json'),JSON.stringify({task,args:process.argv,cwd:process.cwd()}));
 const timer=setInterval(()=>{if(fs.existsSync(path.join(${JSON.stringify(root)},'finish-'+role))){clearInterval(timer);console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:role==='forge'?'HANDOFF: fixture build completed':'REVIEW: fixture handoff received'}}));console.log(JSON.stringify({type:'turn.completed'}));}},30);
 });
}
`,{mode:0o700});
let desktop;const errors=[];
async function launch(){
 const env={...process.env,THESEUS_USER_DATA_DIR:profile,THESEUS_CODEX_PATH:fake};
 delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_SAMPLE_PREVIEW;
 desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));
 await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();return page;
}
try{
 let page=await launch();
 const runs=()=>page.evaluate(async()=>(await window.theseus.getExecutionState()).runs);
 await desktop.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},project);
 await page.getByRole('button',{name:'Choose project folder',exact:true}).click();
 await page.getByRole('button',{name:'New session',exact:true}).click();
 assert.equal((await runs()).length,0);
 await expect(page.getByRole('radiogroup',{name:'Execution mode',exact:true})).toBeVisible();
 await page.locator('.split-btn > button').first().click();assert.equal((await runs()).length,0);
 await page.locator('.kbar').click();
 await page.getByRole('textbox',{name:'Command palette search',exact:true}).fill('Build the fixture feature');
 await page.getByRole('button',{name:'Review live task',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Start a task',exact:true})).toHaveValue('Build the fixture feature');
 assert.equal((await runs()).length,0);
 await page.getByLabel('Routing',{exact:true}).selectOption('feature');
 const saved=await page.evaluate(()=>window.theseus.saveAgentProfile({name:'Crew builder',icon:'code',color:'green',description:'Fixture',runtime:'codex',model:null,reasoningEffort:null,instructions:'SAVED_CREW_INSTRUCTIONS',memory:'none',sandbox:'workspace-write',timeoutSeconds:60,folderChoice:null}));
 const workspaceId=(await page.evaluate(()=>window.theseus.getExecutionState())).workspace.id;
 await assert.rejects(()=>page.evaluate(({workspaceId,saved})=>window.theseus.startAgentRun({workspaceId,task:'Stale profile',crew:{route:'feature',profiles:{forge:{id:saved.id,updatedAt:'2020-01-01T00:00:00Z'}}}}),{workspaceId,saved}),/changed/);
 assert.equal((await runs()).length,0);
 await page.reload();await page.getByRole('textbox',{name:'Start a task',exact:true}).fill('Build the fixture feature');
 await page.getByLabel('Routing',{exact:true}).selectOption('feature');
 await expect(page.locator('#crew-forge option').filter({hasText:'Crew builder'})).toHaveCount(1);
 await page.locator('#crew-forge').selectOption(saved.id);
 await page.screenshot({path:'artifacts/verification/crew-composer.png'});
 await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,750));
 await page.waitForFunction(()=>window.innerWidth===1100);
 assert.equal(await page.locator('.big-cmp').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 await page.screenshot({path:'artifacts/verification/crew-composer-1100.png'});
 await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,900));
 await page.getByRole('button',{name:'Start Codex',exact:true}).click();
 await expect.poll(async()=>(await runs()).filter(r=>r.status==='running').length).toBe(1);
 let crew=await runs();assert.equal(crew.length,2);const builder=crew.find(r=>r.crew.role==='forge'),reviewer=crew.find(r=>r.crew.role==='sentinel');
 assert.equal(reviewer.status,'queued');assert.equal(builder.agentConfiguration.profile.id,saved.id);
 await expect.poll(async()=>readFile(join(root,'forge.json'),'utf8').catch(()=>'' )).not.toBe('');
 const buildInput=JSON.parse(await readFile(join(root,'forge.json'),'utf8'));assert.match(buildInput.task,/SAVED_CREW_INSTRUCTIONS/);
 await writeFile(join(root,'finish-forge'),'done');
 await expect.poll(async()=>(await runs()).find(r=>r.id===reviewer.id)?.status).toBe('running');
 await expect.poll(async()=>readFile(join(root,'sentinel.json'),'utf8').catch(()=>'' )).not.toBe('');
 await assert.rejects(()=>page.evaluate(id=>window.theseus.deleteRunHistory({ids:[id]}),builder.id),/crew history/);
 const reviewInput=JSON.parse(await readFile(join(root,'sentinel.json'),'utf8'));
 assert.match(reviewInput.task,/HANDOFF: fixture build completed/);assert.ok(reviewInput.args.includes('read-only'));assert.equal(reviewInput.cwd,project);
 await page.getByRole('navigation',{name:'Live crew steps',exact:true}).getByRole('button',{name:/Sentinel/}).click();
 await page.screenshot({path:'artifacts/verification/crew-review.png'});
 await writeFile(join(root,'finish-sentinel'),'done');
 await expect.poll(async()=>(await runs()).every(r=>r.status==='completed')).toBe(true);
 await desktop.close();desktop=undefined;page=await launch();
 crew=await runs();assert.equal(crew.length,2);assert.deepEqual(crew.find(r=>r.id===reviewer.id).crew,reviewer.crew);
 // Explicit demo creation is isolated from owned runs.
 await page.locator('.kbar').click();
 await page.getByRole('radiogroup',{name:'Task execution mode',exact:true}).getByRole('radio',{name:'Demo · simulated',exact:true}).click();
 await page.getByRole('textbox',{name:'Command palette search',exact:true}).fill('Simulated fixture task');
 await page.getByRole('button',{name:'Review demo task',exact:true}).click();
 await page.getByRole('button',{name:'Start',exact:true}).click();
 await page.getByText('Demo session · simulated activity',{exact:true}).waitFor();assert.equal((await runs()).length,2);
 assert.deepEqual(errors,[]);
 console.log('PASS New session/sidebar/command creation, explicit execution mode, saved role resolution, dependency handoff, read-only review, shared checkout, restart ownership, demo isolation and 1100px composer; no provider calls');
}finally{await desktop?.close();await rm(root,{recursive:true,force:true});}
