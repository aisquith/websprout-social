// Builds the Instagram story slides (1080x1920) and highlight covers (1080x1080) for Websprout's profile highlights.
//   node make-highlights.js            -> writes highlights/*.jpg
// Slides show real example sites from websprout.app/example. Key content stays clear of Instagram's top and bottom bars.
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const OUT = path.join(__dirname, 'highlights');
const SITE = 'https://websprout.app';
function chrome() {
  const c = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'].filter(Boolean);
  for (const p of c) if (fs.existsSync(p)) return p;
  try { return require('puppeteer').executablePath(); } catch (e) { throw new Error('Chrome not found; set CHROME_PATH'); }
}

const SPROUT = (s, c) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none"><path d="M12 21V12" stroke="${c}" stroke-width="2.3" stroke-linecap="round"/><path d="M12 14.5C10.4 9.8 6.2 7.6 3 8.2C3.4 13 7.6 15.5 12 14.5Z" fill="${c}"/><path d="M12 13C13.5 8.2 17.8 6 21 6.6C20.6 11.4 16.4 13.9 12 13Z" fill="${c}"/></svg>`;
const TICK = `<svg viewBox="0 0 20 20" width="44" height="44" fill="none"><circle cx="10" cy="10" r="9" fill="rgba(52,211,153,.18)"/><path d="M6 10.4l2.6 2.6L14 7.6" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const BASE = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1920px;overflow:hidden;position:relative;font-family:Inter,-apple-system,Arial,sans-serif;color:#fff;
 background:radial-gradient(1100px 760px at 50% 8%,rgba(52,211,153,.30),transparent 62%),radial-gradient(800px 600px at 96% 62%,rgba(34,211,238,.14),transparent 60%),radial-gradient(800px 700px at 0% 90%,rgba(34,197,94,.16),transparent 60%),#050a04}
body::before{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.06) 1.5px,transparent 1.6px);background-size:54px 54px;-webkit-mask-image:radial-gradient(900px 900px at 50% 30%,#000,transparent 75%)}
.brand{position:absolute;left:0;right:0;top:268px;display:flex;align-items:center;justify-content:center;gap:16px;font-family:Sora,sans-serif;font-weight:800;font-size:44px;letter-spacing:-1.2px}
.brand i{width:64px;height:64px;border-radius:18px;background:linear-gradient(145deg,#3ea04e,#22692e);display:flex;align-items:center;justify-content:center}
.brand em{font-style:normal;color:#4ade80}
.eyebrow{position:absolute;left:0;right:0;top:392px;text-align:center;font-size:30px;font-weight:700;letter-spacing:7px;text-transform:uppercase;color:#4ade80}
h1{position:absolute;left:80px;right:80px;top:452px;text-align:center;font-family:Sora,sans-serif;font-weight:800;font-size:92px;line-height:1.05;letter-spacing:-3.2px}
h1 em{font-style:normal;background:linear-gradient(100deg,#4ade80,#22d3ee);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{position:absolute;left:110px;right:110px;text-align:center;font-size:40px;line-height:1.45;color:rgba(255,255,255,.76)}
.foot{position:absolute;left:0;right:0;bottom:262px;text-align:center;font-size:36px;font-weight:600;color:rgba(255,255,255,.78)}
.foot b{color:#4ade80;font-weight:700}
.card{position:absolute;left:90px;right:90px;border-radius:44px;background:rgba(13,26,12,.82);border:2px solid rgba(255,255,255,.14);box-shadow:0 60px 120px -40px rgba(0,0,0,.9),0 0 110px -30px rgba(52,211,153,.55);padding:56px}
.lbl{font-size:27px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.6);margin-bottom:14px}
.field{height:104px;border-radius:22px;background:rgba(255,255,255,.07);border:2px solid rgba(255,255,255,.16);display:flex;align-items:center;padding:0 32px;font-size:42px;font-weight:500;margin-bottom:38px}
.field u{display:inline-block;width:4px;height:50px;background:#4ade80;margin-left:6px;text-decoration:none}
.btn{height:112px;border-radius:24px;background:linear-gradient(135deg,#4ade80,#16a34a);color:#06210f;font-size:42px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:16px}
.phone{position:absolute;left:50%;transform:translateX(-50%);width:520px;border-radius:64px;padding:14px;background:#0a0f0a;border:2px solid rgba(255,255,255,.24);box-shadow:0 70px 130px -40px rgba(0,0,0,.95),0 0 130px -30px rgba(52,211,153,.6)}
.phone div{border-radius:52px;overflow:hidden;background:#fff}.phone img{display:block;width:100%}
.browser{position:absolute;left:60px;right:60px;border-radius:30px;overflow:hidden;background:#0c160a;border:2px solid rgba(255,255,255,.18);box-shadow:0 70px 130px -40px rgba(0,0,0,.95),0 0 130px -30px rgba(52,211,153,.6)}
.bar{height:70px;background:#101c0e;display:flex;align-items:center;gap:12px;padding:0 26px}
.bar s{width:17px;height:17px;border-radius:50%;background:rgba(255,255,255,.22)}
.bar span{flex:1;margin:0 16px;height:42px;line-height:42px;border-radius:13px;background:rgba(255,255,255,.07);text-align:center;font-size:23px;color:rgba(255,255,255,.75)}
.browser img{display:block;width:100%}
.url{position:absolute;left:50%;transform:translateX(-50%);white-space:nowrap;display:flex;align-items:center;gap:20px;height:112px;padding:0 48px;border-radius:100px;background:rgba(8,18,9,.9);border:2px solid rgba(74,222,128,.55);font-size:40px;font-weight:600;box-shadow:0 0 90px -16px rgba(52,211,153,.75)}
.url i{width:22px;height:22px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 10px rgba(74,222,128,.18)}
.ticks{position:absolute;left:150px;right:150px;display:flex;flex-direction:column;gap:34px}
.ticks div{display:flex;align-items:center;gap:22px;font-size:42px;font-weight:500;color:rgba(255,255,255,.9)}
.tag{position:absolute;left:0;right:0;text-align:center;font-size:30px;color:rgba(255,255,255,.6)}
.plans{position:absolute;left:70px;right:70px;top:740px;display:flex;flex-direction:column;gap:34px}
.plan{border-radius:40px;padding:46px 52px;background:rgba(13,26,12,.82);border:2px solid rgba(255,255,255,.14)}
.plan.pick{border-color:rgba(52,211,153,.6);box-shadow:0 0 110px -30px rgba(52,211,153,.6)}
.plan h2{font-family:Sora,sans-serif;font-size:50px;font-weight:800;display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px}
.plan h2 b{font-size:66px;color:#4ade80}.plan h2 small{font-size:30px;font-weight:600;color:rgba(255,255,255,.6)}
.plan p{font-size:30px;color:rgba(255,255,255,.62);margin-bottom:22px}
.plan li{list-style:none;display:flex;align-items:center;gap:16px;font-size:34px;color:rgba(255,255,255,.88);padding:7px 0}
.plan li svg{width:36px;height:36px;flex:none}
</style></head><body>
<div class="brand"><i>${SPROUT(44, '#fff')}</i><span>Web<em>sprout</em></span></div>`;
const page = (inner) => BASE + inner + '</body></html>';
const foot = '<div class="foot">Make yours free at <b>websprout.app</b></div>';

