import { WebContentsView, session, type BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { localPreviewUrl, type ProjectPreview } from '../shared/project-tools';
import type { BrowserBounds } from '../shared/browsing';
export class ProjectAppPreview {
  private view?:WebContentsView;
  private host?:BrowserWindow;
  private visible=false;
  private visibleKey='';
  visibilityEpoch=0;
  private origin='';
  private epoch=0;
  private state:ProjectPreview={targetKey:'',projectPath:'',url:'',title:'',loading:false,error:''};
  constructor(private emit:(state:ProjectPreview)=>void){}
  snapshot(){return structuredClone(this.state);}
  private publish(){this.view?.setVisible(this.visible&&this.visibleKey===this.state.targetKey&&!this.state.error);this.emit(this.snapshot());}
  revoke(){this.visibilityEpoch++;this.visible=false;this.visibleKey='';this.view?.setVisible(false);}
  private create(host:BrowserWindow){
    if(this.view)return;
    this.host=host;
    const isolated=session.fromPartition(`theseus-preview-${randomUUID()}`);
    isolated.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));isolated.setPermissionCheckHandler(()=>false);
    isolated.on('will-download',event=>event.preventDefault());
    isolated.webRequest.onBeforeRequest((details,callback)=>{
      let allowed=false;
      try{
        const url=new URL(details.url);
        if(['http:','https:'].includes(url.protocol))allowed=localPreviewUrl(url.href)!==''&&url.origin===this.origin;
        // Development servers use same-origin HMR websockets.
        else if(['ws:','wss:'].includes(url.protocol))allowed=new URL(url.href.replace(/^ws/,'http')).origin===this.origin;
        else if(url.protocol==='data:')allowed=true;
        else if(url.protocol==='blob:')allowed=new URL(url.pathname).origin===this.origin;
      }catch{/* Reject external/local-file/custom-protocol resources. */}
      callback({cancel:!allowed});
    });
    this.view=new WebContentsView({webPreferences:{session:isolated,nodeIntegration:false,nodeIntegrationInSubFrames:false,contextIsolation:true,sandbox:true,webSecurity:true,webviewTag:false,allowRunningInsecureContent:false,navigateOnDragDrop:false}});
    this.view.setVisible(false);host.contentView.addChildView(this.view);
    const wc=this.view.webContents;
    wc.setWindowOpenHandler(()=>({action:'deny'}));
    const guard=(event:Electron.Event,input:string)=>{
      try{if(new URL(localPreviewUrl(input)).origin!==this.origin)throw new Error('Different origin');}
      catch{event.preventDefault();this.state.error='Preview blocked navigation outside the selected local origin. Enter the new local URL explicitly to switch servers.';this.state.loading=false;this.publish();}
    };
    wc.on('will-navigate',guard);wc.on('will-redirect',guard);wc.on('will-frame-navigate',event=>guard(event,event.url));
    wc.on('did-start-loading',()=>{this.state.loading=true;this.state.error='';this.publish();});
    const update=()=>{
      try{const url=localPreviewUrl(wc.getURL());if(new URL(url).origin===this.origin)this.state.url=url;}catch{/* Blank before navigation. */}
      this.state.title=wc.getTitle().slice(0,500);this.publish();
    };
    wc.on('did-navigate',update);wc.on('did-navigate-in-page',update);wc.on('page-title-updated',update);
    wc.on('did-stop-loading',()=>{this.state.loading=false;update();});
    wc.on('did-fail-load',(_event,code,_description,_url,main)=>{if(main&&code!==-3){this.state.loading=false;this.state.error='The local app could not load. Start its development server, check the URL, then retry.';this.publish();}});
    wc.on('render-process-gone',()=>{this.state.loading=false;this.state.error='The app preview stopped responding. Retry to reload it.';this.publish();});
  }
  bounds(host:BrowserWindow,key:string,input:unknown){
    const b=input as BrowserBounds,[width,height]=host.getContentSize();
    if(!b||![b.x,b.y,b.width,b.height].every(Number.isFinite)||b.x<0||b.y<0||b.width<1||b.height<1||b.x+b.width>width+1||b.y+b.height>height+1)throw new Error('Invalid preview bounds.');
    this.create(host);this.visible=true;this.visibleKey=key;this.view!.setBounds({x:Math.round(b.x),y:Math.round(b.y),width:Math.floor(b.width),height:Math.floor(b.height)});this.publish();
  }
  async open(host:BrowserWindow,key:string,path:string,input:unknown){
    const url=localPreviewUrl(input);this.create(host);
    const epoch=++this.epoch;this.view!.webContents.stop();this.origin=new URL(url).origin;
    this.state={targetKey:key,projectPath:path,url,title:'',loading:true,error:''};this.publish();
    const wc=this.view!.webContents;
    const timeout=setTimeout(()=>{if(epoch===this.epoch&&this.state.loading){wc.stop();this.state.loading=false;this.state.error='The local app did not finish loading within 15 seconds. Check the server and retry.';this.publish();}},15000);
    try{await wc.loadURL(url);}
    catch{if(epoch===this.epoch&&!this.state.error){this.state.loading=false;this.state.error='The local app could not load. Start its development server, check the URL, then retry.';this.publish();}}
    finally{clearTimeout(timeout);}
    return this.snapshot();
  }
  close(){
    this.epoch++;this.revoke();this.origin='';
    if(this.view){if(this.host&&!this.host.isDestroyed())this.host.contentView.removeChildView(this.view);if(!this.view.webContents.isDestroyed())this.view.webContents.close();this.view=undefined;}
    this.state={targetKey:'',projectPath:'',url:'',title:'',loading:false,error:''};this.emit(this.snapshot());
  }
}
