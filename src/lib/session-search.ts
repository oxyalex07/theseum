import { mockFiles, mockProjects, mockSources } from '../data/mock-data';
import type { Model } from '../state/model';
import type { Session } from '../types';
import { reviewResult } from '../../shared/git';

export interface SessionSearchMatch { category: 'Session'|'Project'|'Agent'|'Source'|'File'; text: string }
export interface SessionSearchResult { session: Session; match?: SessionSearchMatch }
export const sessionSearchScope = 'Searches session titles, projects, agents, and recorded source names and file paths. Sample results are labeled. Workspace files and current Git snapshots are not indexed; unrecorded sources and files are unavailable.';

// Search only records associated with this session. Inspector fallback fixtures are
// presentation placeholders, not evidence that a session read a source or file.
export function searchSessions(model: Model, query = model.query): SessionSearchResult[] {
  const needle = query.trim().toLowerCase();
  return model.sessions.flatMap(session => {
    const live = !!session.runId;
    if (model.space !== 'all' && (live ? 'code' : mockProjects[session.pj]?.sp) !== model.space && session.pj !== 'me') return [];
    if (!needle) return [{ session }];
    const records: SessionSearchMatch[] = [];
    const add = (category: SessionSearchMatch['category'], text?: string) => { if (text) records.push({ category, text }); };
    add('Session', session.t);
    add('Project', session.projectName ?? (!live ? mockProjects[session.pj]?.n : undefined));
    if (live) {
      const run = model.runs[session.runId!];
      // A missing saved run must never inherit the demo Forge agent or fixtures.
      if (run) {
        add('Session', run.task);
        add('Agent', run.agentConfiguration?.profile?.name ?? 'Codex');
        if (run.crew) add('Agent', run.crew.role);
        add('File', run.projectPath);
        add('File', run.executionPath);
        for (const source of run.pageSelection ?? []) { add('Source', source.title); add('Source', source.url); }
        for (const output of run.output) if (output.kind === 'file') {
          for (const line of output.text.split('\n')) add('File', line.replace(/^\S+\s+/, ''));
        }
        // Git snapshots live inside the inspector and are not globally indexed.
        // Completed review findings, however, are saved with their owning run.
        for (const finding of reviewResult(run)?.findings ?? []) add('File', finding.path);
      }
    } else {
      add('Agent', model.agents[session.ag]?.n);
      for (const [path] of mockFiles[session.id] ?? []) add('File', path);
      const thread = model.threads[session.id] ?? [];
      const sourceCount = Math.max(session.srcN ?? 0, ...thread.filter(message => message.card === 'sources').map(message => message.n ?? 6));
      for (const [name, url] of mockSources.slice(0, sourceCount)) { add('Source', name); add('Source', url); }
      for (const message of thread) {
        for (const tool of message.tools ?? []) {
          if (['READ', 'WRITE', 'EDIT'].includes(tool.tag)) add('File', tool.title);
          if (tool.tag === 'WEB') add('Source', tool.title);
        }
        for (const [kind, value] of message.aff ?? []) if (kind === 'file') add('File', value);
      }
    }
    const match = records.find(record => record.text.toLowerCase().includes(needle));
    return match ? [{ session, match }] : [];
  });
}
