import type { UpdateResult } from '../shared/desktop';

const repository='https://github.com/AlexSingh-cpu/theseum';
// Source checkout distribution: releases are installed manually, never execute downloaded code.
function version(value:string):number[]{
  const match=/^v?(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if(!match)throw new Error('The release version is not a stable semantic version.');
  const parts=match.slice(1).map(Number);if(parts.some(n=>!Number.isSafeInteger(n)))throw new Error('Invalid release version.');return parts;
}
export function releaseResult(input:unknown,current:string):UpdateResult{
  if(!input||typeof input!=='object')throw new Error('Invalid release response.');
  const release=input as Record<string,unknown>;
  if(release.draft!==false||release.prerelease!==false||typeof release.tag_name!=='string'||typeof release.html_url!=='string')throw new Error('Invalid stable release response.');
  const latest=version(release.tag_name),installed=version(current);
  const url=new URL(release.html_url);
  if(url.origin!=='https://github.com'||!url.pathname.startsWith('/AlexSingh-cpu/theseum/releases/tag/')||url.username||url.password)throw new Error('Invalid release download URL.');
  const difference=latest.map((n,i)=>n-installed[i]).find(n=>n!==0)??0;
  return difference>0?{status:'available',version:release.tag_name,releaseUrl:url.href,message:`${release.tag_name} is available. Open the release to download and install it manually. For a source checkout, use the release's source and follow README setup instructions; quit Theseus before replacing it.`}:{status:'current',message:`Theseus ${current} is up to date with the latest stable release.`};
}
export async function checkUpdates(current:string,request:typeof fetch=fetch):Promise<UpdateResult>{
  let response:Response;
  try{response=await request('https://api.github.com/repos/AlexSingh-cpu/theseum/releases/latest',{headers:{Accept:'application/vnd.github+json','User-Agent':'Theseus-desktop'},signal:AbortSignal.timeout(15_000),redirect:'error'});}
  catch{throw new Error('Could not reach GitHub releases. Check your connection and try again.');}
  if(response.status===404)return {status:'unpublished',message:'No public stable release is available. This source checkout is updated by obtaining the latest source and following README setup instructions.',releaseUrl:`${repository}/releases`};
  if(!response.ok)throw new Error(`Update check failed (GitHub ${response.status}). ${response.status===403||response.status===429?'GitHub may be rate limiting requests; try again later.':'Try again later.'}`);
  return releaseResult(await response.json(),current);
}
