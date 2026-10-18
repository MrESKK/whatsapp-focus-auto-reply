'use strict';
const fs = require('node:fs');
const http = require('node:http');
const crypto = require('node:crypto');
const { Gate } = require('./core.cjs');
process.chdir(__dirname);
let cfg;
try { cfg = JSON.parse(fs.readFileSync('config.json')); } catch { console.error('Once KURULUM.cmd calistirin.'); process.exit(1); }
if (!Array.isArray(cfg.allowedNumbers) || !cfg.allowedNumbers.length || !/^[a-f0-9]{64}$/.test(cfg.token) || !/^100\./.test(cfg.host)) { console.error('Gecersiz ayar. KURULUM.cmd calistirin.'); process.exit(1); }
const gate = new Gate(cfg.allowedNumbers);
let ready = false, readyAt = Infinity;

// WhatsApp mesaji saniye, bilgisayar ise milisaniye cinsinden zaman tutar.
// Cihaz saati farki / kisa teslim gecikmesi yeni mesaji eski gosterebilir.
// En fazla 5 dakika tolerans: esikten 5 dakikadan daha eski mesajlar reddedilir.
// Bu araliktaki gercekten gecikmis mesajlar da yanit alabilir.
const MESSAGE_TIME_TOLERANCE_MS = 5 * 60 * 1000;

// ─── LID (Linked ID) Desteği ────────────────────────────────────────────────
// WhatsApp artik telefon numarasi yerine @lid formati kullaniyor.
// Ornek: 905443321516@c.us yerine 105939831111697@lid geliyor.
// Bu cache LID → telefon numarasi eslemesini tutar.
const lidCache = new Map();          // LID user → telefon numarasi
const phoneToChatId = new Map();     // telefon numarasi → m.from (mesaj gonderme icin)

const norm = n => String(n || '').replace(/[^0-9]/g, '');

// contact objesinden telefon numarasini almaya calis (birden fazla yontem)
async function resolvePhoneFromContact(contact, client) {
  // Yontem 1: contact.number
  if (contact.number) {
    const n = norm(contact.number);
    // LID ise (cok uzun veya allowedNumbers'da degilse) gec
    if (n && gate.allowed.has(n)) return n;
  }

  // Yontem 2: contact.id._serialized @c.us ise direkt al
  if (contact.id && contact.id._serialized && contact.id._serialized.endsWith('@c.us')) {
    const n = norm(contact.id.user);
    if (n && gate.allowed.has(n)) return n;
  }

  // Yontem 3: Dahili WA store uzerinden numara cozumle (whatsapp-web.js internals)
  try {
    const chatId = contact.id && contact.id._serialized;
    if (chatId) {
      const wid = await client.pupPage.evaluate(async (cid) => {
        // eslint-disable-next-line no-undef
        const contact = await window.WWebJS.getContact(cid);
        return contact && contact.userid;
      }, chatId);
      if (wid) {
        const n = norm(wid);
        if (n && gate.allowed.has(n)) return n;
      }
    }
  } catch { /* sayfa henuz hazir olmayabilir */ }

  return null;
}

// WhatsApp hazir oldugunda tum izinli numaralar icin LID eslemesi olustur
async function buildLidCache() {
  lidCache.clear();
  phoneToChatId.clear();

  console.log('LID onbellegi olusturuluyor...');

  // Yontem 1: getNumberId ile her izinli numara icin WA ID'sini sor
  for (const phone of cfg.allowedNumbers) {
    try {
      const wid = await client.getNumberId(phone);
      if (wid && wid.user) {
        const lidUser = norm(wid.user);
        const phoneNorm = norm(phone);
        if (lidUser && lidUser !== phoneNorm) {
          lidCache.set(lidUser, phoneNorm);
          console.log(`  LID esleme (getNumberId): ${phone} → ${wid._serialized}`);
        }
        // Telefon → chatId eslemesi (mesaj gonderme icin)
        phoneToChatId.set(phoneNorm, wid._serialized);
      }
    } catch { /* bu numara WA'da yoksa atla */ }
  }

  // Yontem 2: Tum rehber kisilarini tara, LID→telefon esle
  try {
    const contacts = await client.getContacts();
    for (const c of contacts) {
      if (!c.id) continue;
      const lidUser = norm(c.id.user);

      // contact.number varsa ve izinli listesindeyse direkt esle
      if (c.number) {
        const phoneNum = norm(c.number);
        if (lidUser && phoneNum && lidUser !== phoneNum && gate.allowed.has(phoneNum)) {
          lidCache.set(lidUser, phoneNum);
          if (!phoneToChatId.has(phoneNum)) phoneToChatId.set(phoneNum, c.id._serialized);
        }
      }
    }
  } catch(e) { console.warn('Kisiler alinamadi:', e.message); }

  // Yontem 3: WA dahili store'dan LID→phone eslesmelerini cek
  try {
    const mappings = await client.pupPage.evaluate(() => {
      const result = [];
      // eslint-disable-next-line no-undef
      const store = window.Store;
      if (store && store.Contact) {
        store.Contact.getModelsArray().forEach(c => {
          if (c.id && c.id.user && c.phoneNumber) {
            result.push({ lid: c.id.user, phone: String(c.phoneNumber) });
          }
        });
      }
      return result;
    });
    for (const m of mappings) {
      const lidUser = norm(m.lid);
      const phoneNum = norm(m.phone);
      if (lidUser && phoneNum && lidUser !== phoneNum && gate.allowed.has(phoneNum)) {
        lidCache.set(lidUser, phoneNum);
        console.log(`  LID esleme (Store): ${phoneNum} → ${lidUser}`);
      }
    }
  } catch { /* Store erisilemiyorsa atla */ }

  console.log(`LID onbellegi hazir: ${lidCache.size} esleme bulundu.`);
  if (lidCache.size === 0) {
    console.warn('[UYARI] Hicbir LID eslemesi bulunamadi!');
    console.warn('  Bu durumda mesaj geldiginde gercek zamanli cozumleme denenecek.');
  }
}

