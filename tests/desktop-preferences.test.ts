import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DesktopSettings, type DesktopEffects } from '../electron/desktop-preferences';
import { validateDesktopPatch } from '../shared/desktop';
import type { AgentRun } from '../shared/bridge';

function fixture(action:(settings:DesktopSettings,effects:DesktopEffects,directory:string)=>void){
  const directory=mkdtempSync(join(tmpdir(),'theseus-desktop-'));let login=false;
  const effects:DesktopEffects={loginSupported:true,loginHint:'Installed application',notificationsSupported:true,getLogin:()=>login,setLogin:vi.fn(value=>{login=value;}),setTray:vi.fn(),badge:vi.fn(),notify:vi.fn()};
  try{action(new DesktopSettings(directory,effects),effects,directory);}finally{rmSync(directory,{recursive:true,force:true});}
}
const run=(id:string,status:AgentRun['status'])=>({id,status} as AgentRun);
const workMorning=new Date(2026,9,23,10),evening=new Date(2026,9,23,18);
describe('Desktop preferences and OS effects',()=>{
  it('validates IPC fields without coercion or arbitrary keys',()=>{
    for(const input of [null,[],{login:1},{deliver:'beep'},{deep:'all'},{crash:true},{__proto__:null,unknown:true}])expect(()=>validateDesktopPatch(input)).toThrow();
    expect(validateDesktopPatch({login:false,deliver:'sound'})).toEqual({login:false,deliver:'sound'});
  });
  it('persists, reloads and applies startup effects; reads external login changes',()=>fixture((settings,effects,directory)=>{
    expect(settings.state().preferences.login).toBe(false);
    settings.save({login:true,menubar:true,nDone:true,deliver:'sound',deepOn:true});
    const loaded=new DesktopSettings(directory,effects);loaded.start();
    expect(loaded.state().preferences).toMatchObject({login:true,menubar:true,nDone:true,deliver:'sound',deepOn:true});
    expect(effects.setTray).toHaveBeenLastCalledWith(true);
    effects.setLogin(false);expect(loaded.state().preferences.login).toBe(false);
  }));
  it('rolls OS effects back when storage fails and retains saved preferences',()=>fixture((settings,effects,directory)=>{
    settings.save({menubar:false});
    // A directory at the atomic temporary-file path causes a deterministic write failure.
    mkdirSync(join(directory,'desktop-preferences.json.tmp'));
    expect(()=>settings.save({menubar:true,login:true})).toThrow('Could not save');
    expect(effects.getLogin()).toBe(false);expect(effects.setTray).toHaveBeenLastCalledWith(false);
    expect(settings.state().preferences.menubar).toBe(false);
    expect(settings.state().warning).toContain('Could not save');
    expect(JSON.parse(readFileSync(join(directory,'desktop-preferences.json'),'utf8')).preferences.menubar).toBe(false);
  }));
  it('rejects unsupported or refused login changes and reports tray errors',()=>fixture((settings,effects)=>{
    effects.loginSupported=false;expect(()=>settings.save({login:true})).toThrow('Installed application');
    settings.save({nDone:true});
    effects.loginSupported=true;effects.setLogin=vi.fn();expect(()=>settings.save({login:true})).toThrow('did not accept');
    effects.setTray=vi.fn(()=>{throw new Error('Tray unavailable');});expect(()=>settings.save({menubar:true})).toThrow('Tray unavailable');
  }));
  it('recovers corrupt preferences visibly and repairs on save',()=>fixture((_settings,effects,directory)=>{
    writeFileSync(join(directory,'desktop-preferences.json'),'{broken');
    const settings=new DesktopSettings(directory,effects);expect(settings.state().warning).toContain('Could not read');
    settings.save({nDone:true});expect(settings.state().warning).toBeUndefined();
  }));
  it('restores the tray even when OS login registration fails at startup',()=>fixture((settings,effects,directory)=>{
    settings.save({login:true,menubar:true});
    effects.setLogin=()=>{throw new Error('OS refused registration');};
    const loaded=new DesktopSettings(directory,effects);loaded.start();
    expect(loaded.state().warning).toContain('OS refused registration');
    expect(effects.setTray).toHaveBeenLastCalledWith(true);
  }));
  it('delivers only terminal transitions, respects style and per-kind settings, and acknowledges badges',()=>fixture((settings,effects)=>{
    settings.runChanged(run('a','running'),evening);settings.runChanged(run('a','completed'),evening);expect(effects.notify).not.toHaveBeenCalled();
    settings.save({nDone:true,deliver:'sound'});
    settings.runChanged(run('b','completed'),evening);settings.runChanged(run('b','completed'),evening);
    expect(effects.notify).toHaveBeenCalledTimes(1);expect(effects.notify).toHaveBeenLastCalledWith(expect.objectContaining({silent:false}),expect.any(Function));
    settings.save({deliver:'banner'});settings.runChanged(run('c','failed'),evening);
    expect(effects.notify).toHaveBeenLastCalledWith(expect.objectContaining({silent:true}),expect.any(Function));
    expect(effects.badge).toHaveBeenLastCalledWith(1);
    settings.save({deliver:'badge'});settings.runChanged(run('d','failed'),evening);expect(effects.notify).toHaveBeenCalledTimes(2);
    settings.save({deliver:'sound',nFail:false});settings.runChanged(run('e','failed'),evening);expect(effects.notify).toHaveBeenCalledTimes(2);
    settings.acknowledge();expect(effects.badge).toHaveBeenLastCalledWith(0);
    settings.runChanged(run('f','cancelled'),evening);expect(effects.notify).toHaveBeenCalledTimes(2);
  }));
  it('applies local weekday deep work hours with failure exception',()=>fixture((settings,effects)=>{
    settings.save({deepOn:true,deep:'blockers',nDone:true});
    settings.runChanged(run('a','completed'),workMorning);expect(effects.notify).not.toHaveBeenCalled();
    settings.runChanged(run('b','failed'),workMorning);expect(effects.notify).toHaveBeenCalledTimes(1);
    settings.save({deep:'nothing'});settings.runChanged(run('c','failed'),workMorning);expect(effects.notify).toHaveBeenCalledTimes(1);
    settings.runChanged(run('d','completed'),new Date(2026,9,24,10));expect(effects.notify).toHaveBeenCalledTimes(2);
    settings.runChanged(run('e','completed'),new Date(2026,9,23,12));expect(effects.notify).toHaveBeenCalledTimes(3);
  }));
  it('surfaces unsupported systems and async notification failures',()=>fixture((settings,effects)=>{
    effects.notificationsSupported=false;settings.runChanged(run('a','failed'));expect(settings.state().warning).toContain('unavailable');
    effects.notificationsSupported=true;settings.runChanged(run('b','failed'));
    const callback=vi.mocked(effects.notify).mock.calls[0][1];callback('Permission denied');
    expect(settings.state().warning).toContain('Permission denied');
  }));
});

it('persists live capacity and overflow policy and rejects unsupported controls',()=>fixture((settings,effects,path)=>{
  settings.save({slots:3,overflow:'ask'});
  expect(new DesktopSettings(path,effects).state().preferences).toMatchObject({slots:3,overflow:'ask'});
  for(const slots of [0,9,1.5,NaN,'2'])expect(()=>settings.save({slots})).toThrow();
  expect(()=>settings.save({overflow:'other-runtime'})).toThrow();
}));
