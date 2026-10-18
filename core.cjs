'use strict';
const normalize = n => String(n || '').replace(/[^0-9]/g, '');
class Gate {
  constructor(numbers) { this.allowed = new Set(numbers.map(normalize)); this.active = false; this.session = 0; this.sent = new Set(); this.since = Infinity; }
  set(active) {
    if (active === this.active) return;
    this.active = active;
    this.session++;
    this.sent.clear();
    this.since = active ? Date.now() : Infinity;
  }
  eligible(m, number, readyAt) {
    return this.active && !m.fromMe && !m.broadcast && !m.isStatus &&
      /@(c\.us|lid)$/.test(m.from || '') && !m.author &&
      // Sistem/bildirim mesajlari haric tum mesaj tiplerine yanit ver
      !['notification_template','e2e_notification','gp2','revoked','reaction','call_log'].includes(m.type) &&
      Number(m.timestamp) * 1000 >= Math.max(this.since, readyAt) - 300000 &&
      this.allowed.has(normalize(number)) && !this.sent.has(normalize(number));
  }
  claim(m, number, readyAt) {
    if (!this.eligible(m, number, readyAt)) return false;
    this.sent.add(normalize(number)); return true;
  }
}
module.exports = { Gate, normalize };
