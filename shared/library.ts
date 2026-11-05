/** Library data is local reference material only; there is deliberately no agent-context API. */
export type LibraryFileStatus = 'indexed' | 'removed' | 'inaccessible' | 'unsupported' | 'too-large' | 'limit';
export interface LibrarySource { id: string; path: string; kind: 'file' | 'folder' }
export interface LibraryFile {
  id: string; path: string; status: LibraryFileStatus; message?: string;
  size?: number; modifiedAt?: string; snippet?: string; line?: number;
}
export interface LibraryState {
  projectPath: string; sources: LibrarySource[]; files: LibraryFile[];
  totalFiles: number; indexedFiles: number; matchingFiles: number; checkedAt: string;
  warning?: string; limits: { fileBytes: number; projectBytes: number; files: number; results: number };
}
export interface LibraryRequest { workspaceId: string; search?: string }
export interface LibraryPreview { file: LibraryFile; content: string | null; projectPath: string }
/** Implemented only by Electron's narrow preload bridge. Paths never come from the renderer. */
export interface LibraryBridge {
  getLibrary(request: LibraryRequest): Promise<LibraryState>;
  importLibrary(request: LibraryRequest & { kind: 'files' | 'folder' }): Promise<LibraryState | null>;
  removeLibrarySource(request: LibraryRequest & { sourceId: string }): Promise<LibraryState>;
  clearLibrary(request: LibraryRequest): Promise<LibraryState>;
  inspectLibraryFile(request: { workspaceId: string; fileId: string }): Promise<LibraryPreview>;
}