const authorized = req => {
 const actual = Buffer.from(req.headers.authorization || '');
 const expected = Buffer.from('Bearer '+cfg.token);
 return actual.length===expected.length && crypto.timingSafeEqual(actual,expected);
};
const server = http.createServer(async (req,res) => {
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 const respond = (status,body) => {res.writeHead(status);res.end(JSON.stringify(body));};
 if (req.method==='GET' && req.url==='/health') return respond(200,{running:true,whatsappReady:ready,focus:gate.active,lidCacheSize:lidCache.size});
 if (req.method!=='POST' || req.url!=='/focus') return respond(404,{error:'Bulunamadi'});
 if (!authorized(req)) return respond(401,{error:'Yetkisiz'});
 try {
  let body='';
  for await (const chunk of req) {body+=chunk;if(body.length>2048) return respond(413,{error:'Fazla veri'});}
  const {active}=JSON.parse(body);
  if (typeof active!=='boolean') return respond(400,{error:'active Boolean olmali'});
  // Odak her zaman set edilir; WA bagli degilse konsola uyari yazilir.
  if(active && !ready) console.warn('[UYARI] WhatsApp henuz hazir degil. Odak ACILDI; mesajlar WA baglaninca gidecek.');
  gate.set(active);
  console.log('Odak: '+(active?'ACIK':'KAPALI'));
  respond(200,{ok:true,focus:gate.active});
 } catch {respond(400,{error:'Gecersiz JSON'});}
});
server.requestTimeout = 10000;
server.headersTimeout = 10000;
server.on('error',e=>{console.error('Sunucu acilamadi: '+e.code+'. Tailscale baglantisini ve IP adresini kontrol edin.');process.exit(1);});
server.listen(cfg.port,cfg.host,()=>console.log(`Baglanti: http://${cfg.host}:${cfg.port}/health`));
const { Client, LocalAuth } = require('whatsapp-web.js');
const qr = require('qrcode-terminal');
const client = new Client({authStrategy:new LocalAuth(),puppeteer:{headless:true}});
client.on('qr', code=>{console.log('WhatsApp > Ayarlar > Bagli Cihazlar > Cihaz Bagla ile okutun.');qr.generate(code,{small:true});});

client.on('ready', async ()=>{
  ready=true;
  readyAt=Date.now();
  gate.set(false);
  console.log('WhatsApp hazir. Otomatik yanit KAPALI. Odak modunu kapatip acin.');
  try { await buildLidCache(); } catch(e) { console.error('LID cache hatasi:', e.message); }
});
client.on('auth_failure',()=>{ready=false;gate.set(false);lidCache.clear();console.error('WhatsApp oturumu acilamadi.');});
client.on('disconnected',()=>{ready=false;gate.set(false);lidCache.clear();console.error('WhatsApp baglantisi kesildi. Programi yeniden baslatin, sonra Odak modunu kapatip acin.');});

