// Real Electron/preload/storage/UI with deterministic public GitHub responses. No model calls.
import { _electron, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const root=await mkdtemp(join(tmpdir(),'theseus-github-ui-'));
const content='---\nname: Code reviewer\ndescription: Reviews changes and explains what to fix.\ntools: Read, Bash\nmodel: provider-specific-model\n---\n# Code review\n\nReview the selected project for correctness and maintainability.\n\n- Read the changed code and its surrounding context.\n- Identify bugs and explain their impact.\n- Suggest focused fixes and relevant checks.\n- Report findings with file references.\n';
const bytes=Buffer.from(content),sha=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const commit='a'.repeat(40),tree='b'.repeat(40);
let desktop;const errors=[];
await mkdir('artifacts/verification',{recursive:true});
async function launch(){
  const env={...process.env,THESEUS_USER_DATA_DIR:join(root,'profile')};delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_SAMPLE_PREVIEW;
  desktop=await _electron.launch({args:['.'],env});
  const page=await desktop.firstWindow();page.on('pageerror',error=>errors.push(error.message));
  await page.getByRole('button',{name:'Open your profile'}).waitFor();
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,900));
  await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name:'Agents',exact:true}).click();
  return page;
}
try{
  let page=await launch();
  await desktop.evaluate((_electron,fixture)=>{
    globalThis.fetch=async url=>{
      const path=String(url);
      if(path.includes('/missing/'))return new Response('',{status:404});
      if(path.includes('/empty/'))return Response.json(path.includes('/git/trees/')?{truncated:false,tree:[]}:path.includes('/commits/')?{sha:fixture.commit,commit:{tree:{sha:fixture.tree}}}:{default_branch:'main'});
      const data=path.endsWith('/example/agents')?{default_branch:'main'}:path.includes('/commits/')?{sha:fixture.commit,commit:{tree:{sha:fixture.tree}}}:path.includes('/git/trees/')?{truncated:false,tree:[
        {type:'blob',mode:'100644',path:'.claude/agents/code-reviewer.md',sha:fixture.sha,size:fixture.size},
        {type:'blob',mode:'100644',path:'research/research-assistant.md',sha:fixture.sha,size:fixture.size},
        {type:'blob',mode:'100644',path:'README.md',sha:fixture.sha,size:fixture.size},
        {type:'blob',mode:'100644',path:'oversized.md',sha:fixture.sha,size:200000},
      ]}:{encoding:'base64',content:fixture.content};
      return Response.json(data);
    };
  },{commit,tree,sha,size:bytes.length,content:bytes.toString('base64')});
  await page.getByRole('button',{name:'Add from GitHub',exact:true}).click();
  await page.getByLabel('GitHub repository',{exact:true}).fill('https://evil.test/repo/agents');
  await page.getByRole('button',{name:'Find agents',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Enter a repository');
  await page.getByLabel('GitHub repository',{exact:true}).fill('missing/agents');
  await page.getByRole('button',{name:'Find agents',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Only public repositories');
  await page.getByLabel('GitHub repository',{exact:true}).fill('empty/agents');
  await page.getByRole('button',{name:'Find agents',exact:true}).click();
  await expect(page.getByRole('heading',{name:'No Markdown instructions found'})).toBeVisible();
  await page.getByLabel('GitHub repository',{exact:true}).fill('https://github.com/example/agents');
  await page.getByRole('button',{name:'Find agents',exact:true}).click();
  await expect(page.getByRole('button',{name:/oversized.md/})).toBeDisabled();
  await page.getByLabel('Choose an instruction file').fill('code-reviewer');
  await expect(page.getByRole('button',{name:/research-assistant.md/})).toHaveCount(0);
  await page.getByLabel('Choose an instruction file').fill('');
  await page.getByRole('button',{name:/.claude\/agents\/code-reviewer.md/}).click();
  await expect(page.getByLabel('Agent name',{exact:true})).toHaveValue('Code reviewer');
  await expect(page.getByLabel('Project access',{exact:true})).toHaveValue('read-only');
  await expect(page.getByLabel('Instructions to import')).toHaveValue(/# Code review/);
  assert.equal((await page.getByLabel('Instructions to import').inputValue()).includes('provider-specific-model'),false);
  await expect(page.getByText('Runs with Codex in Theseus',{exact:true})).toBeVisible();
  // Switching files clears the previous preview before another can be saved.
  await page.getByRole('button',{name:/research\/research-assistant.md/}).click();
  await expect(page.locator('.github-agent-preview').getByText('research/research-assistant.md',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:/.claude\/agents\/code-reviewer.md/}).click();
  await expect(page.getByRole('heading',{name:'Review your agent'})).toBeVisible();
  await page.getByLabel('Agent name',{exact:true}).fill('My code reviewer');
  await page.getByLabel('Project access',{exact:true}).selectOption('workspace-write');
  await page.locator('.page').evaluate(element=>{element.scrollTop=0;});
  await page.screenshot({path:'artifacts/verification/github-agent-import.png'});
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,700));
  await page.locator('.page').evaluate(element=>{element.scrollTop=0;});
  await page.screenshot({path:'artifacts/verification/github-agent-import-minimum.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.locator('.github-import').evaluate(element=>element.scrollWidth>element.clientWidth),false);
  await page.getByRole('button',{name:'Add agent',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:'artifacts/verification/github-agent-import-review.png'});
  await page.getByRole('button',{name:'Add agent',exact:true}).click();
  await expect(page.getByText('My code reviewer',{exact:true})).toBeVisible();
  let profiles=(await page.evaluate(()=>window.theseus.listAgentProfiles())).profiles;
  assert.equal(profiles.length,1);assert.equal(profiles[0].githubSource.commit,commit);assert.equal(profiles[0].githubSource.path,'.claude/agents/code-reviewer.md');assert.equal(profiles[0].sandbox,'workspace-write');assert.equal(profiles[0].runtime,'codex');assert.equal(profiles[0].model,null);assert.equal(profiles[0].instructions.includes('Review the selected project'),true);
  await page.getByRole('button',{name:'Edit',exact:true}).click();
  await expect(page.getByLabel('Agent instructions',{exact:true})).toHaveValue(profiles[0].instructions);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Use agent',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Start a task',exact:true})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Run agent',exact:true})).toHaveValue(profiles[0].id);
  await desktop.close();desktop=undefined;
  page=await launch();await expect(page.getByText('My code reviewer',{exact:true})).toBeVisible();
  profiles=(await page.evaluate(()=>window.theseus.listAgentProfiles())).profiles;assert.equal(profiles[0].githubSource.commit,commit);
  await page.screenshot({path:'artifacts/verification/github-agent-saved.png'});
  await page.getByRole('button',{name:'Add from GitHub',exact:true}).click();
  await page.getByRole('button',{name:'Cancel import',exact:true}).click();assert.equal((await page.evaluate(()=>window.theseus.listAgentProfiles())).profiles.length,1);
  assert.deepEqual(errors,[]);
  console.log('PASS GitHub import: real preload, error recovery, empty/search/preview/access, create/edit/use agent, restart persistence, and 1440/1100 layout. GitHub fixtures; no model calls.');
}finally{await desktop?.close();await rm(root,{recursive:true,force:true});}
