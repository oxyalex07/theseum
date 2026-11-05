import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, chmod, rename, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { LibraryIndex, LIBRARY_LIMITS } from '../electron/library-index';

const directories:string[]=[];
async function fixture(){const root=await realpath(await mkdtemp(join(tmpdir(),'theseus-library-')));directories.push(root);const project=join(root,'project'),storage=join(root,'storage');await mkdir(project);await mkdir(storage);return {root,project,storage,index:new LibraryIndex(storage)};}
afterEach(async()=>{for(const path of directories.splice(0))await rm(path,{recursive:true,force:true});});
describe('project Library index',()=>{
  it('starts empty, indexes only explicit selections, and persists selections without copying content',async()=>{
    const {index,project,storage}=await fixture();await writeFile(join(project,'selected.md'),'PRIVATE_INDEX_SENTINEL');await writeFile(join(project,'other.md'),'unselected');
    expect((await index.query(project)).files).toEqual([]);
    const imported=await index.import(project,[join(project,'selected.md')],'files');expect(imported.sources).toHaveLength(1);expect(imported.files.map(file=>file.path)).toEqual(['selected.md']);
    expect(await readFile(index.file,'utf8')).not.toContain('PRIVATE_INDEX_SENTINEL');
    const restored=await new LibraryIndex(storage).query(project,'private_index');expect(restored.files).toHaveLength(1);expect(restored.files[0].snippet).toBe('PRIVATE_INDEX_SENTINEL');
  });
  it('searches filenames and content case-insensitively and returns a relevant line with plain-text inspection',async()=>{
    const {index,project}=await fixture();await writeFile(join(project,'notes.md'),'Intro\nA useful Needle here\n<script>unsafe()</script>');
    await index.import(project,[project],'folder');const result=await index.query(project,'NEEDLE');expect(result.files[0]).toMatchObject({path:'notes.md',line:2,snippet:'A useful Needle here'});
    expect((await index.query(project,'NOTES.MD')).matchingFiles).toBe(1);expect((await index.query(project,'missing')).files).toEqual([]);
    expect((await index.inspect(project,result.files[0].id)).content).toContain('<script>unsafe()</script>');
  });
  it('keeps original line and excerpt offsets after Unicode lowercase expansions and surrogate pairs',async()=>{
    const {index,project}=await fixture(),content='😀İİİİİİİ\nA NeEdLe here\nfooter\nΟΣ';
    await writeFile(join(project,'unicode.md'),content);await index.import(project,[project],'folder');
    const result=await index.query(project,'NEEDLE');expect(result.files[0]).toMatchObject({line:2,snippet:'A NeEdLe here'});
    expect((await index.inspect(project,result.files[0].id)).content).toBe(content);
    expect((await index.query(project,'İ')).files[0]).toMatchObject({line:1,snippet:'😀İİİİİİİ'});
    expect((await index.query(project,'ος')).files[0]).toMatchObject({line:4,snippet:'ΟΣ'});
  });
  it.each(['created','renamed'])('retains a file selection when a directory is %s at its path, across query, inspection and restart',async(replacement)=>{
    const {index,project,root,storage}=await fixture(),selected=join(project,'selected.md'),other=join(root,'other');
    await mkdir(other);await writeFile(join(other,'keep.md'),'OTHER_PROJECT_SENTINEL');await index.import(other,[other],'folder');
    await writeFile(selected,'SELECTED_FILE_SENTINEL');const initial=await index.import(project,[selected],'files'),id=initial.files[0].id;
    await rm(selected);
    if(replacement==='created')await mkdir(selected);
    else {await mkdir(join(project,'replacement'));await rename(join(project,'replacement'),selected);}
    await writeFile(join(selected,'unselected.txt'),'UNSELECTED_DESCENDANT_SENTINEL');
    const descendantId=createHash('sha256').update('selected.md/unselected.txt').digest('hex');
    for(const service of [index,new LibraryIndex(storage)]) {
      const state=await service.query(project);expect(state.warning).toBeUndefined();expect(state.sources).toEqual(initial.sources);
      expect(state.files).toEqual([expect.objectContaining({path:'selected.md',status:'unsupported'})]);
      expect((await service.query(project,'UNSELECTED_DESCENDANT_SENTINEL')).files).toEqual([]);
      expect((await service.query(project,'SELECTED_FILE_SENTINEL')).files).toEqual([]);
      expect(await service.inspect(project,id)).toMatchObject({content:null,file:{status:'unsupported'}});
      await expect(service.inspect(project,descendantId)).rejects.toThrow(/no longer imported/);
      expect((await service.query(other,'OTHER_PROJECT_SENTINEL')).indexedFiles).toBe(1);
      expect((await service.query(project,'OTHER_PROJECT_SENTINEL')).files).toEqual([]);
    }
    const persisted=JSON.parse(await readFile(index.file,'utf8'));expect(persisted.projects.find((value:{path:string})=>value.path===project).known).toEqual(['selected.md']);
    const restarted=new LibraryIndex(storage);await rm(selected,{recursive:true});await writeFile(selected,'RESTORED_FILE_SENTINEL');
    expect((await restarted.query(project,'restored_file')).files[0]).toMatchObject({id,path:'selected.md',status:'indexed'});
    expect((await restarted.inspect(project,id)).content).toBe('RESTORED_FILE_SENTINEL');
    await restarted.remove(project,initial.sources[0].id);expect((await new LibraryIndex(storage).query(other)).indexedFiles).toBe(1);
  });
  it('retains a folder selection when replaced by a file and recovers the restored folder',async()=>{
    const {index,project,storage}=await fixture(),folder=join(project,'docs');await mkdir(folder);await writeFile(join(folder,'a.md'),'original');
    const initial=await index.import(project,[folder],'folder');await rm(folder,{recursive:true});await writeFile(folder,'UNSELECTED_REPLACEMENT_SENTINEL');
    const state=await index.query(project);expect(state.sources[0].kind).toBe('folder');expect(state.files.find(file=>file.path==='docs')?.status).toBe('unsupported');
    expect((await index.query(project,'UNSELECTED_REPLACEMENT_SENTINEL')).files).toEqual([]);expect((await index.inspect(project,initial.files[0].id)).content).toBeNull();
    await rm(folder);await mkdir(folder);await writeFile(join(folder,'a.md'),'restored');expect((await new LibraryIndex(storage).inspect(project,initial.files[0].id)).content).toBe('restored');
  });
  it('refuses to save computed known paths outside retained selections without damaging storage',async()=>{
    const {index,project,storage}=await fixture();await writeFile(join(project,'selected.md'),'selected');await index.import(project,[join(project,'selected.md')],'files');
    const original=await readFile(index.file,'utf8'),projectData=JSON.parse(original).projects[0];
    // Inject a bad computed result at the persistence boundary to verify that a
    // future scan regression cannot produce a manifest that rejects on restart.
    projectData.known.push('selected.md/unselected.txt');
    await expect((index as unknown as {commit(value:unknown):Promise<void>}).commit(projectData)).rejects.toThrow(/retained imports/);
    expect(await readFile(index.file,'utf8')).toBe(original);expect((await new LibraryIndex(storage).query(project)).warning).toBeUndefined();
  });
  it('rereads changed files for search and inspection, removes stale text and discovers new files in imported folders',async()=>{
    const {index,project}=await fixture();const path=join(project,'notes.txt');await writeFile(path,'old needle');
    const original=await index.import(project,[project],'folder'),id=original.files[0].id;
    await writeFile(path,'new needle');expect((await index.query(project,'old needle')).files).toEqual([]);expect((await index.inspect(project,id)).content).toBe('new needle');
    await writeFile(join(project,'new.ts'),'new discovery');expect((await index.query(project,'discovery')).files[0].path).toBe('new.ts');
  });
  it('reports removed/moved files through restart, exposes no stale content, and recovers restored files',async()=>{
    const {index,project,storage}=await fixture(),path=join(project,'gone.txt');await writeFile(path,'secret old text');
    const original=await index.import(project,[project],'folder');await rm(path);
    expect((await index.query(project,'secret old')).files).toEqual([]);
    expect((await new LibraryIndex(storage).query(project)).files[0].status).toBe('removed');
    expect(await index.inspect(project,original.files[0].id)).toMatchObject({content:null,file:{status:'removed'}});
    await writeFile(path,'restored');expect((await index.inspect(project,original.files[0].id)).content).toBe('restored');
  });
  it('reports inaccessible files, replaces cached text with no content, and recovers permissions',async()=>{
    const {index,project}=await fixture(),path=join(project,'restricted.md');await writeFile(path,'before permissions');
    const initial=await index.import(project,[project],'folder');await chmod(path,0);
    try {expect((await index.query(project)).files[0].status).toBe('inaccessible');expect((await index.inspect(project,initial.files[0].id)).content).toBeNull();}
    finally{await chmod(path,0o600);}
    expect((await index.query(project)).files[0].status).toBe('indexed');
  });
  it('reports unsupported, binary, invalid UTF-8, oversized and excluded content without searching it',async()=>{
    const {index,project}=await fixture();
    await writeFile(join(project,'photo.png'),'image private sentinel');await writeFile(join(project,'binary.txt'),Buffer.from([0,1,2,3]));await writeFile(join(project,'invalid.txt'),Buffer.from([0xff,0xfe]));
    await writeFile(join(project,'huge.txt'),'x'.repeat(LIBRARY_LIMITS.fileBytes+1));await writeFile(join(project,'.env'),'ENV_PRIVATE_SENTINEL');await mkdir(join(project,'node_modules'));await writeFile(join(project,'node_modules','private.ts'),'DEPENDENCY_PRIVATE_SENTINEL');
    const state=await index.import(project,[project],'folder');expect(state.files.find(file=>file.path==='huge.txt')?.status).toBe('too-large');
    for(const path of ['photo.png','binary.txt','invalid.txt','.env','node_modules'])expect(state.files.find(file=>file.path===path)?.status).toBe('unsupported');
    expect((await index.query(project,'PRIVATE_SENTINEL')).files).toEqual([]);expect(state.files.some(file=>file.path==='node_modules/private.ts')).toBe(false);
  });
  it('supports empty and exactly-at-limit UTF-8 files',async()=>{
    const {index,project}=await fixture();await writeFile(join(project,'empty.txt'),'');await writeFile(join(project,'full.txt'),'x'.repeat(LIBRARY_LIMITS.fileBytes));
    const state=await index.import(project,[project],'folder');expect(state.indexedFiles).toBe(2);expect((await index.inspect(project,state.files.find(file=>file.path==='empty.txt')!.id)).content).toBe('');
  });
  it('rejects outside, sibling-prefix, relative, traversal and mixed-validity picker selections atomically',async()=>{
    const {index,project,root}=await fixture();await writeFile(join(project,'ok.md'),'ok');await mkdir(join(root,'project-other'));await writeFile(join(root,'project-other','outside.md'),'outside');
    for(const path of [join(root,'outside.md'),join(root,'project-other','outside.md'),'../outside',`${project}/../outside.md`])await expect(index.import(project,[join(project,'ok.md'),path],'files')).rejects.toThrow();
    expect((await index.query(project)).sources).toEqual([]);
  });
  it('rejects explicitly selected symlinks, including links inside the project and symlinked ancestors',async()=>{
    const {index,project,root}=await fixture();await writeFile(join(project,'real.md'),'real');await symlink(join(project,'real.md'),join(project,'link.md'));
    await mkdir(join(root,'outside'));await writeFile(join(root,'outside','secret.md'),'OUTSIDE_SECRET');await symlink(join(root,'outside'),join(project,'linked-folder'));
    await expect(index.import(project,[join(project,'link.md')],'files')).rejects.toThrow(/symlink/i);
    await expect(index.import(project,[join(project,'linked-folder','secret.md')],'files')).rejects.toThrow(/symlink/i);
    const state=await index.import(project,[project],'folder');expect(state.files.find(file=>file.path==='linked-folder')?.status).toBe('unsupported');expect((await index.query(project,'OUTSIDE_SECRET')).files).toEqual([]);
  });
  it('stops exposing text when a selected file or ancestor is replaced with a symlink',async()=>{
    const {index,project,root}=await fixture();await mkdir(join(project,'docs'));const path=join(project,'docs','a.md');await writeFile(path,'original');await writeFile(join(root,'outside.md'),'OUTSIDE_SENTINEL');
    const state=await index.import(project,[project],'folder'),id=state.files[0].id;await rm(path);await symlink(join(root,'outside.md'),path);
    expect((await index.inspect(project,id)).content).toBeNull();expect((await index.query(project,'OUTSIDE_SENTINEL')).files).toEqual([]);
    await rm(join(project,'docs'),{recursive:true});await mkdir(join(root,'outside'));await writeFile(join(root,'outside','a.md'),'OUTSIDE_SENTINEL');await symlink(join(root,'outside'),join(project,'docs'));
    expect((await index.inspect(project,id)).content).toBeNull();
  });
  it('fails closed when the whole project is moved and replaced with a symlink',async()=>{
    const {index,project,root}=await fixture();await writeFile(join(project,'a.md'),'old text');const state=await index.import(project,[project],'folder');await rename(project,join(root,'moved'));await symlink(join(root,'moved'),project);
    expect((await index.inspect(project,state.files[0].id)).content).toBeNull();await expect(index.import(project,[project],'folder')).rejects.toThrow(/symlink/i);
  });
  it('never crosses project scope for search, inspection, removal or clear, including overlapping imports',async()=>{
    const {index,project,root,storage}=await fixture(),other=join(root,'other');await mkdir(other);await writeFile(join(project,'a.md'),'first');await writeFile(join(other,'a.md'),'second');
    await index.import(project,[project],'folder');let state=await index.import(project,[join(project,'a.md')],'files');const otherState=await index.import(other,[other],'folder');
    await expect(index.remove(project,otherState.sources[0].id)).rejects.toThrow(/project/);expect((await index.query(other,'first')).files).toEqual([]);
    state=await index.remove(project,state.sources[0].id);expect(state.files).toHaveLength(1);expect((await index.inspect(other,state.files[0].id)).content).toBe('second');
    await index.clear(project);expect((await index.query(project)).files).toEqual([]);await expect(index.inspect(project,state.files[0].id)).rejects.toThrow(/no longer imported/);
    expect((await new LibraryIndex(storage).query(other)).indexedFiles).toBe(1);expect(await readFile(join(project,'a.md'),'utf8')).toBe('first');
  });
  it('bounds project bytes and search results and never exposes over-budget content through inspection',async()=>{
    const {index,project}=await fixture();for(let i=0;i<34;i++)await writeFile(join(project,`${i}.txt`),'x'.repeat(LIBRARY_LIMITS.fileBytes));
    const state=await index.import(project,[project],'folder');expect(state.indexedFiles).toBe(32);expect(state.warning).toMatch(/limit/);const skipped=state.files.find(file=>file.status==='limit')!;expect((await index.inspect(project,skipped.id)).content).toBeNull();
    await index.clear(project);await rm(project,{recursive:true});await mkdir(project);for(let i=0;i<205;i++)await writeFile(join(project,`${i}.txt`),'match');
    const many=await index.import(project,[project],'folder');expect(many.matchingFiles).toBe(205);expect(many.files).toHaveLength(200);expect((await index.query(project,'204.txt')).files).toHaveLength(1);
  });
  it('bounds manifest entries and directory traversal',async()=>{
    const {index,project}=await fixture();for(let i=0;i<1002;i++)await writeFile(join(project,`${i}.txt`),'tiny');const state=await index.import(project,[project],'folder');expect(state.totalFiles).toBeLessThanOrEqual(1000);expect(state.warning).toMatch(/limit/);
  });
  it('bounds recursion depth and does not read files beyond the reported scan limit',async()=>{
    const {index,project}=await fixture();let nested=project;for(let depth=0;depth<35;depth++){nested=join(nested,'nested');await mkdir(nested);}
    await writeFile(join(nested,'deep.md'),'DEEP_PRIVATE_SENTINEL');const state=await index.import(project,[project],'folder');expect(state.warning).toMatch(/32 folder levels/);expect(state.indexedFiles).toBe(0);expect((await index.query(project,'DEEP_PRIVATE_SENTINEL')).files).toEqual([]);
  });
  it('reports an inaccessible imported directory and its known files without retaining searchable text',async()=>{
    const {index,project}=await fixture(),folder=join(project,'docs');await mkdir(folder);await writeFile(join(folder,'notes.md'),'PRIVATE_DIRECTORY_SENTINEL');await index.import(project,[folder],'folder');await chmod(folder,0);
    try {const state=await index.query(project);expect(state.files.find(file=>file.path==='docs/notes.md')?.status).toBe('inaccessible');expect((await index.query(project,'PRIVATE_DIRECTORY_SENTINEL')).files).toEqual([]);}
    finally{await chmod(folder,0o700);}
  });
  it('serializes concurrent imports and rejects malformed requests and invented IDs',async()=>{
    const {index,project}=await fixture();await writeFile(join(project,'a.md'),'a');await writeFile(join(project,'b.md'),'b');
    await Promise.all([index.import(project,[join(project,'a.md')],'files'),index.import(project,[join(project,'b.md')],'files')]);expect((await index.query(project)).sources).toHaveLength(2);
    for(const search of [null,[],42,'x'.repeat(501)])await expect(index.query(project,search)).rejects.toThrow(/Invalid/);
    await expect(index.query('relative')).rejects.toThrow();await expect(index.inspect(project,'../../etc/passwd')).rejects.toThrow();await expect(index.inspect(project,'0'.repeat(64))).rejects.toThrow(/no longer/);
    await expect(index.import(project,[],'files')).rejects.toThrow();await expect(index.import(project,[project],'invalid')).rejects.toThrow();
  });
  it('keeps damaged selection storage untouched and prevents mutation',async()=>{
    const {project,storage}=await fixture();await mkdir(join(storage,'library'));const file=join(storage,'library','selections.json');await writeFile(file,'broken');const index=new LibraryIndex(storage);
    expect((await index.query(project)).warning).toMatch(/could not be read/);await expect(index.import(project,[project],'folder')).rejects.toThrow(/storage/);await expect(index.clear(project)).rejects.toThrow(/storage/);expect(await readFile(file,'utf8')).toBe('broken');
  });
  it('rejects tampered manifests that would escape the project',async()=>{
    const {project,storage}=await fixture();await mkdir(join(storage,'library'));await writeFile(join(storage,'library','selections.json'),JSON.stringify({version:1,projects:[{path:project,sources:[{id:'a'.repeat(36),path:'../outside',kind:'folder'}],known:['../secret.md']}]}));
    const state=await new LibraryIndex(storage).query(project);expect(state.warning).toMatch(/storage/);expect(state.files).toEqual([]);
  });
  it('keeps committed selections when atomic replacement fails',async()=>{
    const {index,project}=await fixture();await writeFile(join(project,'keep.md'),'keep');const state=await index.import(project,[project],'folder');await rm(index.file);await mkdir(index.file);
    await expect(index.remove(project,state.sources[0].id)).rejects.toThrow(/Could not save/);expect((await index.query(project)).sources).toHaveLength(1);
  });
});