function slides(shots) {
  const ex = (key, name, kind, host) => page(`<div class="eyebrow">Example site</div><h1>${name}</h1>
<div class="sub" style="top:${name.length > 16 ? 672 : 580}px">${kind}, grown from just a name and a business type.</div>
<div class="phone" style="top:${name.length > 16 ? 830 : 760}px;height:${name.length > 16 ? 690 : 760}px;overflow:hidden;border-bottom-left-radius:0;border-bottom-right-radius:0;border-bottom:0"><div style="border-bottom-left-radius:0;border-bottom-right-radius:0"><img src="${shots[key + 'Phone']}"></div></div>
<div class="tag" style="bottom:336px">Example business · ${host}</div>${foot}`);
  return {
    'how-1': page(`<div class="eyebrow">How it works · 1 of 3</div><h1>Plant <em>your idea.</em></h1>
<div class="sub" style="top:690px">Your business name and what you do. That is all it takes.</div>
<div class="card" style="top:900px"><div class="lbl">Business name</div><div class="field">Marguerite Bakery<u></u></div><div class="lbl">What kind of business?</div><div class="field">Bakery</div><div class="btn">Grow my site →</div></div>${foot}`),
    'how-2': page(`<div class="eyebrow">How it works · 2 of 3</div><h1>Watch it <em>grow.</em></h1>
<div class="sub" style="top:580px">A complete site in seconds: real pages, working navigation and a contact form.</div>
<div class="browser" style="top:800px"><div class="bar"><s></s><s></s><s></s><span>rosa-verde.websprout.app</span></div><img src="${shots.rosaDesk}"></div>
<div class="tag" style="bottom:336px">A real site from the builder</div>${foot}`),
    'how-3': page(`<div class="eyebrow">How it works · 3 of 3</div><h1>Launch it <em>free.</em></h1>
<div class="sub" style="top:580px">Publish at your own websprout.app address. No credit card.</div>
<div class="url" style="top:820px"><i></i>yourname.websprout.app</div>
<div class="ticks" style="top:1030px"><div>${TICK}Free to build and publish</div><div>${TICK}Click any text or photo to edit</div><div>${TICK}Messages go to your inbox</div><div>${TICK}Your own domain with Pro</div></div>${foot}`),
    'ex-1': ex('rosa', 'Rosa Verde', 'A restaurant', 'rosa-verde.websprout.app'),
    'ex-2': ex('fade', 'Fade &amp; Co.', 'A barber shop', 'fade-co.websprout.app'),
    'ex-3': ex('petal', 'Petal &amp; Stem', 'A wedding florist', 'petal-stem.websprout.app'),
    'pricing': page(`<div class="eyebrow">Pricing</div><h1>Plant for free.<br><em>Own it for $10.</em></h1>
<div class="plans">
<div class="plan"><h2>Free <b>$0</b></h2><p>Always free to grow</p><ul><li>${TICK}Publish a live website</li><li>${TICK}Unlimited websites</li><li>${TICK}Full visual editor</li></ul></div>
<div class="plan pick"><h2>Pro <span><b>$10</b><small>/mo</small></span></h2><p>7 days free, then $10 a month. Cancel anytime.</p><ul><li>${TICK}No Websprout badge</li><li>${TICK}Connect your own domain</li><li>${TICK}Download the code</li></ul></div>
</div>${foot}`),
  };
}

