import { describe, expect, it } from 'vitest';
import { browserDestination, validateBrowserUrl } from '../shared/browser';
describe('external browser boundary',()=>{
  it('accepts only ordinary HTTP(S) URLs without embedded credentials',()=>{
    expect(validateBrowserUrl('https://example.com/docs')).toBe('https://example.com/docs');
    expect(validateBrowserUrl('http://localhost:5173')).toBe('http://localhost:5173/');
    for(const input of ['javascript:alert(1)','file:///etc/passwd','data:text/html,hello','mailto:hello@example.com','https://user:secret@example.com','https://user@example.com','not a url',null,{},'https://example.com/'+ 'a'.repeat(4096)])expect(()=>validateBrowserUrl(input)).toThrow();
  });
  it('resolves domains and search text without accepting executable schemes',()=>{
    expect(browserDestination('example.com/docs')).toBe('https://example.com/docs');
    expect(browserDestination('localhost:5173')).toBe('http://localhost:5173/');
    expect(browserDestination('React rendering')).toBe('https://duckduckgo.com/?q=React%20rendering');
    expect(()=>browserDestination('javascript:alert(1)')).toThrow();
    expect(()=>browserDestination('   ')).toThrow();
  });
});
