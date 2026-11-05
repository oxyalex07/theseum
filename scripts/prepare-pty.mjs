import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { chmod, stat } from 'node:fs/promises';
// node-pty 1.1's macOS prebuild ships its spawn helper without executable mode.
// Keep the native module external to esbuild so its adjacent binaries resolve.
if(process.platform!=='win32'){
  const root=dirname(createRequire(import.meta.url).resolve('node-pty/package.json'));
  for(const folder of ['build/Release',`prebuilds/${process.platform}-${process.arch}`]){
    const helper=join(root,folder,'spawn-helper');
    try{await stat(helper);await chmod(helper,0o755);}catch(error){if(error.code!=='ENOENT')throw error;}
  }
}
