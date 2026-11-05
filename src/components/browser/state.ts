import { useEffect, useState } from 'react';
import type { BrowsingState } from '../../../shared/browsing';
export function useBrowsingState(){
  const [state,setState]=useState<BrowsingState|null>(null);
  useEffect(()=>{
    let received=false,alive=true;
    const off=window.theseus?.onBrowsingState(next=>{received=true;if(alive)setState(next);});
    void window.theseus?.getBrowsingState().then(next=>{if(alive&&!received)setState(next);}).catch(()=>{});
    return()=>{alive=false;off?.();};
  },[]);
  return state;
}
