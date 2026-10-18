const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Gate}=require('./core.cjs');
function fixture(){const g=new Gate(['+90 532 123 45 67']);g.set(true);g.since=100000;return {g,m:{from:'123@c.us',type:'chat',timestamp:101}};}
test('only selected private senders, once per session',()=>{const {g,m}=fixture();assert.equal(g.claim(m,'905321234567',100000),true);assert.equal(g.claim(m,'905321234567',100000),false);g.set(true);assert.equal(g.claim(m,'905321234567',100000),false);g.set(false);assert.equal(g.claim(m,'905321234567',100000),false);g.set(true);g.since=100000;assert.equal(g.claim(m,'905321234567',100000),true);});
test('reject groups, statuses, channels, own messages, broadcasts and system events',()=>{for(const patch of [{from:'abc@g.us'},{from:'status@broadcast'},{from:'abc@newsletter'},{fromMe:true},{author:'member@c.us'},{broadcast:true},{isStatus:true},{type:'notification_template'}]){const {g,m}=fixture();assert.equal(g.claim({...m,...patch},'905321234567',100000),false);}});
test('reject unlisted and unresolved number',()=>{const {g,m}=fixture();assert.equal(g.claim(m,'905399999999',100000),false);assert.equal(g.claim(m,undefined,100000),false);});
test('reject messages older than the 5-minute clock tolerance',()=>{const {g,m}=fixture();g.since=500000;assert.equal(g.claim({...m,timestamp:101},'905321234567',100000),false);g.since=100000;assert.equal(g.claim(m,'905321234567',500000),false);});
test('accept LID only with resolved selected phone number',()=>{const {g,m}=fixture();assert.equal(g.claim({...m,from:'123@lid'},'905321234567',100000),true);});
