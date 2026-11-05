import { useSyncExternalStore } from 'react';
// Cosmetic identity only. Agent credentials and saved app records remain main-process owned.
const key='orbit.local-profile';
const changed='orbit:profile-changed';
const fallback={name:'Alex',bio:''};
function read(){try{return localStorage.getItem(key)??'';}catch{return '';}}
function subscribe(listener:()=>void){window.addEventListener(changed,listener);window.addEventListener('storage',listener);return()=>{window.removeEventListener(changed,listener);window.removeEventListener('storage',listener);};}
export function useLocalProfile(){
  const raw=useSyncExternalStore(subscribe,read);
  let profile=fallback;
  try{const value=JSON.parse(raw);if(typeof value.name==='string'&&value.name.trim())profile={name:value.name.trim().slice(0,60),bio:typeof value.bio==='string'?value.bio.slice(0,280):''};}catch{/* Use the initial local identity. */}
  const save=(value:typeof fallback)=>{
    if(!value.name.trim())throw new Error('Enter a display name.');
    localStorage.setItem(key,JSON.stringify({name:value.name.trim().slice(0,60),bio:value.bio.trim().slice(0,280)}));
    window.dispatchEvent(new Event(changed));
  };
  return {profile,save};
}
export function profileInitial(name:string){return [...name.trim()][0]?.toLocaleUpperCase()??'A';}
