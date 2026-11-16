// ============================================================
// ProQuote — سيرفر منظومة فواتير وهمي للفحص المحلي (--probe-einvoice)
// يحاكي منظومة ضريبية (ETA-like): مصادقة توكِن + تقديم فواتير
// بقبول ورفض — كل شيء على 127.0.0.1 فقط ولا يلمس الإنتاج.
// ============================================================
'use strict';

const http = require('http');

// قواعد الاختبار: client_secret صحيح/خاطئ واسم مستند يُرفض
const GOOD_SECRET = 'SECRET-OK-1234';
const BAD_SECRET = 'SECRET-BAD-0000';
const REJECT_MARKER = 'REFUSE-ME';

let _stats = { token200: 0, token401: 0, submitAccepted: 0, submitRejected: 0 };

function start(port) {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      const json = (obj, code) => {
        res.writeHead(code || 200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(obj));
      };
      const url = req.url.split('?')[0];

      // نقطة المصادقة: 200 بتوكِن للسر الصحيح و401 للخاطئ (مثل id.eta.gov.eg)
      if (req.method === 'POST' && url.endsWith('/connect/token')) {
        const params = new URLSearchParams(body);
        const cid = params.get('client_id') || '';
        const sec = params.get('client_secret') || '';
        if (sec === GOOD_SECRET) {
          _stats.token200++;
          json({ access_token: 'mock-token-' + Date.now(), token_type: 'Bearer', expires_in: 3600 });
        } else {
          _stats.token401++;
          json({ error: 'invalid_client', error_description: 'بيانات الدخول غير صحيحة' }, 401);
        }
        return;
      }

      // نقطة تقديم الفواتير: تقبل كل شيء إلا المستند الذي يحمل علامة الرفض
      if (req.method === 'POST' && url.includes('documentsubmissions')) {
        const auth = req.headers['authorization'] || '';
        if (!auth.startsWith('Bearer mock-token-')) { json({ error: 'unauthorized' }, 401); return; }
        let payload = {};
        try { payload = JSON.parse(body); } catch (_) {}
        const doc = (payload.documents || [])[0] || {};
        const internalId = doc.internalId || '';
        const recName = (doc.receiver && doc.receiver.name) || '';
        if (internalId.includes(REJECT_MARKER) || recName.includes(REJECT_MARKER)) {
          _stats.submitRejected++;
          json({
            submissionId: 'SUB-REJ-' + Date.now(),
            acceptedDocuments: [],
            rejectedDocuments: [{ internalId, errors: [{ code: 'invalid-receiver', message: 'اسم المستند يحمل علامة رفض الاختبار' }] }]
          }, 202);
          return;
        }
        _stats.submitAccepted++;
        json({
          submissionId: 'SUB-' + Date.now(),
          acceptedDocuments: [{ uuid: 'UUID-' + Math.random().toString(36).slice(2, 10), internalId }],
          rejectedDocuments: []
        }, 202);
        return;
      }

      json({ error: 'not found' }, 404);
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port, stats: () => _stats })));
}

module.exports = { start, GOOD_SECRET, BAD_SECRET, REJECT_MARKER };