client.on('message', async m=>{
  console.log('MESAJ KONTROL:', {hazir:ready, odak:gate.active, tur:m.type, adres:m.from, kendim:m.fromMe});
  try {
    if(!ready || !gate.active || m.fromMe || m.author || !/@(c\.us|lid)$/.test(m.from||'') || m.broadcast || m.isStatus) return;
    const session=gate.session;
    const contact=await m.getContact();

    // ─── LID → Telefon Numarasi Cozumleme ───
    const rawUser = norm((m.from||'').split('@')[0]);
    let resolvedNumber = null;

    // 1. Adim: Cache'den bak
    if (lidCache.has(rawUser)) {
      resolvedNumber = lidCache.get(rawUser);
    }

    // 2. Adim: contact.number'dan dene
    if (!resolvedNumber && contact.number) {
      const cn = norm(contact.number);
      if (cn && gate.allowed.has(cn)) {
        resolvedNumber = cn;
        // Gelecek seferler icin cache'e ekle
        if (rawUser !== cn) lidCache.set(rawUser, cn);
      }
    }

    // 3. Adim: Gercek zamanli cozumleme (client.pupPage uzerinden)
    if (!resolvedNumber) {
      const rtResolved = await resolvePhoneFromContact(contact, client);
      if (rtResolved) {
        resolvedNumber = rtResolved;
        if (rawUser !== rtResolved) lidCache.set(rawUser, rtResolved);
        console.log(`  Gercek zamanli LID cozumleme basarili: ${rawUser} → ${rtResolved}`);
      }
    }

    // 4. Adim: Hala cozumlenemedi - rawUser'i dene (belki @c.us formati)
    if (!resolvedNumber) {
      if (gate.allowed.has(rawUser)) {
        resolvedNumber = rawUser;
      }
    }

    // Cozumlenemeyen numaralari logla (debug icin)
    if (!resolvedNumber) {
      console.log('ALICI KONTROL:', {lid:rawUser, contactNumber:contact.number, cozumlendi:'YOK', listede:false});
      console.log('  [BILGI] Bu numara icin LID cozumlenemedi. Numara izin listesinde olmayabilir.');
      return;
    }

    console.log('ALICI KONTROL:', {lid:rawUser, cozumlendi:resolvedNumber, listede:gate.allowed.has(resolvedNumber)});

    // contact.isGroup bazen bireysel sohbette yanlis true donebilir;
    // m.from regex ile grup tespiti daha guvenilir.
    const isGroupMsg = /@g\.us$/.test(m.from||'') || !!m.author;

    // ─── DEBUG: Hangi kontrolde takiliyor? ───
    const msgTs = Number(m.timestamp) * 1000;
    const sinceTs = Math.max(gate.since, readyAt);
    const validTimestamp = Number.isFinite(msgTs) && msgTs > 0;
    const timestampOK = validTimestamp && msgTs + MESSAGE_TIME_TOLERANCE_MS >= sinceTs;
    // Sadece Gate kontrolune verilen gorunumde tolerans uygula.
    // Orijinal WhatsApp mesaji ve core.cjs degismez; eligible ve claim
    // ayni zaman degerini kullanir, diger tum Gate kurallari korunur.
    const gateMessage = Object.create(m);
    Object.defineProperty(gateMessage, 'timestamp', {
      value: validTimestamp ? Number(m.timestamp) + MESSAGE_TIME_TOLERANCE_MS / 1000 : NaN
    });
    console.log('DEBUG KONTROL:', {
      contactIsMe: contact.isMe,
      isGroupMsg,
      sessionMatch: session === gate.session,
      ready,
      msgTimestamp: msgTs,
      sinceTimestamp: sinceTs,
      timestampOK,
      timestampOKWithoutTolerance: validTimestamp && msgTs >= sinceTs,
      timeToleranceSeconds: MESSAGE_TIME_TOLERANCE_MS / 1000,
      secondsBeforeCutoff: validTimestamp ? Math.max(0, Math.ceil((sinceTs - msgTs) / 1000)) : null,
      alreadySent: gate.sent.has(resolvedNumber),
      msgType: m.type,
      eligible: timestampOK && gate.eligible(gateMessage, resolvedNumber, readyAt)
    });
    // ─── DEBUG SON ───

    if(contact.isMe || isGroupMsg || session!==gate.session || !ready) return;
    if(!timestampOK) {
      console.log('MESAJ ATLANDI: Zaman damgasi gecersiz veya 5 dakikalik toleransin disinda.');
      return;
    }
    if(!gate.claim(gateMessage, resolvedNumber, readyAt)) return;
    // Claim once edildi, simdi gonder (cift gonderimi onler).
    await client.sendMessage(m.from, cfg.message, {sendSeen:false});
    console.log('Secilen bir kisiye otomatik yanit gonderildi: ' + resolvedNumber);
  } catch (err) { console.error('Yanit hatasi:', err); }
});
client.initialize().catch(()=>{console.error('WhatsApp baslatilamadi. Interneti kontrol edin ve yeniden baslatin.');process.exit(1);});
process.on('SIGINT',async()=>{gate.set(false);server.close();await client.destroy().catch(()=>{});process.exit(0);});
