// tools/oc-notify.mjs
// Vigila OpenCode en el PC y manda avisos a ntfy (push gratis al iPhone).
//
// Uso:
//   node tools/oc-notify.mjs            -> vigila permisos y avisa
//   node tools/oc-notify.mjs --test     -> manda una notificación de prueba
//   node tools/oc-notify.mjs --topic X  -> usa el topic X
//
// El topic se guarda en tools/.ntfy-topic para no repetirlo.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SERVICE_JSON = path.join(os.homedir(), '.local', 'state', 'opencode', 'service.json');
const TOPIC_FILE = path.join(import.meta.dirname, '.ntfy-topic');
const REQ_FILE = path.join(import.meta.dirname, '.ntfy-topic-req');
const RES_FILE = path.join(import.meta.dirname, '.ntfy-topic-res');

const args = process.argv.slice(2);
const isTest = args.includes('--test');
const topicArg = (() => {
  const i = args.indexOf('--topic');
  return i >= 0 ? args[i + 1] : null;
})();

function readTopic() {
  if (topicArg) return topicArg;
  if (fs.existsSync(TOPIC_FILE)) return fs.readFileSync(TOPIC_FILE, 'utf8').trim();
  return null;
}

function makeTopic(prefix) {
  const rnd = Array.from({ length: 10 }, () =>
    'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
  ).join('');
  return `oc-${prefix}-${rnd}`;
}

function loadService() {
  if (!fs.existsSync(SERVICE_JSON)) throw new Error(`No encuentro ${SERVICE_JSON}`);
  const s = JSON.parse(fs.readFileSync(SERVICE_JSON, 'utf8'));
  return { url: s.url, password: s.password };
}

function auth(pw) {
  return 'Basic ' + Buffer.from('opencode:' + pw).toString('base64');
}

async function publish(topic, { title, message, priority = 'default', tags = [], actions = [] }) {
  const headers = { 'Content-Type': 'text/plain; charset=utf-8' };
  if (title) headers['X-Title'] = title;
  if (priority) headers['X-Priority'] = priority;
  if (tags.length) headers['X-Tags'] = tags.join(',');
  if (actions.length) {
    headers['X-Actions'] = actions
      .map((a) =>
        [
          'http',
          a.label,
          a.url,
          `method=${a.method ?? 'POST'}`,
          a.body ? `body=${a.body}` : '',
          a.clear ? 'clear=true' : '',
        ]
          .filter(Boolean)
          .join(', ')
      )
      .join('; ');
  }
  const res = await fetch(`https://ntfy.sh/${topic}`, {
    method: 'POST',
    headers,
    body: message,
  });
  if (!res.ok) throw new Error(`ntfy HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return res.json().catch(() => ({}));
}

async function pendingPermissions(svc) {
  const res = await fetch(`${svc.url}/api/permission/request`, {
    headers: { Authorization: auth(svc.password) },
  });
  if (!res.ok) return [];
  const j = await res.json();
  return j.data ?? [];
}

async function main() {
  const svc = loadService();

  let topic = readTopic();
  if (!topic) {
    topic = makeTopic('alvaro');
    fs.writeFileSync(TOPIC_FILE, topic);
  }
  const resTopic = fs.existsSync(RES_FILE) ? fs.readFileSync(RES_FILE, 'utf8').trim() : makeTopic('res');
  if (!fs.existsSync(RES_FILE)) fs.writeFileSync(RES_FILE, resTopic);

  console.log('---------------------------------------------');
  console.log(' Topic de avisos :', topic);
  console.log(' Topic de respuestas:', resTopic);
  console.log('---------------------------------------------');
  console.log(' En el iPhone: instala la app "ntfy" y suscríbete al topic de arriba.');
  console.log('');

  if (isTest) {
    await publish(topic, {
      title: 'OpenCode',
      message: 'Notificación de prueba ✅ (si ves esto, ntfy funciona)',
      priority: 'high',
      tags: ['white_check_mark'],
    });
    console.log(' Notificación de prueba enviada.');
    return;
  }

  console.log(' Vigilando permisos pendientes… (Ctrl+C para salir)');
  const seen = new Set();
  setInterval(async () => {
    try {
      const perms = await pendingPermissions(svc);
      for (const p of perms) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        const what = p.message?.trim() || p.action;
        await publish(topic, {
          title: '⚠️ Permiso pendiente',
          message: `${what}${p.resources?.length ? '\n' + p.resources.join(', ') : ''}`,
          priority: 'high',
          tags: ['lock'],
          actions: [
            { action: 'http', label: 'Permitir', url: `https://ntfy.sh/${resTopic}`, method: 'POST', body: `allow:${p.id}`, clear: true },
            { action: 'http', label: 'Rechazar', url: `https://ntfy.sh/${resTopic}`, method: 'POST', body: `deny:${p.id}`, clear: true },
          ],
        });
        console.log(' Aviso enviado:', what);
      }
    } catch (e) {
      console.error(' error:', e.message);
    }
  }, 3000);
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
