/** Screenshot confiável: espera o scroll assentar e captura a seção inteira. */
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { setTimeout as espera } from 'node:timers/promises';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORTA = 9339;
const DIR = 'C:\\Users\\Leonardo\\Documents\\Coding\\prefeitura\\v2\\.tmp';

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORTA}`,
  '--window-size=1440,1100', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${DIR}\\perfil-shot2`, 'about:blank',
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

function envia(method, params = {}, sessionId) {
  const i = ++id;
  return new Promise((resolve, reject) => {
    pend.set(i, { resolve, reject });
    ws.send(JSON.stringify({ id: i, method, params, sessionId }));
  });
}

const { targetId } = await envia('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await envia('Target.attachToTarget', { targetId, flatten: true });
await envia('Page.enable', {}, sessionId);
await envia('Runtime.enable', {}, sessionId);
await envia('Page.navigate', { url: 'http://localhost:5182/' }, sessionId);
await espera(4500);

const avalia = async (expr) => {
  const r = await envia('Runtime.evaluate',
    { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
  if (r.exceptionDetails) return { __erro: r.exceptionDetails.text };
  return r.result?.value;
};

const tema = process.argv[2] ?? 'claro';
const saida = process.argv[3] ?? `${DIR}\\heatmap-final.png`;

// Grava a preferência antes de recarregar: o app lê o localStorage na
// inicialização, então só trocar o atributo depois não basta.
await avalia(`localStorage.setItem('observatorio-tema','${tema}'); true`);
await envia('Page.reload', {}, sessionId);
await espera(4200);
await avalia(`document.documentElement.dataset.tema='${tema}'; true`);
await espera(1500);

// Rola até o heatmap e espera o IntersectionObserver + render.
await avalia(`
  (() => {
    const el = document.querySelector('#mapa .cartao-pad');
    if (!el) return false;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: 'instant' });
    return true;
  })()
`);
await espera(2200);

// Confirma que o canvas está visível na viewport e tem conteúdo.
const info = await avalia(`
  (() => {
    const cv = document.querySelector('#mapa canvas');
    if (!cv) return { erro: 'sem canvas' };
    const r = cv.getBoundingClientRect();
    const ctx = cv.getContext('2d');
    const img = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let opaco = 0;
    for (let p = 0; p < img.length; p += 4) if (img[p+3] > 20) opaco++;
    return {
      naViewport: r.top >= 0 && r.bottom <= window.innerHeight + 20,
      topo: Math.round(r.top), base: Math.round(r.bottom),
      alturaViewport: window.innerHeight,
      w: cv.width, h: cv.height, opaco,
    };
  })()
`);
console.log(JSON.stringify(info));

const shot = await envia('Page.captureScreenshot', { format: 'png' }, sessionId);
await writeFile(saida, Buffer.from(shot.data, 'base64'));
console.log('salvo:', saida);

ws.close();
chrome.kill();
