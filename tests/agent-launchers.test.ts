import { describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { AgentLaunchers, launcherFields, terminalProgram } from '../electron/agent-launchers';
const fields={name:'Reviewer',description:'Review a project',repository:'https://github.com/example/reviewer.git',runtime:'claude',command:'claude --agent reviewer',folderChoice:'picked'};
function fixture(){const root=realpathSync(mkdtempSync(join(tmpdir(),'theseus-launchers-')));return {root,cleanup:()=>rmSync(root,{recursive:true,force:true})};}
describe('agent launcher library',()=>{
  it('persists edits, rejects stale versions and forged folder choices, and removes only shortcuts',async()=>{
    const {root,cleanup}=fixture();const programs:string[]=[];
    try{
      const library=new AgentLaunchers(root,'darwin',async program=>{programs.push(program);});
      expect(()=>library.save(fields,()=>undefined)).toThrow('Choose a working folder');
      let state=library.save(fields,id=>id==='picked'?root:undefined);
      const record=state.launchers[0];expect(record.repository).toBe('https://github.com/example/reviewer');
      expect(new AgentLaunchers(root).state().launchers).toEqual(state.launchers);
      expect(()=>library.save({...fields,id:record.id,expectedUpdatedAt:'stale',folderChoice:null},()=>undefined)).toThrow('changed');
      state=library.save({...fields,id:record.id,expectedUpdatedAt:record.updatedAt,folderChoice:null,name:'Updated'},()=>undefined);
      await expect(library.launch(record.id,record.updatedAt)).rejects.toThrow('changed');
      const updated=state.launchers[0];state=await library.launch(updated.id,updated.updatedAt);
      expect(programs).toEqual([terminalProgram(root,fields.command)]);expect(state.launchers[0].lastLaunchedAt).not.toBeNull();
      expect(()=>library.remove(updated.id,'stale')).toThrow('changed');
      expect(library.remove(updated.id,updated.updatedAt).launchers).toEqual([]);
      expect(new AgentLaunchers(root).state().launchers).toEqual([]);
    }finally{cleanup();}
  });
  it('preserves a damaged store and rejects edits',()=>{
    const {root,cleanup}=fixture();try{const file=join(root,'agent-launchers.json');writeFileSync(file,'broken original');const library=new AgentLaunchers(root);expect(library.state().warning).toContain('preserved');expect(()=>library.save(fields,()=>root)).toThrow();expect(readFileSync(file,'utf8')).toBe('broken original');}finally{cleanup();}
  });
  it('does not execute until launched, reports missing folders and terminal errors',async()=>{
    const {root,cleanup}=fixture();let opens=0;try{
      const library=new AgentLaunchers(root,'darwin',async()=>{opens++;throw new Error('Terminal unavailable');});
      const record=library.save(fields,()=>join(root,'missing')).launchers[0];expect(opens).toBe(0);
      await expect(library.launch(record.id,record.updatedAt)).rejects.toThrow('folder');expect(opens).toBe(0);
      const updated=library.save({...fields,id:record.id,expectedUpdatedAt:record.updatedAt},()=>root).launchers[0];
      await expect(library.launch(updated.id,updated.updatedAt)).rejects.toThrow('Terminal unavailable');expect(library.state().launchers[0].lastLaunchedAt).toBeNull();
      const unsupported=new AgentLaunchers(root,'linux');await expect(unsupported.launch(updated.id,updated.updatedAt)).rejects.toThrow('macOS');
    }finally{cleanup();}
  });
  it('quotes working folders as shell data, including quotes and command substitutions',()=>{
    const {root,cleanup}=fixture();try{
      const folder=join(root,"agent's $(touch SHOULD_NOT_EXIST)");mkdirSync(folder);
      const program=terminalProgram(folder,'pwd\nprintf "works\\n"');
      const output=execFileSync('/bin/zsh',['-f','-c',program],{encoding:'utf8'});
      expect(output.trim()).toBe(`${folder}\nworks`);
    }finally{cleanup();}
  });
  it('rejects unsafe repository URLs and invalid commands',()=>{
    for(const repository of ['file:///tmp/x','https://github.com.evil.test/o/r','https://a:b@github.com/o/r','https://github.com/o/r?token=x','https://github.com/o/r/tree/main','https://github.com/o'])expect(()=>launcherFields({...fields,repository})).toThrow('GitHub');
    for(const command of ['', 'x\0y','x'.repeat(8001)])expect(()=>launcherFields({...fields,command})).toThrow();
  });
});
