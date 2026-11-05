export interface WorktreePreferences { location:string; removeMerged:boolean }
export interface ManagedWorktree {
  id:string; runId:string; sourcePath:string; path:string; commonDir:string;
  branch:string; baseRef:string; createdAt:string; state:'creating'|'ready'|'removed';
  recovery?:{status:'recoverable'|'missing'|'manual';message:string};
}
export interface WorktreeState { preferences:WorktreePreferences; worktrees:ManagedWorktree[]; warning?:string }
export interface WorktreeCleanup { removed:string[]; skipped:string[]; errors:string[] }
