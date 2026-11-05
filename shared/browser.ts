// Shared by the address bar and the main-process external-navigation boundary.
export function validateBrowserUrl(input:unknown):string{
  if(typeof input!=='string'||input.length>4096)throw new Error('Enter a valid web address.');
  let url:URL;try{url=new URL(input);}catch{throw new Error('Enter a valid web address.');}
  if(!['https:','http:'].includes(url.protocol)||!url.hostname||url.username||url.password)throw new Error('Use an HTTP or HTTPS address without embedded credentials.');
  return url.href;
}
export function browserDestination(input:string):string{
  const text=input.trim();if(!text)throw new Error('Enter a web address or search term.');
  if(/^[a-z][a-z\d+.-]*:/i.test(text)&&!/^localhost:\d+/i.test(text))return validateBrowserUrl(text);
  if(!/\s/.test(text)&&(/^[^/]+\.[^/]+/.test(text)||/^localhost(?::\d+)?(?:\/|$)/i.test(text)))return validateBrowserUrl(`${/^localhost/i.test(text)?'http':'https'}://${text}`);
  return validateBrowserUrl(`https://duckduckgo.com/?q=${encodeURIComponent(text)}`);
}
