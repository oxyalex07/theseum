import { WebContentsView, session, type BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { validateBrowserUrl } from '../shared/browser';
import type { BrowserBounds, BrowserCommand, BrowsingState, PageExtract } from '../shared/browsing';
import { BrowserStore } from './browser-store';
// Fixed code only. No script, selectors, or expressions from IPC or the agent are executed.
const extractScript=`(() => {
  const root=document.querySelector('main,article,[role=main]')||document.body;
  const clone=root?.cloneNode(true);
  clone?.querySelectorAll('script,style,noscript,form,input,textarea,select,[hidden],[aria-hidden="true"]').forEach(n=>n.remove());
  const text=(clone?.textContent||'').replace(/\\s+/g,' ').trim();
  return {url:location.href,title:document.title.slice(0,500),text:text.slice(0,20000),truncated:text.length>20000};
})()`;
export class EmbeddedBrowser {
  private view?:WebContentsView;
  private host?:BrowserWindow;
  private visible=false;
  private epoch=0;
  private busy=false;
  private agentOrigin:string|null=null;
  private lastBounds:BrowserBounds|null=null;
  private store:BrowserStore;
  private state:BrowsingState={url:'',title:'',loading:false,error:'',recording:false,history:[],extracts:[],selectedIds:[],allowedOrigin:null,activity:[],warning:''};
  constructor(directory:string,private emit:(state:BrowsingState)=>void,private agentLog:(text:string)=>void){this.store=new BrowserStore(directory);}
  snapshot():BrowsingState{return structuredClone({...this.state,recording:this.store.recording,history:this.store.history,warning:this.store.warning});}
  private publish(){this.emit(this.snapshot());}
  private log(actor:'user'|'agent',action:string){this.state.activity=[{at:new Date().toISOString(),actor,action},...this.state.activity].slice(0,40);if(actor==='agent')this.agentLog(action);this.publish();}
  private create(host:BrowserWindow){
    if(this.view)return;
    this.host=host;
    const isolated=session.fromPartition(`theseus-browser-${randomUUID()}`);
    isolated.setPermissionRequestHandler((_w,_p,callback)=>callback(false));isolated.setPermissionCheckHandler(()=>false);
    isolated.on('will-download',event=>event.preventDefault());
    // No file/custom protocols, even through subframes, redirects, or subresources.
    isolated.webRequest.onBeforeRequest((details,callback)=>{let allowed=false;try{allowed=['http:','https:','data:','blob:'].includes(new URL(details.url).protocol);}catch{/* denied */}callback({cancel:!allowed});});
    this.view=new WebContentsView({webPreferences:{session:isolated,nodeIntegration:false,nodeIntegrationInSubFrames:false,contextIsolation:true,sandbox:true,webSecurity:true,webviewTag:false,allowRunningInsecureContent:false,navigateOnDragDrop:false}});
    const wc=this.view.webContents;
    wc.setWindowOpenHandler(()=>{this.state.error='Pop-up blocked. Use a link in this page or open the address externally.';this.publish();return {action:'deny'};});
    const guard=(event:Electron.Event,url:string)=>{try{validateBrowserUrl(url);if(this.agentOrigin&&new URL(url).origin!==this.agentOrigin)throw new Error('Origin not granted');}catch{event.preventDefault();this.state.error='Only HTTP and HTTPS pages can open here.';this.publish();}};
    wc.on('will-navigate',guard);wc.on('will-redirect',guard);
    wc.on('will-frame-navigate',(event)=>guard(event,event.url));
    wc.on('did-start-loading',()=>{this.epoch++;this.state.loading=true;this.state.error='';this.publish();});
    const update=()=>{
      try{this.state.url=validateBrowserUrl(wc.getURL());}catch{return;}
      this.state.title=wc.getTitle().slice(0,500);this.state.loading=wc.isLoading();
      if(this.state.allowedOrigin&&new URL(this.state.url).origin!==this.state.allowedOrigin)this.state.allowedOrigin=null;
      this.publish();
    };
    wc.on('did-navigate',()=>{update();try{this.store.visit(this.state.url,this.state.title);}catch{/* surfaced in state */}this.publish();});
    wc.on('did-navigate-in-page',(_e,_url,main)=>{if(main){this.epoch++;update();try{this.store.visit(this.state.url,this.state.title);}catch{/* surfaced */}this.publish();}});
    wc.on('page-title-updated',()=>{update();try{this.store.title(this.state.url,this.state.title);}catch{/* surfaced in state */}this.publish();});wc.on('did-stop-loading',()=>{this.state.loading=false;update();this.publish();});
    wc.on('did-fail-load',(_e,code,_description,_url,main)=>{if(main&&code!==-3){this.state.error='This page could not load. Check the address or try your external browser.';this.state.loading=false;this.publish();}});
    wc.on('render-process-gone',()=>{this.state.error='The page stopped responding. Reload it to continue.';this.state.allowedOrigin=null;this.publish();});
    host.contentView.addChildView(this.view);
  }
  bounds(host:BrowserWindow,input:unknown){
    if(input===null){if(!this.visible&&!this.state.allowedOrigin)return;this.view?.webContents.stop();this.visible=false;this.state.allowedOrigin=null;this.epoch++;this.view?.setVisible(false);this.publish();return;}
    const b=input as BrowserBounds;
    const [width,height]=host.getContentSize();
    if(!b||![b.x,b.y,b.width,b.height].every(Number.isFinite)||b.x<0||b.y<0||b.width<1||b.height<1||b.x+b.width>width+1||b.y+b.height>height+1)throw new Error('Invalid browser bounds.');
    this.lastBounds={...b};this.create(host);this.visible=true;this.view!.setBounds({x:Math.round(b.x),y:Math.round(b.y),width:Math.floor(b.width),height:Math.floor(b.height)});this.view!.setVisible(true);
  }
  async command(input:unknown):Promise<BrowsingState>{
    if(!input||typeof input!=='object')throw new Error('Invalid browser command.');
    const c=input as BrowserCommand;
    switch(c.action){
      case 'navigate':await this.navigate(c.url,'user');break;
      case 'back':case 'forward':case 'reload':{
        const wc=this.requireView();this.state.allowedOrigin=null;
        if(c.action==='reload')wc.reload();else if(c.action==='back'&&wc.navigationHistory.canGoBack())wc.navigationHistory.goBack();else if(c.action==='forward'&&wc.navigationHistory.canGoForward())wc.navigationHistory.goForward();break;
      }
      case 'extract':await this.extract('user');break;
      case 'grant':if(c.origin===null)this.view?.webContents.stop();if(c.origin!==null&&(!this.visible||this.state.loading||new URL(validateBrowserUrl(this.state.url)).origin!==c.origin))throw new Error('Choose the loaded site to grant access.');this.state.allowedOrigin=c.origin;this.epoch++;this.log('user',c.origin?`Allowed agents to read and follow links on ${c.origin}`:'Revoked browser access');break;
      case 'record':if(typeof c.enabled!=='boolean')throw new Error('Invalid history setting.');this.store.recording=c.enabled;this.store.save();break;
      case 'clear-history':this.store.history=[];this.store.save();break;
      case 'delete-visit':this.store.history=this.store.history.filter(v=>v.id!==c.id);this.store.save();break;
      case 'select-extract':if(typeof c.selected!=='boolean'||!this.state.extracts.some(e=>e.id===c.id))throw new Error('Extract no longer exists.');this.state.selectedIds=this.state.selectedIds.filter(id=>id!==c.id);if(c.selected)this.state.selectedIds.push(c.id);break;
      case 'delete-extract':this.state.extracts=this.state.extracts.filter(e=>e.id!==c.id);this.state.selectedIds=this.state.selectedIds.filter(id=>id!==c.id);break;
      case 'clear-data':{const isolated=this.view?.webContents.session,host=this.host,bounds=this.visible?this.lastBounds:null;this.close();if(isolated)await Promise.all([isolated.clearStorageData(),isolated.clearCache(),isolated.clearAuthCache()]);this.state.extracts=[];this.state.selectedIds=[];this.state.activity=[];this.store.history=[];this.store.save();if(host&&bounds)this.bounds(host,bounds);break;}
      default:throw new Error('Unknown browser command.');
    }
    this.publish();return this.snapshot();
  }
  private requireView(){if(!this.view||!this.visible)throw new Error('Open the Browser page to use embedded browsing.');return this.view.webContents;}
  private async navigate(input:unknown,actor:'user'|'agent'){
    const url=validateBrowserUrl(input),wc=this.requireView();
    if(actor==='user')this.state.allowedOrigin=null;
    this.log(actor,`Navigate ${url}`);await wc.loadURL(url);
  }
  private async extract(actor:'user'|'agent'):Promise<PageExtract>{
    const wc=this.requireView();if(this.state.loading)throw new Error('Wait for the page to finish loading.');
    const epoch=this.epoch,url=validateBrowserUrl(wc.getURL());
    const data=await wc.executeJavaScript(extractScript);
    if(epoch!==this.epoch||wc.getURL()!==url||data.url!==url)throw new Error('The page changed. Extract it again.');
    const extract:PageExtract={id:randomUUID(),url,title:String(data.title).slice(0,500),capturedAt:new Date().toISOString(),text:String(data.text).slice(0,20000),truncated:!!data.truncated};
    if(!extract.text)throw new Error('No readable page text was found.');
    this.state.extracts=[extract,...this.state.extracts].slice(0,5);this.state.selectedIds=this.state.selectedIds.filter(id=>this.state.extracts.some(e=>e.id===id));this.log(actor,`Extract ${url}`);return extract;
  }
  context(ids:unknown):PageExtract[]{
    if(ids===undefined)return [];
    if(!Array.isArray(ids)||ids.length>5||new Set(ids).size!==ids.length)throw new Error('Select at most five page extracts.');
    return ids.map(id=>{const e=this.state.extracts.find(e=>e.id===id);if(!e||!this.state.selectedIds.includes(e.id))throw new Error('Page context changed. Review extracts in Browser.');return structuredClone(e);});
  }
  consume(ids:string[]){this.state.selectedIds=this.state.selectedIds.filter(id=>!ids.includes(id));this.publish();}
  async agentTool(name:string,args:Record<string,unknown>){
    if(this.busy)throw new Error('Another browser action is in progress.');
    const origin=this.state.allowedOrigin,wc=this.requireView();
    if(!origin||this.state.loading||new URL(validateBrowserUrl(wc.getURL())).origin!==origin)throw new Error('Browser access is not granted for this site. Ask the user to open Browser and allow access.');
    this.busy=true;
    try{
      if(name==='browser_read'){const extract=await this.extract('agent');const links=await wc.executeJavaScript(`Array.from(document.querySelectorAll('a[href]')).slice(0,100).map(a=>({text:(a.textContent||'').trim().slice(0,200),url:a.href.slice(0,4096)}))`);if(this.state.allowedOrigin!==origin||wc.getURL()!==extract.url)throw new Error('Page or permission changed.');return {...extract,links};}
      if(name==='browser_navigate'){
        const url=validateBrowserUrl(args.url);if(new URL(url).origin!==origin)throw new Error('The user must open and grant access to a different site.');
        this.agentOrigin=origin;await this.navigate(url,'agent');
        if(this.state.allowedOrigin!==origin)throw new Error('Access revoked or redirected to a different site.');
        return {url:this.state.url,title:this.state.title};
      }
      throw new Error('Unknown browser tool.');
    }finally{this.busy=false;this.agentOrigin=null;}
  }
  endAgentAccess(){this.state.allowedOrigin=null;this.epoch++;if(this.busy)this.view?.webContents.stop();this.publish();}
  close(){
    this.epoch++;this.state.allowedOrigin=null;this.visible=false;
    if(this.view){if(this.host&&!this.host.isDestroyed())this.host.contentView.removeChildView(this.view);if(!this.view.webContents.isDestroyed())this.view.webContents.close();this.view=undefined;}
    this.state.url='';this.state.title='';this.state.loading=false;this.state.error='';this.publish();
  }
}
