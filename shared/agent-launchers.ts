export interface AgentLauncher {
  id:string;
  name:string;
  description:string;
  repository:string;
  runtime:'claude'|'codex'|'other';
  command:string;
  folder:string;
  updatedAt:string;
  lastLaunchedAt:string|null;
}
export interface SaveLauncherRequest {
  id?:string;
  expectedUpdatedAt?:string;
  name:string;
  description:string;
  repository:string;
  runtime:AgentLauncher['runtime'];
  command:string;
  // New paths must come from the native folder picker. Null retains an existing folder.
  folderChoice:string|null;
}
export interface LauncherState { launchers:AgentLauncher[]; supported:boolean; warning?:string }
