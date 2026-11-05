// Focused native acceptance: production Electron + real PTYs; no provider fixture/calls.
import { _electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
const root=await realpath(await mkdtemp(join(tmpdir(),'theseus-platform-'))),project=join(root,'project with spaces');await mkdir(project);
await mkdir('artifacts/verification',{recursive:true});
const win=process.platform==='win32',quote=s=>win?'"'+s.replaceAll('"','""')+'"':"'"+s.replaceAll("'","'\\''")+"'";
const node=file=>`${quote(process.execPath)} ${quote(file)}`;
await writeFile(join(project,'probe.cjs'),`console.log('NATIVE:'+JSON.stringify({tty:!!process.stdin.isTTY,cwd:process.cwd(),cols:process.stdout.columns,rows:process.stdout.rows}));const r=require('node:readline').createInterface({input:process.stdin,output:process.stdout});r.question('INPUT>',answer=>{console.log('ANSWER:'+answer);r.close();});`);
await writeFile(join(project,'recovered.cjs'),`console.log('CTRL_C_RECOVERED');`);
await writeFile(join(project,'wait.cjs'),`console.log('WAITING:'+process.pid);setInterval(()=>{},1000);`);
await writeFile(join(project,'child.cjs'),`require('node:fs').writeFileSync('child.pid',String(process.pid));require('node:fs').writeFileSync('child-ready.json',JSON.stringify({pid:process.pid,ppid:process.ppid,cwd:process.cwd(),execPath:process.execPath}));setInterval(()=>{},1000);`);
await writeFile(join(project,'spawn.cjs'),`const {spawn}=require('node:child_process');const child=spawn(process.execPath,['child.cjs'],{stdio:['ignore',require('node:fs').openSync('child-output.log','a'),require('node:fs').openSync('child-output.log','a')]});require('node:fs').writeFileSync('child.pid',String(child.pid));console.log('CHILD:'+child.pid);child.unref();`);
await writeFile(join(project,'kill-parent.cjs'),`process.kill(process.ppid,'SIGKILL');`);
await writeFile(join(project,'flood.cjs'),`console.log('x'.repeat(140000));console.log('FLOOD_DONE');`);
const server=createServer((_q,res)=>res.end('<title>Native preview</title><h1>Native HTTP app</h1>'));await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
const env={...process.env,THESEUS_USER_DATA_DIR:join(root,'profile')};delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_SAMPLE_PREVIEW;
let desktop,page,target;const pids=[];const results=[];
const dead=pid=>{try{process.kill(pid,0);return false;}catch{return true;}};
const state=()=>page.evaluate(t=>window.theseus.getProjectShell(t),target);
const open=()=>page.evaluate(t=>window.theseus.openProjectShell({target:t,size:{cols:90,rows:31}}),target);
const write=(id,data)=>page.evaluate(r=>window.theseus.writeProjectShell(r),{id,data});
const visible=()=>desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.filter(v=>v.webContents).some(v=>v.getVisible()));
async function launch(){desktop=await _electron.launch({args:['.'],env,timeout:60000});page=await desktop.firstWindow();await page.getByRole('button',{name:'Open your profile'}).waitFor();await desktop.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},project);const ws=await page.evaluate(()=>window.theseus.selectWorkspace());target={workspaceId:ws.id};}
async function child(id){await rm(join(project,'child.pid'),{force:true});await rm(join(project,'child-ready.json'),{force:true});await write(id,(win?`start "" /B ${node('child.cjs')} > child-output.log 2>&1`:node('spawn.cjs'))+'\r');let pid;await expect.poll(async()=>{try{pid=Number(await readFile(join(project,'child.pid'),'utf8'));return pid>0;}catch{return false;}},{timeout:10000}).toBe(true);pids.push(pid);try{await expect.poll(async()=>{try{return JSON.parse(await readFile(join(project,'child-ready.json'),'utf8')).pid===pid&&!dead(pid);}catch{return false;}},{timeout:10000}).toBe(true);}catch(error){console.error('CHILD_START_DIAGNOSTICS',await readFile(join(project,'child-output.log'),'utf8'),await state());throw error;}console.log('OWNED_CHILD_READY',await readFile(join(project,'child-ready.json'),'utf8'));assert.equal(dead(pid),false);return pid;}
try{
  await launch();let s=await open();assert.equal(s.projectPath,project);assert.equal((await open()).id,s.id);
  // The shell creates the sentinel only after the readline process exits.
  // Its answer output alone does not mean stdin ownership has returned.
  const probe=()=>write(s.id,node('probe.cjs')+' && echo done > probe-exited\r');
  const probeExited=()=>expect.poll(async()=>{try{return (await readFile(join(project,'probe-exited'),'utf8')).trim();}catch{return '';}},{timeout:10000}).toBe('done');
  await probe();await expect.poll(async()=>(await state()).output.includes('INPUT>'),{timeout:10000}).toBe(true);
  let output=(await state()).output;assert.ok(output.includes('"tty":true'));assert.ok(output.includes('"cols":90'));assert.ok(output.includes('"rows":31'));assert.ok(output.includes(JSON.stringify(project).slice(1,-1)));
  await write(s.id,'native answer\r');await probeExited();await expect.poll(async()=>(await state()).output.includes('ANSWER:native answer')).toBe(true);
  await page.evaluate(id=>window.theseus.resizeProjectShell({id,size:{cols:105,rows:35}}),s.id);await rm(join(project,'probe-exited'));await probe();await expect.poll(async()=>(await state()).output.includes('"cols":105')).toBe(true);assert.ok((await state()).output.includes('"rows":35'));await write(s.id,'resized\r');await probeExited();
  await write(s.id,node('wait.cjs')+'\r');await expect.poll(async()=>(await state()).output.includes('WAITING:')).toBe(true);const foreground=Number((await state()).output.match(/WAITING:(\d+)/)[1]);pids.push(foreground);await write(s.id,'\x03');await expect.poll(()=>dead(foreground)).toBe(true);await write(s.id,node('recovered.cjs')+'\r');await expect.poll(async()=>(await state()).output.includes('CTRL_C_RECOVERED\r\n')).toBe(true);
  await write(s.id,node('flood.cjs')+'\r');await expect.poll(async()=>(await state()).output.includes('FLOOD_DONE'),{timeout:15000}).toBe(true);s=await state();assert.ok(s.output.length<=120000);assert.ok(s.outputStart>0);
  await page.reload();await page.getByRole('button',{name:'Open your profile'}).waitFor();assert.equal((await state()).id,s.id);
  const closePid=await child(s.id);await page.evaluate(id=>window.theseus.closeProjectShell(id),s.id);await expect.poll(()=>dead(closePid)).toBe(true);assert.equal((await state()).status,'exited');results.push('input/read/resize/Ctrl+C/bounded output/reconnect/explicit close');
  // Both normal exit and abrupt shell death must clean ordinary background jobs
  // before reporting exited; then Stop all and quit must remain idempotent.
  for(const ending of win?['exit 7',node('kill-parent.cjs')]:['exec /usr/bin/true','kill -KILL $$']){
    s=await open();let pid;
    if(win){pid=await child(s.id);await write(s.id,ending+'\r');}
    else {await rm(join(project,'child.pid'),{force:true});await write(s.id,`sleep 120 & echo $! > child.pid; ${ending}\r`);await expect.poll(async()=>{try{pid=Number(await readFile(join(project,'child.pid'),'utf8'));return pid>0;}catch{return false;}}).toBe(true);pids.push(pid);}await expect.poll(async()=>(await state()).status,{timeout:15000}).toBe('exited');assert.equal(dead(pid),true);await page.evaluate(()=>window.theseus.stopAllExecution());assert.equal(dead(pid),true);assert.notEqual((await open()).id,s.id);await page.evaluate(()=>window.theseus.stopAllExecution());results.push(`shell ending ${ending}: child dead before exited and after Stop all`);
  }
  s=await open();const stopPid=await child(s.id);await page.evaluate(()=>window.theseus.stopAllExecution());await expect.poll(()=>dead(stopPid)).toBe(true);
  // Main must revoke a native child even without a React unmount cleanup.
  await page.evaluate(({target,url})=>window.theseus.openProjectPreview({target,url}),{target,url});
  const acquire=()=>page.evaluate(target=>window.theseus.setProjectPreviewBounds({target,bounds:{x:10,y:100,width:600,height:300}}),target);await acquire();await expect.poll(visible).toBe(true);
  assert.equal(await desktop.evaluate(async({webContents})=>webContents.getAllWebContents().find(w=>!w.getLastWebPreferences().preload).executeJavaScript('document.querySelector("h1").textContent')),'Native HTTP app');
  await page.reload();await page.getByRole('button',{name:'Open your profile'}).waitFor();assert.equal(await page.locator('.project-preview').count(),0);await expect.poll(visible).toBe(false);
  await acquire();await expect.poll(visible).toBe(true);assert.equal((await page.evaluate(()=>window.theseus.getProjectPreview())).url,url+'/');
  s=await open();const quitPid=await child(s.id);
  const crash=await desktop.evaluate(({BrowserWindow})=>new Promise((resolve,reject)=>{const wc=BrowserWindow.getAllWindows()[0].webContents;const timer=setTimeout(()=>reject(new Error('Native renderer did not report process loss')),30000);wc.once('render-process-gone',(_event,details)=>{clearTimeout(timer);resolve(details);});wc.forcefullyCrashRenderer();}));console.log('RENDERER_LOSS',crash);assert.equal(await visible(),false);results.push('real local HTTP preview/Home navigation/reacquisition/renderer crash');
  await desktop.close();desktop=undefined;await expect.poll(()=>dead(quitPid)).toBe(true);for(const pid of pids)assert.equal(dead(pid),true);results.push('live background job quit teardown');
  await writeFile(`artifacts/verification/project-platform-${process.platform}.json`,JSON.stringify({platform:process.platform,arch:process.arch,results},null,2));console.log('PASS native '+process.platform+': '+results.join('; '));
}catch(error){if(desktop&&page&&!page.isClosed()){try{const snapshot=await state();console.error('NATIVE_FAILURE_SHELL',JSON.stringify({...snapshot,output:snapshot?.output.slice(-6000)}));}catch{}}throw error;}finally{await desktop?.close();for(const pid of pids)if(!dead(pid))try{process.kill(pid,'SIGKILL');}catch{}server.closeAllConnections();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
