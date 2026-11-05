import { expect, it, vi } from 'vitest';
import { checkUpdates, releaseResult } from '../electron/updates';
const release=(tag='v0.2.0')=>({tag_name:tag,draft:false,prerelease:false,html_url:`https://github.com/AlexSingh-cpu/theseum/releases/tag/${tag}`});
it('compares stable numeric versions and provides a manual installation path',()=>{
  expect(releaseResult(release(),'0.1.0')).toMatchObject({status:'available',version:'v0.2.0'});
  expect(releaseResult(release(),'0.2.0').status).toBe('current');
  expect(releaseResult(release('v0.9.0'),'0.10.0').status).toBe('current');
  expect(releaseResult(release('v1.0.0'),'0.99.0').status).toBe('available');
});
it('rejects invalid metadata and download URLs',()=>{
  for(const input of [null,{...release(),prerelease:true},release('v1.0.0-beta'),{...release(),html_url:'https://evil.example/download'},{...release(),html_url:'https://github.com/other/repo/releases/tag/v1'}])expect(()=>releaseResult(input,'0.1.0')).toThrow();
});
it('checks a fixed endpoint with timeout and handles unpublished, offline and service errors',async()=>{
  const request=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(release())));
  expect((await checkUpdates('0.1.0',request)).status).toBe('available');
  expect(request).toHaveBeenCalledWith('https://api.github.com/repos/AlexSingh-cpu/theseum/releases/latest',expect.objectContaining({signal:expect.any(AbortSignal),redirect:'error'}));
  request.mockResolvedValue(new Response('',{status:404}));expect((await checkUpdates('0.1.0',request)).status).toBe('unpublished');
  request.mockResolvedValue(new Response('',{status:429}));await expect(checkUpdates('0.1.0',request)).rejects.toThrow('rate limiting');
  request.mockRejectedValue(new Error('Offline'));await expect(checkUpdates('0.1.0',request)).rejects.toThrow('connection');
});
