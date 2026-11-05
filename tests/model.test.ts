import { describe, expect, it } from 'vitest';
import { createModel, resolveSession, selectSession } from '../src/state/model';
import { mockSessions } from '../src/data/mock-data';
import { isTrustedFrame, validateMemory, validateWindowAction } from '../electron/policy';
describe('demo model',()=>{
  it('isolates changes from fixtures and other windows',()=>{
    const a=createModel(),b=createModel();resolveSession(a,'c1','always');
    expect(a.sessions.find(s=>s.id==='c1')?.st).toBe('running');
    expect(b.sessions.find(s=>s.id==='c1')?.st).toBe('waiting');
    expect(mockSessions.find(s=>s.id==='c1')?.st).toBe('waiting');
    expect(a.settings.allow).toContain('pnpm add recharts@2.12.7');
    expect(a.threads.c1.some(m=>m.card==='approval')).toBe(false);
  });
  it('validates navigation parameters and caps open tabs',()=>{
    const m=createModel('?s=unknown&view=bad&page=bad&section=bad');
    expect(m.selected).toBe('c1');expect(m.layout).toBe('focus');expect(m.section).toBe('general');
    for(const s of m.sessions)selectSession(m,s.id);
    expect(m.open).toHaveLength(4);expect(m.page).toBe('session');
    const before=m.selected;selectSession(m,'untrusted');expect(m.selected).toBe(before);
  });
  it('keeps denying and retrying entirely in simulated state',()=>{
    const m=createModel();resolveSession(m,'c1','deny');resolveSession(m,'c3','retry');
    expect(m.sessions.find(s=>s.id==='c1')?.st).toBe('thinking');
    expect(m.threads.c1.at(-1)?.t).toContain('No.');
    expect(m.sessions.find(s=>s.id==='c3')?.st).toBe('running');
  });
});
describe('desktop IPC policy',()=>{
  it('accepts only the expected renderer document, with optional UI query/hash',()=>{
    expect(isTrustedFrame('http://127.0.0.1:5173/?s=c1','http://127.0.0.1:5173')).toBe(true);
    expect(isTrustedFrame('http://127.0.0.1:5173/evil','http://127.0.0.1:5173')).toBe(false);
    expect(isTrustedFrame('http://evil.test:5173','http://127.0.0.1:5173')).toBe(false);
    expect(isTrustedFrame('file:///other.html','file:///app/index.html')).toBe(false);
  });
  it('rejects malformed/oversized payloads and arbitrary window actions',()=>{
    expect(validateMemory({code:['Use strict TypeScript']})).toEqual({code:['Use strict TypeScript']});
    for(const bad of [null,[],{code:'not a list'},{code:[1]},{code:['x'.repeat(10001)]},JSON.parse('{"__proto__":[]}')])expect(()=>validateMemory(bad)).toThrow();
    expect(()=>validateWindowAction('exec')).toThrow();expect(validateWindowAction('minimize')).toBe('minimize');
  });
});
