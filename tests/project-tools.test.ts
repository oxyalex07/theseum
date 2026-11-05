import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, realpath, rm, symlink, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectTerminals } from '../electron/project-terminal';
import { localPreviewUrl, previewCandidates, projectTarget, terminalInput, terminalSize } from '../shared/project-tools';
const workspaceId='11111111-1111-1111-1111-111111111111';
describe('project tool boundary',()=>{
  it('accepts registered ID targets, bounded input and dimensions',()=>{
    expect(projectTarget({workspaceId,path:'/ignored'})).toEqual({workspaceId});
    expect(projectTarget({runId:workspaceId})).toEqual({runId:workspaceId});
    expect(terminalSize({cols:100,rows:30})).toEqual({cols:100,rows:30});
    expect(terminalInput({id:workspaceId,data:'\x03'}).data).toBe('\x03');
    for(const value of [null,[],{}, {workspaceId,runId:workspaceId},{workspaceId:'../../tmp'}])expect(()=>projectTarget(value)).toThrow();
    for(const size of [null,{}, {cols:Infinity,rows:24},{cols:0,rows:24},{cols:80,rows:201},{cols:80.5,rows:24}])expect(()=>terminalSize(size)).toThrow();
    for(const data of ['', 'a'.repeat(16001),'x\0'])expect(()=>terminalInput({id:workspaceId,data})).toThrow();
  });
  it('limits app URLs to explicit loopback origins and rejects credentials and protocols',()=>{
    expect(localPreviewUrl('http://localhost:5173/app?q=1')).toBe('http://localhost:5173/app?q=1');
    expect(localPreviewUrl('http://[::1]:3000')).toBe('http://[::1]:3000/');
    for(const value of ['https://example.com','http://localhost.evil:5173','file:///etc/passwd','javascript:alert(1)','http://user:secret@localhost','http://0.0.0.0:3000','http://192.168.1.1:80','http://localhost\n.evil','http:\\localhost:3000',null])expect(()=>localPreviewUrl(value)).toThrow();
    expect(previewCandidates('\x1b[32mLocal: http://localhost:5173/\x1b[0m\nhttp://127.0.0.1:3000/app\nhttps://example.com\nhttp://localhost:5173/')).toEqual(['http://127.0.0.1:3000/app','http://localhost:5173/']);
    expect(previewCandidates('http://localhost.evil:5173/ http://127.0.0.1.evil/')).toEqual([]);
  });
});
it('runs a real PTY with persistent input, dimensions, exit status and teardown',async()=>{
  const root=await realpath(await mkdtemp(join(tmpdir(),'theseus-pty-'))),terminals=new ProjectTerminals(()=>{}),key=`workspace:${workspaceId}`;
  try{
    const shell=await terminals.open(key,root,{cols:90,rows:31});
    expect((await terminals.open(key,root,{cols:90,rows:31})).id).toBe(shell.id);
    const command=process.platform==='win32'?`\"${process.execPath}\" probe.cjs\r`:`'${process.execPath.replaceAll("'","'\\''")}' probe.cjs\r`;
    await writeFile(join(root,'probe.cjs'),`console.log('PTY_OK:'+process.stdin.isTTY);console.log(process.stdout.rows+' '+process.stdout.columns);console.log(process.cwd());`);
    terminals.write(shell.id,command);
    await vi.waitFor(()=>expect(terminals.get(key)?.output).toContain('31 90'),{timeout:10000});
    expect(terminals.get(key)?.output).toContain('PTY_OK:true');expect(terminals.get(key)?.output).toContain(root);
    terminals.resize(shell.id,{cols:105,rows:35});terminals.write(shell.id,command);
    await vi.waitFor(()=>expect(terminals.get(key)?.output).toContain('35 105'));
    terminals.write(shell.id,'exit 7\r');await vi.waitFor(()=>expect(terminals.get(key)?.status).toBe('exited'),{timeout:10000});expect(terminals.get(key)?.exitCode).toBe(7);
    expect(()=>terminals.write(shell.id,'echo bad\r')).toThrow();
    const restarted=await terminals.open(key,root,{cols:80,rows:24});expect(restarted.id).not.toBe(shell.id);
    terminals.write(restarted.id,process.platform==='win32'?'ping -t 127.0.0.1\r':'sleep 60 &\r');
    await terminals.shutdown();expect(terminals.get(key)?.status).toBe('exited');
    const link=join(root,'link');await symlink(root,link,process.platform==='win32'?'junction':'dir');await expect(terminals.open('symlink',link,{cols:80,rows:24})).rejects.toThrow('moved or changed');
  }finally{await terminals.shutdown();await rm(root,{recursive:true,force:true});}
},30000);

