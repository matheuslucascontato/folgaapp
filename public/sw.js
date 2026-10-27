// Sem cache de páginas, respostas autenticadas ou dados financeiros.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>new Response('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width"><title>FOLGA • Sem conexão</title><body style="font:18px system-ui;background:#F7F7F2;color:#172A26;padding:32px"><h1>Vamos respirar um instante.</h1><p>O FOLGA precisa de conexão para acessar e alterar seus dados. Reconecte e tente novamente.</p></body></html>',{headers:{'Content-Type':'text/html;charset=utf-8'}})));});
