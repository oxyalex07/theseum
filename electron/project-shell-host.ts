import { join } from 'node:path';

// The host outlives the interactive shell. This preserves a controlling terminal
// on POSIX and a kernel Job Object on Windows, even after shell exec/crash.
export function shellHost(shell:string,token:string,statusFile:string,cwd=''):{file:string;args:string[]}{
  if(process.platform!=='win32')return {file:'/bin/sh',args:['-c',`trap ':' INT TERM HUP
"$1" ${process.platform==='darwin'?'-f -i':'-i'}
code=$?
printf '\\033]777;${token};exit;%s\\007' "$code"
while :; do sleep 86400 & wait $!; done`, 'theseus-shell-host',shell]};
  const source=`using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
public static class TheseusShellHost {
 [StructLayout(LayoutKind.Sequential)] struct Basic {public long PerProcessUserTimeLimit,PerJobUserTimeLimit;public uint LimitFlags;public UIntPtr MinimumWorkingSetSize,MaximumWorkingSetSize;public uint ActiveProcessLimit;public UIntPtr Affinity;public uint PriorityClass,SchedulingClass;}
 [StructLayout(LayoutKind.Sequential)] struct Io {public ulong ReadOperationCount,WriteOperationCount,OtherOperationCount,ReadTransferCount,WriteTransferCount,OtherTransferCount;}
 [StructLayout(LayoutKind.Sequential)] struct Limits {public Basic BasicLimitInformation;public Io IoInfo;public UIntPtr ProcessMemoryLimit,JobMemoryLimit,PeakProcessMemoryUsed,PeakJobMemoryUsed;}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes,string name);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int info,ref Limits limits,uint size);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 public static void Run(string shell,string statusFile,string jobName,string cwd) {
  IntPtr job=CreateJobObject(IntPtr.Zero,jobName);
  Limits limits=new Limits();limits.BasicLimitInformation.LimitFlags=0x2000; // KILL_ON_JOB_CLOSE, no breakaway
  if(job==IntPtr.Zero||!SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf(typeof(Limits)))||!AssignProcessToJobObject(job,Process.GetCurrentProcess().Handle))throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
  Console.CancelKeyPress+=(sender,e)=>{e.Cancel=true;};
  var start=new ProcessStartInfo(shell,"/D");start.UseShellExecute=false;start.WorkingDirectory=cwd;
  var child=Process.Start(start);
  System.IO.File.WriteAllText(statusFile,"ready");
  child.WaitForExit();
  System.IO.File.WriteAllText(statusFile,"exit:"+child.ExitCode);
  // Hold the last job handle until main terminates this host. The kernel then
  // kills every inherited job member, including reparented/background processes.
  Thread.Sleep(Timeout.Infinite);GC.KeepAlive(job);
 }
}`;
  const script=`$ErrorActionPreference='Stop'; try { Add-Type -TypeDefinition @'\n${source}\n'@; [TheseusShellHost]::Run('${shell.replaceAll("'","''")}','${statusFile.replaceAll("'","''")}','Local\\Theseus-shell-${token}','${cwd.replaceAll("'","''")}') } catch { [System.IO.File]::WriteAllText('${statusFile.replaceAll("'","''")}','error'); exit 1 }`;
  return {file:join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),args:['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')]};
}

// Hold a second job handle while terminating/querying it: a shell PID or a
// completed TerminateProcess call alone does not prove that all children exited.
export function windowsJobStopScript(token:string){
  const source=`using System;using System.Runtime.InteropServices;using System.Threading;
public static class TheseusJobStop {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr OpenJobObject(uint access,bool inherit,string name);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool TerminateJobObject(IntPtr job,uint code);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool QueryInformationJobObject(IntPtr job,int info,IntPtr buffer,uint length,IntPtr returned);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr handle);
 public static void Stop(string name){
  IntPtr job=OpenJobObject(12,false,name);
  if(job==IntPtr.Zero){if(Marshal.GetLastWin32Error()==2)return;throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());}
  IntPtr info=Marshal.AllocHGlobal(48);
  try{if(!TerminateJobObject(job,1))throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
   for(int i=0;i<100;i++){if(!QueryInformationJobObject(job,1,info,48,IntPtr.Zero))throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());if(Marshal.ReadInt32(info,40)==0)return;Thread.Sleep(50);}
   throw new Exception("Owned Windows job processes remain alive");
  }finally{Marshal.FreeHGlobal(info);CloseHandle(job);}
 }
}`;
  return `$ErrorActionPreference='Stop';Add-Type -TypeDefinition @'\n${source}\n'@;[TheseusJobStop]::Stop('Local\\Theseus-shell-${token}');[Console]::Write('STOPPED')`;
}
