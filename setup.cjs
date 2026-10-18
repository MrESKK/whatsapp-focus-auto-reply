'use strict';
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const readline = require('node:readline/promises');
const { normalize } = require('./core.cjs');
const path = require('node:path');
process.chdir(__dirname);
(async () => {
 const rl = readline.createInterface({input:process.stdin,output:process.stdout});
 try {
  let old = {}; try {old = JSON.parse(fs.readFileSync('config.json'));} catch {}
  const ips = Object.values(os.networkInterfaces()).flat().filter(x => x && x.family === 'IPv4' && /^100\./.test(x.address)).map(x=>x.address);
  const suggested = old.host || ips[0] || '';
  const host = (await rl.question(`PC Tailscale IPv4 adresi${suggested ? ' ['+suggested+']' : ''}: `)).trim() || suggested;
  const octets = host.split('.').map(Number);
  if (octets.length!==4 || octets[0]!==100 || octets[1]<64 || octets[1]>127 || octets.some(x=>!Number.isInteger(x)||x<0||x>255)) throw Error('Tailscale uygulamasindaki 100.x.x.x adresini girin.');
  const input = await rl.question('Yanit verilecek numaralar (ulke koduyla, virgul ayirarak; ornek +905321234567): ');
  const allowedNumbers = input.split(',').map(normalize).filter(Boolean);
  if (!allowedNumbers.length || allowedNumbers.some(n=> !/^[1-9][0-9]{7,14}$/.test(n))) throw Error('Gecerli uluslararasi numaralar girin.');
  const config = {host,port:8787,token:old.token || crypto.randomBytes(32).toString('hex'),allowedNumbers,
   message:'🤖 Otomatik Yanıt\n\nŞu anda meşgul olduğum için mesajlara yanıt veremiyorum. Müsait olduğumda en kısa sürede dönüş yapacağım.\n\n📞 Acil veya önemli bir konuysa lütfen arayın.'};
  fs.writeFileSync('config.json',JSON.stringify(config,null,2),{mode:0o600});
  fs.writeFileSync('IPHONE-AYARLARI.txt',`Bu dosyadaki anahtari paylasmayin.\n\nURL: http://${host}:8787/focus\nYontem: POST\nBaslik: Authorization\nDeger: Bearer ${config.token}\nIstek govdesi: JSON\nOdak acilinca: active = true (Boolean)\nOdak kapaninca: active = false (Boolean)\n\nTailscale iki cihazda da bagli olmali.\n` ,{mode:0o600});
  console.log('Kaydedildi. IPHONE-AYARLARI.txt dosyasini acin. Sonra BASLAT.cmd calistirin.');
 } finally {rl.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
