// Builds one Instagram post image (1080x1350 JPEG) for Websprout:
//   1. asks the live builder (websprout.app/create) to make a real site for a business,
//   2. screenshots it on a desktop and a phone screen,
//   3. lays both out on a branded card with a headline.
//
// Usage:
//   node make-post.js --name "Rosie's Bakery" --type "Bakery" --city "Austin" \
//     --headline "A bakery website in 10 seconds." --out posts/2026-11-18.jpg
//
// Needs the `puppeteer` package (downloads its own Chrome), or CHROME_PATH pointing at an installed Chrome.
const fs = require('fs');
const path = require('path');

function arg(name, def) { const i = process.argv.indexOf('--' + name); return i > -1 ? process.argv[i + 1] : def; }
const name = arg('name', 'Maple Street Bakery');
const type = arg('type', 'Bakery');
const city = arg('city', 'Austin');
const headline = arg('headline', 'A ' + type.toLowerCase() + ' website in 10 seconds.');
const sub = arg('sub', 'Type your business name. Get a real website. Free.');
const out = arg('out', 'post.jpg');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function launch() {
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require('puppeteer-core'); }
  const opts = { headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'] };
  if (process.env.CHROME_PATH) opts.executablePath = process.env.CHROME_PATH;
  return puppeteer.launch(opts);
}

// Niche pages on websprout.app/example?n=<slug> (public, same generator). Used when /create is unavailable.
const NICHES = { 'barbershop':'Barbershop','hair-salon':'Hair Salon','nail-salon':'Nail Salon','tattoo-studio':'Tattoo Studio','restaurant':'Restaurant','cafe':'Cafe','food-truck':'Food Truck','bakery':'Bakery','plumber':'Plumber','electrician':'Electrician','hvac':'HVAC Company','landscaper':'Landscaping Business','cleaning-service':'Cleaning Service','handyman':'Handyman','roofer':'Roofing Company','auto-repair':'Auto Repair Shop','personal-trainer':'Personal Trainer','yoga-studio':'Yoga Studio','photographer':'Photographer','real-estate-agent':'Real Estate Agent','pet-groomer':'Pet Groomer','tutor':'Tutor','wedding-planner':'Wedding Planner','florist':'Florist' };
const ALIASES = { 'barber':'barbershop','salon':'hair-salon','hair':'hair-salon','nail':'nail-salon','tattoo':'tattoo-studio','coffee':'cafe','café':'cafe','truck':'food-truck','plumbing':'plumber','electric':'electrician','heating':'hvac','cooling':'hvac','air':'hvac','landscaping':'landscaper','lawn':'landscaper','cleaning':'cleaning-service','cleaner':'cleaning-service','maid':'cleaning-service','roofing':'roofer','auto':'auto-repair','mechanic':'auto-repair','trainer':'personal-trainer','fitness':'personal-trainer','gym':'personal-trainer','yoga':'yoga-studio','photography':'photographer','realtor':'real-estate-agent','dog':'pet-groomer','grooming':'pet-groomer','groomer':'pet-groomer','pet':'pet-groomer','tutoring':'tutor','wedding':'wedding-planner','flower':'florist','flowers':'florist','pizza':'restaurant','taco':'restaurant','diner':'restaurant' };
function nicheFor(t) {
  const low = t.toLowerCase();
  for (const slug of Object.keys(NICHES)) if (low === slug || low === NICHES[slug].toLowerCase()) return slug;
  for (const w of low.split(/[^a-zé]+/)) { if (NICHES[w]) return w; if (ALIASES[w]) return ALIASES[w]; }
  for (const slug of Object.keys(NICHES)) if (low.includes(slug.split('-')[0])) return slug;
  return null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function retry(label, tries, fn) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try { return await fn(); } catch (e) { last = e; if (e.status === 401 || e.status === 403) break; console.error(`[${label}] attempt ${i}/${tries} failed: ${e.message}`); if (i < tries) await sleep(Math.min(30000, 3000 * 2 ** (i - 1))); }
  }
  throw last;
}

