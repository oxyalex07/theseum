import type { AgentConfiguration } from '../../shared/bridge';
import { Icon } from './common';
export function ProfileMark({profile,size=46}:{profile:Pick<AgentConfiguration,'icon'|'color'>;size?:number}){
  return <span className="profile-mark" style={{width:size,height:size,color:`var(--${profile.color})`,background:`color-mix(in srgb, var(--${profile.color}) 12%, transparent)`}}><Icon name={profile.icon} size={Math.round(size/2)}/></span>;
}
