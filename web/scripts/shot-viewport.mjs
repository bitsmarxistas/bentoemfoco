/** Screenshot de viewport de uma seção (sem captureBeyondViewport). */
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { setTimeout as espera } from 'node:timers/promises';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORTA = 9344;
const DIR = 'C:\\Users\\Leonardo\\Documents\\Coding\\prefeitura\\v2\\.tmp';

const secao = process.argv[2] ?? 'mapa';
const tema = process.argv[3] ?? 'claro';
const saida = process.argv[4] ?? `${DIR}\\viewport-${secao}.png`;

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORTA}`,
  '--window-size=1440,1000', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${DIR}\\perfil-vp-${Date.now()}`, 'about:blank',
], { stdio: 'ignore' });

async function cdp() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORTA}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch { /* sobe */ }
    await espera(250);
  }
  throw new Error('CDP não respondeu');
}

const ws = new WebSocket(await cdp());
let id = 0;
const pend = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (!m.id || !pend.has(m.id)) return;
  const p = pend.get(m.id);
  pend.delete(m.id);
  m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
});
await new Promise((ok) => ws.addEventListener('open', ok));

const envia = (method, params = {}, sessionId) => {
  const i = ++id;
  return new Promise((resolve, reject) => {
    pend.set(i, { resolve, reject });
    ws.send(JSON.stringify({ id: i, method, params, sessionId }));
  });
};

const { targetId } = await envia('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await envia('Target.attachToTarget', { targetId, flatten: true });
await envia('Page.enable', {}, sessionId);
await envia('Runtime.enable', {}, sessionId);
await envia('Page.navigate', { url: 'http://localhost:5182/' }, sessionId);
await espera(3200);

const avalia = async (expr) => {
  const r = await envia('Runtime.evaluate',
    { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
  if (r.exceptionDetails) return { __erro: r.exceptionDetails.text };
  return r.result?.value;
};

await avalia(`localStorage.setItem('observatorio-tema','${tema}'); true`);
await envia('Page.reload', {}, sessionId);
await espera(4200);

// Rola até a seção e deixa o IntersectionObserver disparar os gráficos.
await avalia(`
  (() => {
    const el = document.getElementById('${secao}');
    if (!el) return false;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + 120, behavior: 'instant' });
    return true;
  })()
`);
await espera(2800);

// Confere a largura real dos canvases — se algum ficou estreito, é bug.
const larguras = await avalia(`
  (() => {
    const cvs = [...document.querySelectorAll('#${secao} canvas')];
    return cvs.map(c => ({ w: c.width, h: c.height, cssW: Math.round(c.getBoundingClientRect().width) }));
  })()
`);
console.log('canvases:', JSON.stringify(larguras));

const shot = await envia('Page.captureScreenshot', { format: 'png' }, sessionId);
await writeFile(saida, Buffer.from(shot.data, 'base64'));
console.log('salvo:', saida);

ws.close();
chrome.kill();
