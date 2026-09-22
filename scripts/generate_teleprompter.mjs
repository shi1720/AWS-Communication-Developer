import fs from "node:fs/promises";
import assert from "node:assert/strict";
const source = await fs.readFile("docs/VIDEO_SCRIPT.md", "utf8");
const body = source
  .split("## Verbatim script")[1]
  .split("## Action storyboard")[0];
const scenes = [
  ...body.matchAll(/### ([^\n]+)\n\n([\s\S]*?)(?=\n\n### |$)/g),
].map(([, time, text]) => ({ time, text: text.trim() }));
assert.equal(scenes.length, 8);
assert.equal(
  scenes
    .map((s) => s.text)
    .join(" ")
    .split(/\s+/).length,
  361,
);
const rehearsal = source
  .split("## Exact rehearsal replacement:")[1]
  .match(/\n> (.+)/)[1];
const whatsapp = source
  .split("## Optional verified WhatsApp cut")[1]
  .match(/\n> (.+)/)[1];
const scriptData = JSON.stringify({ scenes, rehearsal, whatsapp }).replaceAll(
  "<",
  "\\u003c",
);
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; connect-src 'none'; img-src 'none'"><title>SecondCrate · Shivam’s teleprompter</title>
<style>
:root{--bg:#14291f;--surface:#1e392c;--ink:#f7f8f5;--muted:#aebfac;--line:#3c5645;--accent:#d4e9a8;--accentink:#183729;--warning:#f1b996;--size:48px;color-scheme:dark;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink)}body.light{--bg:#f7f8f5;--surface:#fff;--ink:#183729;--muted:#617065;--line:#d8ded5;--accent:#244c3a;--accentink:#f7f8f5;--warning:#8e4828;color-scheme:light}header{padding:22px 32px 14px;border-bottom:1px solid var(--line);background:var(--bg)}.top{display:flex;justify-content:space-between;align-items:center;gap:20px}.brand{font-size:24px;letter-spacing:-1px;font-weight:750}.subtitle{font-size:12px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);margin-top:5px}.clock{font-size:32px;font-weight:650;font-variant-numeric:tabular-nums;letter-spacing:-1px}.clock small{color:var(--muted);font-size:16px;letter-spacing:0}.toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:20px}button,select{border:1px solid var(--line);background:var(--surface);color:var(--ink);padding:11px 14px;border-radius:7px;font:inherit;font-size:14px}button{cursor:pointer}button:hover{border-color:var(--accent)}button:focus-visible,select:focus-visible,input:focus-visible,#reader:focus-visible{outline:3px solid var(--warning);outline-offset:3px}.primary{background:var(--accent);color:var(--accentink);border-color:var(--accent);min-width:100px;font-weight:700}label{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted)}input[type=range]{width:105px;accent-color:var(--accent)}output{font-variant-numeric:tabular-nums;min-width:36px;color:var(--ink)}.notice{font-size:12px;line-height:1.55;margin:15px 0 0;color:var(--warning);max-width:1000px}.bar{height:3px;background:var(--surface)}#progress{height:100%;width:0;background:var(--accent)}.reading-shell{position:relative}#reader{height:calc(100dvh - 253px);min-height:300px;overflow-y:auto;scroll-behavior:auto;overscroll-behavior:contain;padding:42px max(32px,calc((100vw - 1050px)/2)) 30vh;scrollbar-color:var(--line) var(--bg)}section{margin-bottom:70px}section .stamp{display:block;font-size:13px;color:var(--accent);letter-spacing:.14em;font-weight:700;margin-bottom:20px}section p{font-size:var(--size);line-height:1.47;font-weight:450;letter-spacing:-.025em;margin:0}.stage{margin-top:60px;font-size:18px!important;color:var(--muted);text-align:center}.guide{position:absolute;left:12px;top:72px;width:6px;height:44px;background:var(--accent);border-radius:4px;pointer-events:none}footer{position:fixed;bottom:0;left:0;right:0;display:flex;justify-content:space-between;gap:20px;background:var(--bg);border-top:1px solid var(--line);padding:11px 32px;font-size:11px;color:var(--muted);line-height:1.6}kbd{font:inherit;font-weight:700;color:var(--ink)}.footer-status{white-space:nowrap}dialog{max-width:530px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--ink);padding:28px}dialog::backdrop{background:#0009}dialog p{line-height:1.6;color:var(--muted)}dialog label{align-items:flex-start;font-size:14px;line-height:1.5;margin:20px 0}dialog h2{font-size:23px;margin:0}.dialog-actions{display:flex;gap:10px;justify-content:flex-end}@media(max-width:700px){header{padding:16px}.brand{font-size:22px}.clock{font-size:27px}.toolbar{gap:8px;margin-top:15px}.toolbar label{font-size:11px}input[type=range]{width:72px}button,select{padding:9px 10px;font-size:12px}#reader{height:calc(100dvh - 300px);padding:30px 26px 30vh}.notice{font-size:11px}.subtitle{font-size:10px}footer{padding:8px 16px;font-size:10px}section p{font-size:min(var(--size),38px)}section .stamp{font-size:11px}section{margin-bottom:46px}.guide{left:9px;top:55px;width:4px}footer .keys{max-width:72%}}
</style></head><body>
<header><div class="top"><div><div class="brand">SecondCrate</div><div class="subtitle">Shivam Gupta · recording companion</div></div><div class="clock"><span id="elapsed">0:00</span> <small>/ 3:00</small></div></div>
<div class="toolbar"><button id="play" class="primary" type="button" aria-pressed="false">Start</button><button id="reset" type="button">Reset</button><label>Cut <select id="cut"><option value="rehearsal">Rehearsal · no live claims</option><option value="aws">Verified Bedrock + SES</option><option value="whatsapp">Verified WhatsApp</option></select></label><label>Type <input id="size" type="range" min="28" max="72" value="48" aria-label="Narration font size"><output id="sizeValue">48px</output></label><label>Pace <input id="pace" type="range" min="0.5" max="1.75" step="0.05" value="1" aria-label="Scroll speed multiplier"><output id="paceValue">1×</output></label><button id="theme" type="button" aria-label="Switch to light theme">Light</button><button id="full" type="button">Full screen</button></div>
<p class="notice" id="notice">Development preview. AWS deployment and live service verification remain pending. This cut uses the exact rehearsal replacement at 2:13.</p></header>
<div class="bar" aria-hidden="true"><div id="progress"></div></div><div class="reading-shell"><div class="guide" aria-hidden="true"></div><main id="reader" tabindex="0" aria-label="Verbatim spoken script"></main></div>
<footer><div class="keys"><kbd>Space</kbd> play / pause · <kbd>R</kbd> reset · <kbd>+</kbd> / <kbd>−</kbd> type · <kbd>↑</kbd> / <kbd>↓</kbd> pace · <kbd>T</kbd> theme · <kbd>F</kbd> full screen</div><span id="status" class="footer-status">Ready · offline</span></footer>
<dialog id="gate"><h2>Use verified evidence only</h2><p id="gateText"></p><label><input id="evidence" type="checkbox">I have captured the matching real AWS evidence and will show the actual provider status in the video.</label><div class="dialog-actions"><button id="cancelGate" type="button">Keep rehearsal</button><button id="confirmGate" class="primary" type="button" disabled>Use verified cut</button></div></dialog>
<script id="script-data" type="application/json">${scriptData}</script>
<script>
'use strict';
const data=JSON.parse(document.getElementById('script-data').textContent);
const el=id=>document.getElementById(id);const reader=el('reader');
let running=false,elapsed=0,last=0,scrollPosition=0,mode='rehearsal';
const copy={rehearsal:'Development preview. AWS deployment and live service verification remain pending. This cut uses the exact rehearsal replacement at 2:13.',aws:'Verified AWS cut. Show the actual Bedrock invocation and SES provider result. Keep any unconnected channels visibly simulated.',whatsapp:'Verified WhatsApp cut. Show genuine EUM Social outbound and inbound evidence, Bedrock interpretation and the matching SES result.'};
function draw(){reader.replaceChildren();data.scenes.forEach((scene,i)=>{const section=document.createElement('section');const time=document.createElement('span');time.className='stamp';time.textContent=scene.time;const p=document.createElement('p');p.textContent=i===6?(mode==='rehearsal'?data.rehearsal:mode==='whatsapp'?data.whatsapp:scene.text):scene.text;section.append(time,p);reader.append(section)});const ending=document.createElement('p');ending.className='stage';ending.textContent='End of narration · hold the closing frame';reader.append(ending);el('notice').textContent=copy[mode];reset()}
function update(){const seconds=Math.floor(elapsed);el('elapsed').textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');el('progress').style.width=Math.min(100,elapsed/180*100)+'%';el('play').textContent=running?'Pause':elapsed>=180?'Replay':elapsed?'Resume':'Start';el('play').setAttribute('aria-pressed',String(running));el('status').textContent=elapsed>=180?'3:00 reached · review take':running?'Reading · offline':elapsed?'Paused · offline':'Ready · offline'}
function reset(){running=false;elapsed=0;last=0;scrollPosition=0;reader.scrollTop=0;update()}
function toggle(){if(elapsed>=180)reset();running=!running;last=0;scrollPosition=reader.scrollTop;update()}
function frame(now){if(running){if(last){const dt=Math.min((now-last)/1000,0.25);elapsed=Math.min(180,elapsed+dt);const distance=Math.max(0,reader.scrollHeight-reader.clientHeight);scrollPosition=Math.min(distance,scrollPosition+distance/180*Number(el('pace').value)*dt);reader.scrollTop=scrollPosition;if(elapsed>=180)running=false;update()}last=now}else last=0;requestAnimationFrame(frame)}
function sizing(){document.documentElement.style.setProperty('--size',el('size').value+'px');el('sizeValue').value=el('size').value+'px';scrollPosition=reader.scrollTop}
function pacing(){el('paceValue').value=Number(el('pace').value).toFixed(2).replace(/0+$/,'').replace(/\\.$/,'')+'×'}
function theme(){document.body.classList.toggle('light');const light=document.body.classList.contains('light');el('theme').textContent=light?'Dark':'Light';el('theme').setAttribute('aria-label','Switch to '+(light?'dark':'light')+' theme')}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{el('status').textContent='Use the browser’s full-screen control'}}
el('play').onclick=toggle;el('reset').onclick=reset;el('theme').onclick=theme;el('full').onclick=fullscreen;el('size').oninput=sizing;el('pace').oninput=pacing;
el('cut').onchange=()=>{running=false;update();if(el('cut').value==='rehearsal'){mode='rehearsal';draw();return}el('gateText').textContent=el('cut').value==='aws'?'This script says Bedrock interpreted a request and SES returned a genuine provider message identifier. A configured adapter or simulated receipt is insufficient.':'This script says an inbound WhatsApp reply passed through AWS End User Messaging Social and SES sent the matching email. Both directions of Social messaging and the email result must be verified.';el('evidence').checked=false;el('confirmGate').disabled=true;el('gate').showModal()};
el('evidence').onchange=()=>el('confirmGate').disabled=!el('evidence').checked;
el('cancelGate').onclick=()=>{el('cut').value=mode;el('gate').close()};el('gate').addEventListener('cancel',()=>el('cut').value=mode);
el('confirmGate').onclick=()=>{if(!el('evidence').checked)return;mode=el('cut').value;el('gate').close();draw()};
reader.addEventListener('wheel',()=>{running=false;update()},{passive:true});reader.addEventListener('touchstart',()=>{running=false;update()},{passive:true});
document.addEventListener('keydown',event=>{if(el('gate').open||/INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target.tagName))return;const key=event.key.toLowerCase();if([' ','r','t','f','+','=','-','arrowup','arrowdown'].includes(key))event.preventDefault();if(key===' ')toggle();if(key==='r')reset();if(key==='t')theme();if(key==='f')fullscreen();if(key==='+'||key==='='||key==='-'){el('size').value=Number(el('size').value)+(key==='-'?-2:2);sizing()}if(key==='arrowup'||key==='arrowdown'){el('pace').value=Number(el('pace').value)+(key==='arrowup'?0.05:-0.05);pacing()}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){running=false;update()}});
draw();sizing();pacing();requestAnimationFrame(frame);
</script></body></html>`;
await fs.writeFile("deliverables/SecondCrate-Teleprompter.html", html);
console.log(
  "Created SecondCrate-Teleprompter.html from exact narration; 361 words in verified-AWS cut.",
);
