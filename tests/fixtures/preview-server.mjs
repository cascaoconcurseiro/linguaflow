import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const args=process.argv.slice(2);
const port=Number(args[args.indexOf('--port')+1])||4173;
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'};
http.createServer(async(req,res)=>{try{
 let url=new URL(req.url,'http://localhost');let name=decodeURIComponent(url.pathname);
 if(url.searchParams.has('mobile')){
  res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html><body style="margin:0;background:#ddd"><iframe title="Mobile preview" src="/?view=study" style="width:390px;height:844px;border:0"></iframe></body></html>');return;
 }
 if(name==='/'||name==='/__preview'){
  let html=await readFile(path.join(root,'dashboard/dashboard.html'),'utf8');
  html=html.replace('<head>','<head><base href="/dashboard/">').replace('<script type="module" src="js/core/app.js?v=3.0.53"></script>','<script type="module" src="/tests/fixtures/editorial-preview.js?v=3.0.53"></script>');
  res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});res.end(html);return;
 }
 const file=path.resolve(root,'.'+name);
 if(!file.startsWith(root+path.sep)||name.split('/').some(s=>s.startsWith('.'))){res.writeHead(403);res.end();return;}
 const content=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);
}catch{res.writeHead(404);res.end('Not found');}}).listen(port,'0.0.0.0',()=>console.log(`Visual fixture on ${port}`));
