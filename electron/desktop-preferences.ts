import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { allowsNotification, desktopDefaults, validateDesktopPatch, type DesktopPreferences, type DesktopState } from '../shared/desktop';
import type { AgentRun } from '../shared/bridge';

export interface DesktopEffects {
  loginSupported:boolean;
  loginHint:string;
  notificationsSupported:boolean;
  getLogin:()=>boolean;
  setLogin:(enabled:boolean)=>void;
  setTray:(enabled:boolean)=>void;
  badge:(count:number)=>void;
  notify:(options:{title:string;body:string;silent:boolean},failed:(message:string)=>void)=>void;
}
export class DesktopSettings {
  private preferences={...desktopDefaults};
  private file:string;
  private warning?:string;
  private statuses=new Map<string,AgentRun['status']>();
  private unread=0;
  constructor(private directory:string,private effects:DesktopEffects,private changed:()=>void=()=>{}){
    this.file=join(directory,'desktop-preferences.json');
    try{
      const document=JSON.parse(readFileSync(this.file,'utf8'));
      if(document.version!==1)throw new Error('Unsupported version');
      this.preferences={...desktopDefaults,...validateDesktopPatch(document.preferences)};
    }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')this.warning='Could not read desktop preferences. Defaults are active; save a preference to repair the file.';}
  }
  start(){
    const failures:string[]=[];
    try{
      if(this.effects.loginSupported&&this.preferences.login){
        this.effects.setLogin(true);
        if(!this.effects.getLogin())throw new Error('The operating system did not accept the login item. Check system login settings.');
      }
    }catch(error){failures.push(`Launch at login: ${error instanceof Error?error.message:String(error)}`);}
    try{this.effects.setTray(this.preferences.menubar);}
    catch(error){failures.push(`Menu bar: ${error instanceof Error?error.message:String(error)}`);}
    if(failures.length)this.fail(`Could not apply desktop preferences. ${failures.join(' ')}`);
  }
  private fail(message:string){this.warning=message;this.changed();}
  state():DesktopState{
    const preferences={...this.preferences};
    if(this.effects.loginSupported){try{preferences.login=this.effects.getLogin();}catch{this.warning='Could not read system login items. Try saving Launch at login again.';}}
    return {preferences,loginSupported:this.effects.loginSupported,loginHint:this.effects.loginHint,notificationsSupported:this.effects.notificationsSupported,warning:this.warning};
  }
  save(input:unknown):DesktopState{
    const patch=validateDesktopPatch(input),before=this.state().preferences,next={...before,...patch};
    if(patch.login!==undefined&&!this.effects.loginSupported)throw new Error(this.effects.loginHint);
    try{
      if(patch.login!==undefined){this.effects.setLogin(next.login);if(this.effects.getLogin()!==next.login)throw new Error('The operating system did not accept the login item. Check system login settings.');}
      if(patch.menubar!==undefined)this.effects.setTray(next.menubar);
      mkdirSync(this.directory,{recursive:true,mode:0o700});
      writeFileSync(`${this.file}.tmp`,JSON.stringify({version:1,preferences:next},null,2),{mode:0o600});
      renameSync(`${this.file}.tmp`,this.file);
    }catch(error){
      const rollback:string[]=[];
      try{if(patch.login!==undefined)this.effects.setLogin(before.login);}catch{rollback.push('Restore the login item in system settings.');}
      try{if(patch.menubar!==undefined)this.effects.setTray(before.menubar);}catch{rollback.push('Restart Theseus to restore the tray.');}
      const message=`Could not save desktop preferences: ${error instanceof Error?error.message:String(error)} ${rollback.join(' ')}`.trim();
      this.fail(message);throw new Error(message);
    }
    this.preferences=next;this.warning=undefined;this.changed();return this.state();
  }
  acknowledge(){this.unread=0;this.effects.badge(0);}
  runChanged(run:AgentRun,now=new Date()){
    const previous=this.statuses.get(run.id);this.statuses.set(run.id,run.status);
    if(previous===run.status||!['completed','failed'].includes(run.status))return;
    const p=this.preferences,failed=run.status==='failed';
    // Badge remains visible even when banners are disabled or deep work suppresses them.
    if(failed){this.unread++;this.effects.badge(this.unread);}
    if(p.deliver==='badge'||!allowsNotification(p,failed?'failure':'completion',failed,now))return;
    if(!this.effects.notificationsSupported){this.fail('System notifications are unavailable on this system. Run results remain available in Theseus.');return;}
    try{
      this.effects.notify({title:failed?'Theseus · Run failed':'Theseus · Run finished',body:'Open Theseus to review the run result.',silent:p.deliver!=='sound'},message=>this.fail(`System notification failed: ${message}. Check OS notification permissions and app signing.`));
    }catch(error){this.fail(`System notification failed: ${error instanceof Error?error.message:String(error)}. Check OS notification permissions.`);}
  }
}