// 1) the live builder (personalised AI copy). Optional WS_SESSION cookie for when it requires sign-in.
async function fromCreate() {
  const headers = { 'Content-Type': 'application/json', Origin: 'https://websprout.app', 'User-Agent': 'websprout-social-bot' };
  if (process.env.WS_SESSION) headers.Cookie = process.env.WS_SESSION;
  const r = await fetch('https://websprout.app/create', { method: 'POST', headers, body: JSON.stringify({ name, type, city }) });
  const j = await r.json().catch(() => ({}));
  if (!j.html) { const e = new Error('builder returned no site: ' + r.status + ' ' + JSON.stringify(j).slice(0, 200)); e.status = r.status; throw e; }
  return { html: j.html, source: 'create', type };
}
// 2) the public niche example, with the placeholder business swapped for ours.
async function fromExample() {
  const slug = nicheFor(type) || 'handyman';
  const r = await fetch('https://websprout.app/example?n=' + slug, { headers: { 'User-Agent': 'websprout-social-bot' } });
  if (!r.ok) throw new Error('example returned ' + r.status);
  let html = await r.text();
  if (!/<html/i.test(html)) throw new Error('example returned no html');
  const ph = 'Maple Street ' + NICHES[slug];
  // The hero splits the name over two lines: <span>Maple Street</span></span><span class="ln"><span ..>Plumber
  const words = esc(name).split(' '), cut = Math.max(1, Math.ceil(words.length / 2));
  const nicheRe = esc(NICHES[slug]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  html = html.replace(new RegExp('Maple Street((?:\\s*<[^>]+>\\s*)+)' + nicheRe, 'g'), (m, tags) => words.slice(0, cut).join(' ') + tags + (words.slice(cut).join(' ') || ''));
  html = html.split(ph).join(esc(name)).split(ph.replace(/&/g, '&amp;')).join(esc(name)).split('Springfield').join(esc(city));
  return { html, source: 'example:' + slug, type: nicheFor(type) ? type : NICHES[slug] };
}

(async () => {
  let j;
  try {
    j = await retry('create', 3, fromCreate);
  } catch (e) {
    console.error('falling back to /example: ' + e.message);
    j = await retry('example', 4, fromExample);
  }
  const browser = await launch();
  const shot = async (w, h, scale) => {
    const p = await browser.newPage();
    await p.setViewport({ width: w, height: h, deviceScaleFactor: scale });
    await p.setContent(j.html, { waitUntil: 'networkidle0', timeout: 90000 });
    await p.evaluate(() => new Promise((res) => setTimeout(res, 1500))); // fonts, fade-in animations
    const b = await p.screenshot({ type: 'jpeg', quality: 90 });
    await p.close();
    return 'data:image/jpeg;base64,' + Buffer.from(b).toString('base64');
  };
  const desk = await shot(1440, 900, 1);
  const phone = await shot(390, 844, 2);
  const card = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1350px;overflow:hidden;font-family:-apple-system,"Segoe UI",Inter,Arial,sans-serif;color:#fff;
 background:radial-gradient(120% 80% at 15% 0%,#1f5a2a 0%,#0b1a0a 55%,#060d05 100%);position:relative}
.top{padding:78px 76px 0}
.tag{display:inline-flex;align-items:center;gap:10px;font-size:26px;font-weight:700;color:#86efac;letter-spacing:.3px;margin-bottom:26px}
.tag i{width:40px;height:40px;border-radius:11px;background:linear-gradient(145deg,#3ea04e,#22692e);display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-size:22px}
h1{font-size:76px;line-height:1.04;letter-spacing:-2.2px;font-weight:850;max-width:900px}
p.s{font-size:31px;color:rgba(234,242,232,.78);margin-top:22px;line-height:1.35;max-width:860px}
.browser{position:absolute;left:76px;top:500px;width:850px;border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 40px 90px rgba(0,0,0,.55)}
.bar{height:38px;background:#e9ece8;display:flex;align-items:center;gap:8px;padding:0 16px}
.bar b{width:12px;height:12px;border-radius:50%;background:#c9cec7}
.bar span{margin-left:14px;font-size:16px;color:#5b665a;background:#fff;border-radius:7px;padding:4px 14px}
.browser img{display:block;width:100%}
.phone{position:absolute;right:62px;top:640px;width:262px;border-radius:40px;border:10px solid #0b0f0b;overflow:hidden;background:#000;box-shadow:0 40px 90px rgba(0,0,0,.6)}
.phone img{display:block;width:100%}
.foot{position:absolute;left:76px;bottom:62px;font-size:30px;font-weight:800;letter-spacing:-.3px}
.foot span{color:#86efac}
</style></head><body>
<div class="top"><div class="tag"><i>🌱</i>Websprout</div><h1>${esc(headline)}</h1><p class="s">${esc(sub)}</p></div>
<div class="browser"><div class="bar"><b></b><b></b><b></b><span>${esc(name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24))}.websprout.app</span></div><img src="${desk}"></div>
<div class="phone"><img src="${phone}"></div>
<div class="foot">Make yours free at <span>websprout.app</span></div>
</body></html>`;
  const p = await browser.newPage();
  await p.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
  await p.setContent(card, { waitUntil: 'load' });
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  await p.screenshot({ path: out, type: 'jpeg', quality: 88 });
  await browser.close();
  console.log(JSON.stringify({ ok: true, out, name, type: j.type, city, source: j.source }));
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
