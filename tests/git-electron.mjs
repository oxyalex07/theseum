// Real disposable Git checkout, fixture GitHub CLI and Codex. No network, provider calls or live merges.
import { _electron, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, realpath, writeFile, readFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const root=await realpath(await mkdtemp(join(tmpdir(),'theseus-git-e2e-'))),project=join(root,'project'),profile=join(root,'profile'),bin=join(root,'bin');
await mkdir(project);await mkdir(bin);await mkdir('artifacts/verification',{recursive:true});
const git=(...args)=>execFileSync('git',args,{cwd:project,encoding:'utf8'}).trim();
git('init','-b','feature');git('config','user.email','fixture@example.com');git('config','user.name','Fixture');
await writeFile(join(project,'code.txt'),'bug\n');git('add','.');git('commit','-m','actual fixture commit');await writeFile(join(project,'new file.txt'),'actual untracked contents');
const state=join(root,'github.json'),pr={number:14,title:'Actual fixture pull request',url:'https://github.com/example/repo/pull/14',headRefName:'feature',baseRefName:'main',headRefOid:git('rev-parse','HEAD'),state:'OPEN',isDraft:false,mergeStateStatus:'CLEAN',reviewDecision:'APPROVED',statusCheckRollup:[{name:'fixture checks',status:'COMPLETED',conclusion:'SUCCESS'}]};
await writeFile(state,JSON.stringify(pr));
await writeFile(join(bin,'gh'),`#!${process.execPath}
const fs=require('node:fs'),path=${JSON.stringify(state)},args=process.argv.slice(2),pr=JSON.parse(fs.readFileSync(path));
if(args[1]==='view')console.log(JSON.stringify(pr));
else if(args[1]==='diff')console.log('actual fixture PR diff');
else if(args[1]==='merge'){if(args[args.indexOf('--match-head-commit')+1]!==pr.headRefOid)process.exit(1);pr.state='MERGED';fs.writeFileSync(path,JSON.stringify(pr));}
else process.exit(1);
`);await chmod(join(bin,'gh'),0o700);
const runtime=join(bin,'codex'),invalidFix=join(root,'invalid-fix');
await writeFile(runtime,`#!${process.execPath}
if(process.argv.includes('--version')){console.log('fixture 1.0');process.exit(0);}
if(process.argv.includes('login')){console.log('Logged in');process.exit(0);}
(async()=>{let task='';for await(const chunk of process.stdin)task+=chunk;
const fs=require('node:fs');if(task.includes('Fix the selected review findings')&&fs.existsSync(${JSON.stringify(invalidFix)})){console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Verification did not finish'}}));console.log(JSON.stringify({type:'turn.completed'}));return;}let result={summary:'Original task completed',findings:[]};
if(task.includes('Review the actual Git changes')){if(process.argv[process.argv.indexOf('--sandbox')+1]!=='read-only')process.exit(7);result={summary:'Reviewed real checkout',findings:[{severity:'high',title:'Fix the fixture bug',path:'code.txt:1',detail:'File contains bug'}]};}
if(task.includes('Fix the selected review findings')){fs.writeFileSync('code.txt','fixed\\n');result={summary:'Fixed code.txt and verified its contents',findings:[]};}
console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify(result)}}));console.log(JSON.stringify({type:'turn.completed'}));})();
`);await chmod(runtime,0o700);
let desktop;const errors=[];
async function launch(){const env={...process.env,PATH:bin+':'+process.env.PATH,THESEUS_USER_DATA_DIR:profile,THESEUS_CODEX_PATH:runtime};delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();return page;}
try{
  let page=await launch();
  await expect(page.getByRole('tab',{name:'Overview',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('heading',{name:'Your runs at a glance',exact:true})).toBeVisible();
  await page.screenshot({path:'artifacts/verification/home-overview-empty.png'});
  await desktop.evaluate(({dialog,shell},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});shell.openExternal=async url=>{globalThis.opened=url;};dialog.showMessageBox=async()=>({response:0});},project);
  await page.getByRole('button',{name:'Choose project folder',exact:true}).click();await page.getByRole('textbox',{name:'Start a task',exact:true}).fill('Inspect my real Git checkout');await page.getByRole('button',{name:'Start Codex',exact:true}).click();
  await expect(page.getByTestId('run-status')).toHaveAttribute('data-status','completed');
  const overview=page.locator('.session-overview');
  const inspector=page.getByRole('navigation',{name:'Run inspector',exact:true});
  await expect(inspector.getByRole('button',{name:'Overview',exact:true})).toHaveAttribute('aria-current','page');
  await expect(overview).toContainText('new file.txt');
  await expect(overview).toContainText('1 passed');
  await page.screenshot({path:'artifacts/verification/session-overview.png'});
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,700));
  await expect.poll(()=>page.evaluate(()=>window.innerWidth)).toBe(1100);
  assert.equal(await overview.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  for(const label of ['Overview','Git changes','Research','Terminal','Preview','Run details'])await expect(inspector.getByRole('button',{name:label,exact:true})).toBeInViewport();
  assert.equal(await inspector.evaluate(nav=>{
    const bounds=nav.getBoundingClientRect();
    return [...nav.querySelectorAll('button')].every(button=>{
      const rect=button.getBoundingClientRect();
      return rect.top>=bounds.top && rect.bottom<=bounds.bottom && rect.left>=bounds.left && rect.right<=bounds.right;
    });
  }),true);
  await page.screenshot({path:'artifacts/verification/session-overview-1100.png'});
  await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name:'Home',exact:true}).click();
  const homePanel=page.getByRole('tabpanel',{name:'Overview',exact:true});
  await expect(homePanel).toContainText('new file.txt');
  await expect(homePanel).toContainText('1 passed');
  await page.getByRole('textbox',{name:'Start a task',exact:true}).fill('Keep my Home draft while reviewing checks');
  assert.equal(await page.locator('.home-inspector').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await page.screenshot({path:'artifacts/verification/home-overview-1100.png'});
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,900));
  await page.screenshot({path:'artifacts/verification/home-overview.png'});
  await writeFile(state,JSON.stringify({...pr,statusCheckRollup:[{name:'fixture checks',status:'COMPLETED',conclusion:'FAILURE'}]}));
  await overview.getByRole('button',{name:'Refresh',exact:true}).click();
  await expect(overview).toContainText('1 failed');
  await overview.getByRole('button',{name:'Inspect failing checks',exact:true}).click();
  await expect(page.getByRole('button',{name:'Checks',exact:true})).toHaveClass('on');
  await expect(page.locator('.git-check')).toContainText('FAILURE');
  await writeFile(state,JSON.stringify(pr));
  await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name:'Home',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Start a task',exact:true})).toHaveValue('Keep my Home draft while reviewing checks');
  await homePanel.getByRole('button',{name:'Open session',exact:true}).click();
  await expect(inspector.getByRole('button',{name:'Overview',exact:true})).toHaveAttribute('aria-current','page');
  await expect(overview).toContainText('1 passed');
  await overview.getByRole('button',{name:'Review Git changes',exact:true}).click();
  await expect(page.locator('.git-changes')).toContainText('actual untracked contents');
  await expect(page.locator('.git-changes')).toContainText('Actual fixture pull request');
  await page.getByRole('button',{name:'Commits',exact:true}).click();await expect(page.locator('.git-code')).toContainText('actual fixture commit');
  await page.getByRole('button',{name:'Checks',exact:true}).click();await expect(page.locator('.git-check')).toContainText('SUCCESS');
  await page.getByRole('button',{name:'Open GitHub PR',exact:true}).click();await expect.poll(()=>desktop.evaluate(()=>globalThis.opened)).toBe(pr.url);
  await page.getByRole('button',{name:'Ask Sentinel to review',exact:true}).click();await expect(page.locator('.cv-h .ttl b')).toContainText('Review Git changes');await expect(page.getByTestId('run-status')).toHaveAttribute('data-status','completed');
  await expect(inspector.getByRole('button',{name:'Overview',exact:true})).toHaveAttribute('aria-current','page');
  await overview.getByRole('button',{name:'Review findings',exact:true}).click();await expect(page.locator('.git-finding')).toContainText('Fix the fixture bug');
  await page.screenshot({path:'artifacts/verification/git-review.png'});
  await writeFile(invalidFix,'invalid');
  const reviewRunId=await page.locator('.cv').getAttribute('data-run-id');
  await page.getByRole('button',{name:'Fix',exact:true}).click();
  await expect(page.locator('.cv')).not.toHaveAttribute('data-run-id',reviewRunId);
  await expect(page.getByTestId('run-status')).toHaveAttribute('data-status','completed');
  await inspector.getByRole('button',{name:'Git changes',exact:true}).click();
  await expect(page.locator('.git-changes')).toContainText('Earlier findings remain below');await expect(page.locator('.git-finding')).toContainText('Fix the fixture bug');assert.equal(await readFile(join(project,'code.txt'),'utf8'),'bug\n');
  await rm(invalidFix);
  const previousFixId=await page.locator('.cv').getAttribute('data-run-id');
  await page.getByRole('button',{name:'Have Forge fix all',exact:true}).click();await expect(page.locator('.cv')).not.toHaveAttribute('data-run-id',previousFixId);await expect(page.locator('.cv-h .ttl b')).toContainText('Fix review findings');await expect(page.getByTestId('run-status')).toHaveAttribute('data-status','completed');
  await inspector.getByRole('button',{name:'Git changes',exact:true}).click();
  await page.getByRole('button',{name:'Review',exact:true}).click();await expect(page.locator('.git-changes')).toContainText('Fix run reports no remaining findings.');assert.equal(await readFile(join(project,'code.txt'),'utf8'),'fixed\n');
  await page.getByRole('button',{name:'Merge PR…',exact:true}).click();await expect(page.locator('.git-changes')).toContainText('Merge cancelled.');assert.equal(JSON.parse(await readFile(state)).state,'OPEN');
  await writeFile(state,JSON.stringify({...pr,statusCheckRollup:[{name:'checks',status:'IN_PROGRESS',conclusion:''}]}));
  await page.getByRole('button',{name:'Merge PR…',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Merge blocked');assert.equal(JSON.parse(await readFile(state)).state,'OPEN');
  await writeFile(state,JSON.stringify(pr));await desktop.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});});
  await page.getByRole('button',{name:'Merge PR…',exact:true}).click();await expect(page.locator('.git-changes')).toContainText('Merged PR #14.');assert.equal(JSON.parse(await readFile(state)).state,'MERGED');
  await page.screenshot({path:'artifacts/verification/git-merge.png'});
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,700));await expect.poll(()=>page.evaluate(()=>window.innerWidth)).toBe(1100);
  assert.equal(await page.locator('.insp').evaluate(el=>el.scrollWidth<=el.clientWidth),true);await page.screenshot({path:'artifacts/verification/git-small.png'});
  const history=await page.evaluate(()=>window.theseus.getRunHistory()),fix=history.runs.find(r=>r.gitWorkflow?.kind==='fix');assert.ok(fix);
  await desktop.close();desktop=undefined;page=await launch();
  const restored=await page.evaluate(()=>window.theseus.getRunHistory());assert.equal(restored.runs.find(r=>r.id===fix.id).gitWorkflow.kind,'fix');assert.equal(restored.runs.find(r=>r.id===fix.id).status,'completed');
  // The next run starts from committed HEAD in a managed worktree, preserving source edits.
  await writeFile(join(project,'code.txt'),'source local changes\n');
  await desktop.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},project);
  const ws=await page.evaluate(()=>window.theseus.selectWorkspace());
  await page.evaluate(location=>window.theseus.saveWorktreePreferences({location,removeMerged:false}),join(root,'worktrees'));
  const isolated=await page.evaluate(workspaceId=>window.theseus.startAgentRun({workspaceId,task:'Worktree fixture',useWorktree:true}),ws.id);
  const runs=()=>page.evaluate(()=>window.theseus.getRunHistory());
  await expect.poll(async()=>(await runs()).runs.find(r=>r.id===isolated.id)?.status).toBe('completed');
  const isolatedDone=(await runs()).runs.find(r=>r.id===isolated.id);assert.ok(isolatedDone.executionPath);
  assert.equal((await page.evaluate(runId=>window.theseus.getGitSnapshot({runId}),isolated.id)).path,isolatedDone.executionPath);
  const review=await page.evaluate(runId=>window.theseus.startGitWork({runId,kind:'review'}),isolated.id);
  await expect.poll(async()=>(await runs()).runs.find(r=>r.id===review.id)?.status).toBe('completed');
  await assert.rejects(()=>page.evaluate(({runId,reviewRunId})=>window.theseus.startGitWork({runId,reviewRunId,kind:'fix'}),{runId:fix.id,reviewRunId:review.id}));
  const fixed=await page.evaluate(({runId,reviewRunId})=>window.theseus.startGitWork({runId,reviewRunId,kind:'fix',findingIndex:0}),{runId:isolated.id,reviewRunId:review.id});
  await expect.poll(async()=>(await runs()).runs.find(r=>r.id===fixed.id)?.status).toBe('completed');
  assert.equal(await readFile(join(isolatedDone.executionPath,'code.txt'),'utf8'),'fixed\n');assert.equal(await readFile(join(project,'code.txt'),'utf8'),'source local changes\n');
  assert.deepEqual(errors,[]);
  console.log('Git Electron checks passed: actual changes/commits/PR/checks, open PR, read-only review, real fix, cancelled/blocked/confirmed merges, narrow layout, restart and isolated worktree targeting.');
}finally{await desktop?.close();await rm(root,{recursive:true,force:true});}