it.each(process.platform==='win32'?['exit 7','kill-parent']:['exec /usr/bin/true','kill -KILL $$'])('retains owned children after shell ending %s',async ending=>{
  const root=await realpath(await mkdtemp(join(tmpdir(),'theseus-shell-exit-'))),terminals=new ProjectTerminals(()=>{}),key=`workspace:${workspaceId}`;let pid=0;
  try{
    await writeFile(join(root,'child.cjs'),`require('node:fs').writeFileSync('child.pid',String(process.pid));require('node:fs').writeFileSync('child-ready.json',JSON.stringify({pid:process.pid,ppid:process.ppid,cwd:process.cwd(),execPath:process.execPath}));setInterval(()=>{},1000);`);
    await writeFile(join(root,'spawn.cjs'),`const child=require('node:child_process').spawn(process.execPath,['child.cjs'],{stdio:['ignore',require('node:fs').openSync('child-output.log','a'),require('node:fs').openSync('child-output.log','a')]});require('node:fs').writeFileSync('child.pid',String(child.pid));child.unref();`);
    await writeFile(join(root,'kill-parent.cjs'),`process.kill(process.ppid,'SIGKILL');`);
    const command=(file:string)=>process.platform==='win32'?`"${process.execPath}" ${file}`:`'${process.execPath}' ${file}`;
    const shell=await terminals.open(key,root,{cols:80,rows:24});expect(terminals.protectedPaths()).toContain(root);
    // libuv kills non-detached children when a Windows Node launcher exits.
    // Use cmd's ordinary background job instead; no detached/breakaway flag.
    terminals.write(shell.id,(process.platform==='win32'?`start "" /B ${command('child.cjs')} > child-output.log 2>&1`:command('spawn.cjs'))+'\r');
    await vi.waitFor(async()=>{pid=Number(await readFile(join(root,'child.pid'),'utf8'));expect(pid).toBeGreaterThan(0);},{timeout:10000});
    try{await vi.waitFor(async()=>{expect(JSON.parse(await readFile(join(root,'child-ready.json'),'utf8')).pid).toBe(pid);process.kill(pid,0);},{timeout:10000});}
    catch(error){console.error('CHILD_START_DIAGNOSTICS',await readFile(join(root,'child-output.log'),'utf8'),terminals.get(key));throw error;}
    console.log('OWNED_CHILD_READY',await readFile(join(root,'child-ready.json'),'utf8'));
    terminals.write(shell.id,(ending==='kill-parent'?command('kill-parent.cjs'):ending)+'\r');
    await vi.waitFor(()=>expect(terminals.get(key)?.status).toBe('exited'),{timeout:10000});
    expect(()=>process.kill(pid,0)).toThrow();expect(terminals.protectedPaths()).toEqual([]);
    await terminals.shutdown();expect(()=>process.kill(pid,0)).toThrow();
    expect((await terminals.open(key,root,{cols:80,rows:24})).id).not.toBe(shell.id);
  }finally{await terminals.shutdown();if(pid)try{process.kill(pid,'SIGKILL');}catch{}await rm(root,{recursive:true,force:true});}
},30000);
