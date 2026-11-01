/**
 * Verificação visual do site com Chrome headless.
 *
 * Navega pelas seções, confere que os gráficos renderizaram, coleta erros de
 * console e salva screenshots. Falha com código 1 se encontrar erro real.
 */
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { setTimeout as espera } from 'node:timers/promises';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORTA_CDP = 9334;
const URL = process.argv[2] ?? 'http://localhost:5182/';
const DIR = 'C:\\Users\\Leonardo\\Documents\\Coding\\prefeitura\\v2\\.tmp';

await mkdir(DIR, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORTA_CDP}`,
    '--window-size=1440,1000',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${DIR}\\perfil-site`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function esperaCDP() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORTA_CDP}/json/version`);
      if (r.ok) return await r.json();
    } catch {
      /* subindo */
    }
    await espera(250);
  }
  throw new Error('CDP não respondeu');
}

const versao = await esperaCDP();
const ws = new WebSocket(versao.webSocketDebuggerUrl);

let idMsg = 0;
const pendentes = new Map();
const errosConsole = [];
const errosRede = [];

ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pendentes.has(m.id)) {
    const { resolve, reject } = pendentes.get(m.id);
    pendentes.delete(m.id);
    if (m.error) reject(new Error(JSON.stringify(m.error)));
    else resolve(m.result);
    return;
  }
  if (m.method === 'Runtime.exceptionThrown') {
    errosConsole.push(m.params.exceptionDetails?.text ?? 'exceção');
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    errosConsole.push(
      m.params.args.map((a) => a.value ?? a.description ?? '').join(' '),
    );
  }
  if (m.method === 'Network.loadingFailed') {
    errosRede.push(m.params.errorText ?? 'falha de rede');
  }
});

await new Promise((ok) => ws.addEventListener('open', ok));

function envia(method, params = {}, sessionId) {
  const id = ++idMsg;
  return new Promise((resolve, reject) => {
    pendentes.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

const { targetId } = await envia('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await envia('Target.attachToTarget', { targetId, flatten: true });

await envia('Page.enable', {}, sessionId);
await envia('Runtime.enable', {}, sessionId);
await envia('Network.enable', {}, sessionId);
await envia(
  'Emulation.setDeviceMetricsOverride',
  { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false },
  sessionId,
);

await envia('Page.navigate', { url: URL }, sessionId);
await espera(4500);

async function avalia(expr) {
  const r = await envia(
    'Runtime.evaluate',
    { expression: expr, awaitPromise: true, returnByValue: true },
    sessionId,
  );
  if (r.exceptionDetails) {
    throw new Error(`avalia falhou: ${JSON.stringify(r.exceptionDetails).slice(0, 300)}`);
  }
  return r.result?.value;
}

console.log('--- estado inicial ---');
console.log('app montou:', await avalia('!!document.querySelector("main")'));
console.log(
  'KPIs no hero:',
  await avalia('document.querySelectorAll(".kpi").length'),
);

// Rola por cada seção e conta os canvas (um por gráfico renderizado).
const secoes = [
  'mapa',
  'execucao',
  'receitas',
  'compras',
  'pessoal',
  'divida',
  'camara',
  'auditoria',
  'metodologia',
];

for (const id of secoes) {
  await avalia(
    `document.getElementById('${id}')?.scrollIntoView({behavior:'instant',block:'start'})`,
  );
  await espera(900);
  const canvas = await avalia(`document.querySelectorAll('#${id} canvas').length`);
  const tabelas = await avalia(`document.querySelectorAll('#${id} table').length`);
  console.log(`  ${id.padEnd(14)} canvas=${canvas}  tabelas=${tabelas}`);
}

// Volta ao topo e tira screenshot da primeira dobra.
await avalia(`window.scrollTo({top:0,behavior:'instant'})`);
await espera(600);
let shot = await envia('Page.captureScreenshot', { format: 'png' }, sessionId);
await writeFile(`${DIR}\\site-hero.png`, Buffer.from(shot.data, 'base64'));

// Screenshot da seção principal.
await avalia(
  `document.getElementById('mapa')?.scrollIntoView({behavior:'instant',block:'start'})`,
);
await espera(1400);
shot = await envia('Page.captureScreenshot', { format: 'png' }, sessionId);
await writeFile(`${DIR}\\site-mapa.png`, Buffer.from(shot.data, 'base64'));

// Tema escuro.
await avalia(`document.documentElement.dataset.tema='escuro'`);
await espera(1600);
shot = await envia('Page.captureScreenshot', { format: 'png' }, sessionId);
await writeFile(`${DIR}\\site-mapa-escuro.png`, Buffer.from(shot.data, 'base64'));

// Mobile.
await envia(
  'Emulation.setDeviceMetricsOverride',
  { width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
  sessionId,
);
await avalia(`document.documentElement.dataset.tema='claro'`);
await avalia(`window.scrollTo({top:0,behavior:'instant'})`);
await espera(1200);
shot = await envia('Page.captureScreenshot', { format: 'png' }, sessionId);
await writeFile(`${DIR}\\site-mobile.png`, Buffer.from(shot.data, 'base64'));

console.log('\n--- erros ---');
const errosReais = errosConsole.filter(
  (e) => !/favicon|Font|net::ERR/i.test(e),
);
const redeReais = errosRede.filter((e) => !/favicon/i.test(e));
console.log('console:', errosReais.length ? errosReais : 'nenhum');
console.log('rede:', redeReais.length ? redeReais : 'nenhum');

ws.close();
chrome.kill();

process.exit(errosReais.length ? 1 : 0);
