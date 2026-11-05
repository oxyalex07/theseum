import { lazy, Suspense } from 'react';
import { targetKey, type ProjectTarget } from '../../shared/project-tools';
const Shell=lazy(()=>import('./project-shell'));
export function ProjectTerminal({target}:{target?:ProjectTarget}){
  return <Suspense fallback={<p className="empty-note">Loading terminal…</p>}><Shell key={target?targetKey(target):'none'} target={target}/></Suspense>;
}
