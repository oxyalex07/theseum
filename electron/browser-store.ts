import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateBrowserUrl } from '../shared/browser';
import type { BrowserVisit } from '../shared/browsing';
export class BrowserStore {
  recording=false;
  history:BrowserVisit[]=[];
  warning='';
  private path:string;
  constructor(directory:string){
    this.path=join(directory,'browsing-history.json');
    try{
      if(statSync(this.path).size>1_500_000)throw new Error('History is too large');
      const data=JSON.parse(readFileSync(this.path,'utf8'));
      if(typeof data.recording!=='boolean'||!Array.isArray(data.history)||data.history.length>200)throw new Error('Invalid history');
      this.history=data.history.map((v:BrowserVisit)=>{
        if(!v||typeof v.id!=='string'||!/^[a-f0-9-]{36}$/.test(v.id)||typeof v.visitedAt!=='string'||typeof v.title!=='string'||v.title.length>500||!Number.isFinite(Date.parse(v.visitedAt)))throw new Error('Invalid visit');
        return {id:v.id,title:v.title,url:validateBrowserUrl(v.url),visitedAt:v.visitedAt};
      });this.recording=data.recording;
    }catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')this.warning='Browsing history could not be read. Clear history to reset it.';}
  }
  save(){
    try{writeFileSync(`${this.path}.tmp`,JSON.stringify({recording:this.recording,history:this.history}),{mode:0o600});renameSync(`${this.path}.tmp`,this.path);this.warning='';}
    catch{this.warning='Could not save browsing history. Check disk space and permissions.';throw new Error(this.warning);}
  }
  title(url:string,title:string){if(this.recording&&this.history[0]?.url===url){this.history[0].title=title.slice(0,500);this.save();}}
  visit(url:string,title:string){
    if(!this.recording)return;
    this.history=[{id:randomUUID(),url:validateBrowserUrl(url),title:title.slice(0,500),visitedAt:new Date().toISOString()},...this.history].slice(0,200);this.save();
  }
}
