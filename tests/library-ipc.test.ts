import { describe, expect, it } from 'vitest';
import { libraryRequest } from '../electron/library-ipc';
const workspaceId='11111111-1111-4111-8111-111111111111';
describe('Library IPC requests',()=>{
  it('requires an opaque project ID and bounded text search',()=>{
    expect(libraryRequest({workspaceId,search:'README'},'query')).toMatchObject({workspaceId,search:'README'});
    for(const input of [null,[],{}, {workspaceId:'/etc'}, {workspaceId,search:42},{workspaceId,search:'x'.repeat(501)},{workspaceId,path:'/etc/passwd'}])expect(()=>libraryRequest(input,'query')).toThrow();
  });
  it('requires native file/folder selection and never accepts renderer-supplied paths',()=>{
    for(const input of [{workspaceId,kind:'all'}, {workspaceId,kind:'files',paths:['/etc/passwd']},{workspaceId,kind:'folder',path:'/etc'}])expect(()=>libraryRequest(input,'import')).toThrow();
    expect(libraryRequest({workspaceId,kind:'files'},'import').kind).toBe('files');
  });
  it('validates scoped import removal and file inspection IDs',()=>{
    expect(libraryRequest({workspaceId,sourceId:workspaceId},'remove').sourceId).toBe(workspaceId);
    expect(libraryRequest({workspaceId,fileId:'a'.repeat(64)},'inspect').fileId).toBe('a'.repeat(64));
    for(const operation of ['remove','inspect'] as const)expect(()=>libraryRequest({workspaceId,sourceId:'../file',fileId:'/etc/passwd'},operation)).toThrow();
    expect(()=>libraryRequest({workspaceId,all:true},'clear')).toThrow();
  });
});
