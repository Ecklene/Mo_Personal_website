import {cp,mkdir,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const destination=path.join(root,'public');
// Copy only public artifacts. Server code, SQL and environment files cannot be served.
await rm(destination,{recursive:true,force:true});
await mkdir(destination,{recursive:true});
const sitemap=await readFile(path.join(root,'sitemap.xml'),'utf8');
const routes=[...sitemap.matchAll(/<loc>[^<]+<\/loc>/g)].map(m=>new URL(m[0].slice(5,-6)).pathname);
for(const route of [...routes,'/studio/']){
  const relative=route.replace(/^\//,'')+'index.html';
  if(relative.includes('..')||!relative.endsWith('index.html'))throw new Error('Invalid public route');
  await mkdir(path.dirname(path.join(destination,relative)),{recursive:true});
  await cp(path.join(root,relative),path.join(destination,relative));
}
for(const name of ['assets','robots.txt','sitemap.xml'])await cp(path.join(root,name),path.join(destination,name),{recursive:true});
console.log(`Prepared ${routes.length+1} pages and shared assets for deployment.`);
