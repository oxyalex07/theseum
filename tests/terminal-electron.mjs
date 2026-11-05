import { _electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const root=await mkdtemp(join(tmpdir(),'orbit-terminal-'));const project=join(root,'project with spaces');await mkdir(project);await mkdir('artifacts/verification',{recursive:true});
let desktop;const errors=[];
async function launch(){const env={...process.env,THESEUS_USER_DATA_DIR:join(root,'profile')};delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_SAMPLE_PREVIEW;desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))errors.push(m.text());});await page.getByRole('button',{name:'Open your profile'}).waitFor();return page;}
async function state(page){return (await page.evaluate(()=>window.theseus.getTerminalState())).commands;}
async function run(page,command){await page.getByRole('textbox',{name:'Terminal command'}).fill(command);await page.getByRole('button',{name:'Run command',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('[data-terminal-id]').length>0);}
async function waitStatus(page,status,count){await expect.poll(async()=>{const commands=await state(page);return {count:commands.length,status:commands.at(-1)?.status};}).toEqual({count,status});}

try{
  let page=await launch();await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name:'Terminal',exact:true}).click();await page.getByRole('heading',{name:'Terminal',exact:true}).waitFor();assert.equal(await page.locator('.side,.insp').count(),0);assert.equal(await page.getByRole('button',{name:'Run command',exact:true}).isDisabled(),true);
  await assert.rejects(()=>page.evaluate(()=>window.theseus.startTerminalCommand({workspaceId:'11111111-1111-1111-1111-111111111111',command:'pwd'})));
  await desktop.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},project);
  await page.getByRole('button',{name:'Choose project folder',exact:true}).click();
  await run(page,"printf '%s' 'hello from Orbit' > result.txt\ncat result.txt\npwd");await waitStatus(page,'completed',1);assert.equal(await readFile(join(project,'result.txt'),'utf8'),'hello from Orbit');assert.ok((await state(page))[0].output.includes('hello from Orbit'));assert.ok((await state(page))[0].output.includes('project with spaces'));
  await run(page,"printf 'failure detail\\n' >&2\nexit 7");await waitStatus(page,'failed',2);assert.equal((await state(page))[1].exitCode,7,JSON.stringify((await state(page))[1]));assert.ok((await state(page))[1].output.includes('failure detail'));
  await run(page,"printf 'streaming before exit\\n'\nsleep 30 &\nprintf 'child:%s\\n' \"$!\"\nwait");await expect.poll(async()=>{const commands=await state(page);return commands.at(-1)?.output.includes('streaming before exit')&&commands.at(-1)?.status==='running';}).toBe(true);
  await expect.poll(async()=>/child:\d+/.test((await state(page)).at(-1)?.output??'')).toBe(true);
  const childPid=Number((await state(page)).at(-1).output.match(/child:(\d+)/)[1]);
  await assert.rejects(()=>page.evaluate(async()=>{const {workspace}=await window.theseus.getExecutionState();await window.theseus.startTerminalCommand({workspaceId:workspace.id,command:'pwd'});}));
  await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name:'Home',exact:true}).click();await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name:'Terminal',exact:true}).click();await page.getByRole('button',{name:'Cancel command',exact:true}).click();await waitStatus(page,'cancelled',3);await expect.poll(()=>{try{process.kill(childPid,0);return false;}catch{return true;}}).toBe(true);
  await run(page,'/usr/bin/yes x | /usr/bin/head -c 130000');await waitStatus(page,'completed',4);const truncated=(await state(page)).at(-1);assert.equal(truncated.truncated,true,JSON.stringify({command:truncated.command,status:truncated.status,code:truncated.exitCode,length:truncated.output.length,preview:truncated.output.slice(0,200),error:truncated.error}));assert.equal(truncated.output.length,120000);
  await run(page,'printf "terminal is ready\\n"');await waitStatus(page,'completed',5);await page.screenshot({path:'artifacts/verification/terminal-page.png'});
  await run(page,"printf 'stopping at shutdown\\n'\nsleep 30");await expect.poll(async()=>(await state(page)).at(-1)?.output.includes('stopping at shutdown')).toBe(true);
  await desktop.close();desktop=undefined;page=await launch();assert.equal((await state(page)).length,0);
  assert.deepEqual(errors,[]);console.log('PASS actual shell command/file write in disposable project, stderr/nonzero exit, live streaming, concurrent-run rejection, navigation/reconnect, cancellation, bounded output, follow-up command, shutdown and ephemeral history; no renderer errors');
}finally{await desktop?.close();await rm(root,{recursive:true,force:true});}
