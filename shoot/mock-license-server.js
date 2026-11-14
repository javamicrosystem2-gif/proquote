// ============================================================
// ProQuote — سيرفر تفعيل وهمي للفحص المحلي (--probe-license)
// يحاكي دالة activate-license (Supabase Edge) حرفياً + واجهة REST
// التي تقرأها لوحة تحكم المطور، بمفتاح RSA تجريبي يُولَّد كل تشغيل.
// لا يلمس الإنتاج إطلاقاً — يعمل على 127.0.0.1 فقط.
// ============================================================
'use strict';

const http = require('http');
const crypto = require('crypto');

let _keys = null;
let _rows = [];

function seedRows() {
  const now = Date.now();
  _rows = [
    { key: 'PQ-TEST-QUOT-0001', tier: 'quotes',  days: 365, status: 'unused', email: 'test-quotes@proquote.local', created_at: new Date(now).toISOString() },
    { key: 'PQ-TEST-FINN-0002', tier: 'finance', days: 365, status: 'unused', email: 'test-finance@proquote.local', created_at: new Date(now).toISOString() },
    { key: 'PQ-TEST-QREN-0003', tier: 'quotes',  days: 365, status: 'unused', email: 'test-renew@proquote.local', created_at: new Date(now).toISOString() },
    { key: 'PQ-TEST-LOCK-0004', tier: 'mgmt',    days: 365, status: 'unused', bound_device: 'ZZZZZZ99', created_at: new Date(now).toISOString() },
    { key: 'PQ-TEST-EXPI-0005', tier: 'full',    days: -1,  status: 'unused', created_at: new Date(now).toISOString() },
  ];
}

function signPayload(priv, payloadStr) {
  return crypto.sign('RSA-SHA256', Buffer.from(payloadStr, 'utf8'), priv).toString('base64');
}

function start(port) {
  return new Promise((resolve) => {
    _keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const priv = _keys.privateKey;
    const pubPem = _keys.publicKey.export({ type: 'spki', format: 'pem' });
    seedRows();

    const server = http.createServer((req, res) => {
      const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': '*'
      };
      const json = (obj, code) => {
        res.writeHead(code || 200, { 'Content-Type': 'application/json', ...cors });
        res.end(JSON.stringify(obj));
      };
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }

      const url = req.url.split('?')[0];
      let body = '';
      req.on('data', (c) => body += c);
      req.on('end', () => {
        let parsed = {};
        try { parsed = body ? JSON.parse(body) : {}; } catch (_) {}

        // ---- المفتاح العام التجريبي (يضبطه الفحص في PQ_LICENSE_PUBKEY) ----
        if (req.method === 'GET' && url === '/pubkey') {
          res.writeHead(200, { 'Content-Type': 'text/plain', ...cors });
          res.end(pubPem);
          return;
        }

        // ---- محاكاة حرفية لدالة activate-license ----
        if (req.method === 'POST' && (url === '/activate' || url === '/functions/v1/activate-license')) {
          const key = String(parsed.key || '').toUpperCase();
          const deviceId = String(parsed.deviceId || '').toUpperCase();
          if (key.length < 10 || !/^[A-Z0-9-]+$/.test(key)) { json({ success: false, error: 'صيغة الكود غير صحيحة' }, 400); return; }
          if (!/^[A-Z0-9]+$/.test(deviceId)) { json({ success: false, error: 'معرّف جهاز غير صالح' }, 400); return; }
          const row = _rows.find((r) => r.key === key);
          if (!row) { json({ success: false, error: 'كود التفعيل غير صحيح' }, 404); return; }
          if (row.status === 'revoked') { json({ success: false, error: 'هذا الكود ملغى' }, 403); return; }
          if (row.bound_device && row.bound_device !== deviceId) { json({ success: false, error: 'هذا الكود مرتبط بجهاز آخر' }, 403); return; }
          let expiry;
          if (row.bound_device === deviceId && row.expires_at) {
            expiry = new Date(String(row.expires_at)).getTime();
          } else {
            const days = Number(row.days) || 365;
            expiry = Date.now() + days * 24 * 60 * 60 * 1000;
          }
          if (expiry && Date.now() > expiry) { json({ success: false, error: 'انتهت صلاحية هذا الكود' }, 403); return; }
          const payloadStr = JSON.stringify({ deviceId: deviceId, tier: row.tier || 'professional', expiry: expiry, issued: Date.now() });
          const sig = signPayload(priv, payloadStr);
          Object.assign(row, { status: 'active', bound_device: deviceId, activated_at: new Date().toISOString(), expires_at: new Date(expiry).toISOString() });
          json({ success: true, license: { payload: payloadStr, sig } });
          return;
        }

        // ---- محاكاة REST التي تستخدمها لوحة المطور (pq_licenses / pq_plans) ----
        if (url === '/rest/v1/pq_licenses') {
          if (req.method === 'POST') {
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            arr.forEach((nr) => {
              if (!nr || !nr.key) return;
              const i = _rows.findIndex((r) => r.key === nr.key);
              if (i >= 0) _rows[i] = { ..._rows[i], ...nr };
              else _rows.push({ created_at: new Date().toISOString(), ...nr });
            });
            json([], 201);
            return;
          }
          json(_rows.slice().reverse());
          return;
        }
        if (url === '/rest/v1/pq_plans') { json([]); return; }

        json({ error: 'not found' }, 404);
      });
    });

    server.listen(port, '127.0.0.1', () => resolve({ server, pubPem, port, sign: (s) => signPayload(priv, s) }));
  });
}

function getRows() { return _rows; }

module.exports = { start, getRows, seedRows };
