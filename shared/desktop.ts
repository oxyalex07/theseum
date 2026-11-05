export interface DesktopPreferences {
  slots:number;
  overflow:'queue'|'ask';
  login:boolean;
  menubar:boolean;
  nFail:boolean;
  nDone:boolean;
  deliver:'banner'|'sound'|'badge';
  deepOn:boolean;
  deep:'blockers'|'nothing';
}
export const desktopDefaults:DesktopPreferences={slots:1,overflow:'queue',login:false,menubar:false,nFail:true,nDone:false,deliver:'banner',deepOn:false,deep:'blockers'};
export function isDeepWork(preferences:DesktopPreferences,now:Date):boolean{
  return preferences.deepOn&&now.getDay()>=1&&now.getDay()<=5&&now.getHours()>=9&&now.getHours()<12;
}
export function allowsNotification(preferences:DesktopPreferences,category:'failure'|'completion'|'attention',blocker:boolean,now:Date):boolean{
  if(category==='failure'&&!preferences.nFail||category==='completion'&&!preferences.nDone)return false;
  return !isDeepWork(preferences,now)||preferences.deep==='blockers'&&blocker;
}
export interface DesktopState {
  preferences:DesktopPreferences;
  loginSupported:boolean;
  loginHint:string;
  notificationsSupported:boolean;
  warning?:string;
}
export interface UpdateResult {
  status:'current'|'available'|'unpublished';
  message:string;
  version?:string;
  releaseUrl?:string;
}
export function validateDesktopPatch(input:unknown):Partial<DesktopPreferences>{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid desktop preferences.');
  const patch:Partial<DesktopPreferences>={};
  for(const [key,value] of Object.entries(input)){
    if(!Object.hasOwn(desktopDefaults,key))throw new Error('Unknown desktop preference.');
    if(key==='slots'){
      if(!Number.isInteger(value)||Number(value)<1||Number(value)>8)throw new Error('Choose between 1 and 8 live agent slots.');
    }else if(key==='overflow'){
      if(!['queue','ask'].includes(value as string))throw new Error('Unsupported overflow policy.');
    }else if(key==='deliver'){
      if(!['banner','sound','badge'].includes(value as string))throw new Error('Invalid notification style.');
    }else if(key==='deep'){
      if(!['blockers','nothing'].includes(value as string))throw new Error('Invalid deep work preference.');
    }else if(typeof value!=='boolean')throw new Error('Desktop toggles must be boolean.');
    Object.assign(patch,{[key]:value});
  }
  return patch;
}
