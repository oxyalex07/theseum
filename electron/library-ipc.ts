import type { BrowserWindow, Dialog, IpcMain, IpcMainInvokeEvent } from 'electron';
import type { WorkspaceSummary } from '../shared/bridge';
import { LibraryIndex } from './library-index';
import { realpath, stat } from 'node:fs/promises';

type Operation='query'|'import'|'remove'|'clear'|'inspect';
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
export function libraryRequest(input:unknown,operation:Operation) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid Library request.');
  const value=input as Record<string,unknown>;
  const keys=['workspaceId',...(operation==='inspect'?['fileId']:['search']),...(operation==='import'?['kind']:operation==='remove'?['sourceId']:[])];
  if(Object.keys(value).some(key=>!keys.includes(key))||!uuid(value.workspaceId)||value.search!==undefined&&(typeof value.search!=='string'||value.search.length>500))throw new Error('Invalid Library project or search.');
  if(operation==='import'&&value.kind!=='files'&&value.kind!=='folder')throw new Error('Choose files or a folder to import.');
  if(operation==='remove'&&!uuid(value.sourceId))throw new Error('Invalid Library import.');
  if(operation==='inspect'&&(typeof value.fileId!=='string'||!/^[a-f0-9]{64}$/.test(value.fileId)))throw new Error('Invalid Library file.');
  return {workspaceId:value.workspaceId,search:(value.search as string|undefined)??'',kind:value.kind as 'files'|'folder',sourceId:value.sourceId as string,fileId:value.fileId as string};
}

/** Install only on the owning app window's validated IPC surface. No renderer-provided file paths. */
export function registerLibraryIPC(host:{ipcMain:Pick<IpcMain,'handle'>;dialog:Pick<Dialog,'showOpenDialog'>;window:()=>BrowserWindow;assertSender:(event:IpcMainInvokeEvent)=>void;workspace:(id:string)=>WorkspaceSummary|undefined;directory:string}) {
  const library=new LibraryIndex(host.directory);let picking=false;
  const scoped=(event:IpcMainInvokeEvent,input:unknown,operation:Operation)=>{
    host.assertSender(event);const request=libraryRequest(input,operation),workspace=host.workspace(request.workspaceId);
    if(!workspace)throw new Error('Choose a project folder before using the Library.');
    return {request,workspace};
  };
  host.ipcMain.handle('theseus:library-query',(event,input:unknown)=>{const {request,workspace}=scoped(event,input,'query');return library.query(workspace.path,request.search);});
  host.ipcMain.handle('theseus:library-import',async(event,input:unknown)=>{
    const {request,workspace}=scoped(event,input,'import');
    if(picking)throw new Error('A Library file picker is already open.');picking=true;
    try{
      if(await realpath(workspace.path)!==workspace.path||!(await stat(workspace.path)).isDirectory())throw new Error('Project folder changed. Choose it again before importing.');
      const result=await host.dialog.showOpenDialog(host.window(),{title:request.kind==='folder'?'Import a project folder into Library':'Import project files into Library',defaultPath:workspace.path,properties:request.kind==='folder'?['openDirectory']:['openFile','multiSelections']});
      if(result.canceled||!result.filePaths.length)return null;
      return await library.import(workspace.path,result.filePaths,request.kind,request.search);
    }finally{picking=false;}
  });
  host.ipcMain.handle('theseus:library-remove',(event,input:unknown)=>{const {request,workspace}=scoped(event,input,'remove');return library.remove(workspace.path,request.sourceId,request.search);});
  host.ipcMain.handle('theseus:library-clear',(event,input:unknown)=>{const {request,workspace}=scoped(event,input,'clear');return library.clear(workspace.path,request.search);});
  host.ipcMain.handle('theseus:library-inspect',(event,input:unknown)=>{const {request,workspace}=scoped(event,input,'inspect');return library.inspect(workspace.path,request.fileId);});
  return library;
}