const ICONS = {
  how: '<path d="M12 21V12"/><path d="M12 14.5C10.4 9.8 6.2 7.6 3 8.2C3.4 13 7.6 15.5 12 14.5Z"/><path d="M12 13C13.5 8.2 17.8 6 21 6.6C20.6 11.4 16.4 13.9 12 13Z"/>',
  examples: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M3 9h18M7 13h6M7 16h4"/>',
  pricing: '<path d="M12 3v18M16.5 7.5c-.8-1.3-2.4-2-4.5-2-2.3 0-4 1.2-4 3 0 4.5 9 2 9 6.5 0 1.9-1.9 3-4.5 3-2.3 0-4-.8-4.9-2.3"/>',
};
const cover = (k) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0}body{width:1080px;height:1080px;display:flex;align-items:center;justify-content:center;background:radial-gradient(620px 620px at 50% 42%,rgba(52,211,153,.42),transparent 70%),#050a04}svg{width:330px;height:330px}</style></head><body><svg viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg></body></html>`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: chrome(), headless: 'new', args: ['--no-sandbox', '--font-render-hinting=none'] });
  const grab = async (i, w, h, clipH) => {
    const p = await browser.newPage();
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: w < 600, hasTouch: w < 600 });
    await p.goto(SITE + '/example?i=' + i, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1800));
    const b = await p.screenshot({ type: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: w, height: clipH || h } });
    await p.close();
    return 'data:image/jpeg;base64,' + Buffer.from(b).toString('base64');
  };
  const shots = { rosaDesk: await grab(1, 1280, 900), rosaPhone: await grab(1, 390, 844, 620), fadePhone: await grab(0, 390, 844, 620), petalPhone: await grab(5, 390, 844, 620) };
  const all = slides(shots);
  const render = async (html, w, h, file) => {
    const p = await browser.newPage();
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await p.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    await p.evaluate(() => document.fonts && document.fonts.ready);
    await p.screenshot({ path: path.join(OUT, file), type: 'jpeg', quality: 92 });
    await p.close();
  };
  for (const k of Object.keys(all)) await render(all[k], 1080, 1920, k + '.jpg');
  for (const k of Object.keys(ICONS)) await render(cover(k), 1080, 1080, 'cover-' + k + '.jpg');
  await browser.close();
  console.log(JSON.stringify({ ok: true, files: fs.readdirSync(OUT) }));
})().catch((e) => { console.error(e); process.exit(1); });
