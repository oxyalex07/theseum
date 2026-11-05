import { describe, expect, it } from 'vitest';
import { validateTerminalRequest } from '../shared/terminal';
describe('terminal requests',()=>{
  const workspaceId='11111111-1111-1111-1111-111111111111';
  it('accepts user-authored shell programs as data',()=>{
    const command='printf "%s" "a; b $(echo literal in script)"';
    expect(validateTerminalRequest({workspaceId,command})).toEqual({workspaceId,command});
  });
  it('rejects malformed identifiers, empty commands and oversized input',()=>{
    for(const input of [null,[],{}, {workspaceId:'../../tmp',command:'pwd'}, {workspaceId,command:''},{workspaceId,command:'  '},{workspaceId,command:'x\0y'},{workspaceId,command:'a'.repeat(16001)}])expect(()=>validateTerminalRequest(input)).toThrow();
  });
});

import { vi } from 'vitest';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CommandTerminal } from '../electron/terminal';
it('stops an over-time shell and keeps it failed rather than completed',async()=>{
  const path=await realpath(await mkdtemp(join(tmpdir(),'orbit-shell-timeout-')));
  const terminal=new CommandTerminal(()=>{},60);
  try{
    await terminal.start({id:'11111111-1111-1111-1111-111111111111',name:'test',path,entries:[],truncated:false},'sleep 30');
    await vi.waitFor(()=>expect(terminal.state().commands[0].status).toBe('failed'),{timeout:3000});
    expect(terminal.state().commands[0].error).toContain('time limit');
    expect(terminal.state().commands[0].endedAt).toBeDefined();
  }finally{await terminal.shutdown();await rm(path,{recursive:true,force:true});}
});
