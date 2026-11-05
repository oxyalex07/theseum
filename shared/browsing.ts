export interface PageExtract { id:string; url:string; title:string; capturedAt:string; text:string; truncated:boolean }
export interface BrowserVisit { id:string; url:string; title:string; visitedAt:string }
export interface BrowserActivity { at:string; actor:'user'|'agent'; action:string }
export interface BrowsingState {
  url:string; title:string; loading:boolean; error:string; recording:boolean;
  history:BrowserVisit[]; extracts:PageExtract[]; selectedIds:string[];
  allowedOrigin:string|null; activity:BrowserActivity[]; warning:string;
}
export type BrowserCommand = {action:'navigate';url:string}|{action:'back'|'forward'|'reload'|'extract'|'clear-history'|'clear-data'}|{action:'record';enabled:boolean}|{action:'delete-visit'|'delete-extract';id:string}|{action:'select-extract';id:string;selected:boolean}|{action:'grant';origin:string|null};
export interface BrowserBounds { x:number;y:number;width:number;height:number }
