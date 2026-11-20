// Builds one Instagram post image (1080x1350 JPEG) for Websprout:
//   1. gets a real Websprout site for a business (websprout.app/create, falling back to the public /example page),
//   2. screenshots it on a desktop and a phone screen,
//   3. lays it out in one of several formats and colour palettes so the feed doesn't look the same every day.
//
// Usage:
//   node make-post.js --name "Rosie's Bakery" --type "Bakery" --city "Austin" \
//     --headline "A bakery website in 10 seconds." --sub "..." --format phone --palette coral --out posts/2026-11-18.jpg
//
// --format   devices | phone | browser | scroll | beforeafter | text | custom   (default: devices)
// --template for --format custom: an HTML file (1080x1350 body) that may use {{DESK}} {{PHONE}} {{FULL}} (image data URLs:
//            1440x900 desktop, 390x844 phone, full-length phone page) {{FULL_H}} {{NAME}} {{TYPE}} {{CITY}} {{HOST}}
//            {{HEADLINE}} {{SUB}} {{POINT1}}..{{POINT3}} and palette colours {{BG}} {{INK}} {{SOFT}} {{ACCENT}} {{CHIP}}.
// --palette  forest | cream | coral | navy | sun | sage               (default: picked from the name)
// --points   for --format text: 3 short lines separated by "|"
// --eyebrow  small label above the headline (optional)
// --before   for --format beforeafter: where they are today instead of a website (default Facebook)
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
const format = arg('format', 'devices');
const eyebrow = arg('eyebrow', '');
const template = arg('template', '');
const tpl = format === 'custom' ? fs.readFileSync(template, 'utf8') : '';
const before = arg('before', 'Facebook'); // beforeafter: where the business lives online today
const points = String(arg('points', '')).split('|').map((x) => x.trim()).filter(Boolean);
const PALETTES = {
  forest: { bg: 'radial-gradient(120% 80% at 15% 0%,#1f5a2a 0%,#0b1a0a 55%,#060d05 100%)', ink: '#ffffff', soft: 'rgba(234,242,232,.78)', accent: '#86efac', chip: '#3ea04e' },
  cream:  { bg: '#f6f1e7', ink: '#18201a', soft: '#55605a', accent: '#2f7d3b', chip: '#2f7d3b' },
  coral:  { bg: '#ff6b4a', ink: '#ffffff', soft: 'rgba(255,255,255,.88)', accent: '#fff1b8', chip: '#1b1b1b' },
  navy:   { bg: 'linear-gradient(160deg,#16264a 0%,#0c1529 100%)', ink: '#ffffff', soft: 'rgba(226,236,255,.8)', accent: '#7dd3fc', chip: '#3ea04e' },
  sun:    { bg: '#ffd84d', ink: '#1a1a1a', soft: '#4a4320', accent: '#1f5a2a', chip: '#1f5a2a' },
  sage:   { bg: '#dde8d5', ink: '#14301a', soft: '#3f5a45', accent: '#2f7d3b', chip: '#2f7d3b' },
};
const palName = arg('palette', Object.keys(PALETTES)[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % Object.keys(PALETTES).length]);
const pal = PALETTES[palName] || PALETTES.forest;
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
  // The hero may split the name across tags/lines ("Maple<br>Street Cafe"): match the placeholder words with any
  // markup between them and hand our name's words out over the same slots, keeping the markup.
  const phWords = ph.split(' '), ours = esc(name).split(' ');
  const sep = '((?:\\s|&nbsp;|<[^>]+>)+)';
  const re = new RegExp(phWords.map((w) => esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(sep), 'g');
  html = html.replace(re, (...m) => {
    const seps = m.slice(1, phWords.length), n = phWords.length, chunks = [];
    // earlier slots get the words first, so a short name never leaves an empty first line
    for (let i = 0; i < n; i++) chunks.push(ours.slice(Math.ceil(i * ours.length / n), Math.ceil((i + 1) * ours.length / n)).join(' '));
    return chunks.map((c, i) => c + (i < seps.length && chunks[i + 1] ? seps[i] : '')).join('');
  });
  html = html.split(ph).join(esc(name)).split(ph.replace(/&/g, '&amp;')).join(esc(name)).split('Springfield').join(esc(city));
  // Monogram logos use the placeholder's initials ("MS"): swap in ours.
  const initials = name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'W';
  html = html.replace(/(class="[^"]*mk-mono[^"]*"[^>]*>)MS</g, '$1' + esc(initials) + '<');
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
  const page = async (w, h, scale) => {
    const p = await browser.newPage();
    await p.setViewport({ width: w, height: h, deviceScaleFactor: scale });
    await p.setContent(j.html, { waitUntil: 'networkidle0', timeout: 90000 });
    await p.evaluate(() => new Promise((res) => setTimeout(res, 1500))); // fonts, fade-in animations
    return p;
  };
  const b64 = (b) => 'data:image/jpeg;base64,' + Buffer.from(b).toString('base64');
  const shot = async (w, h, scale) => { const p = await page(w, h, scale); const b = await p.screenshot({ type: 'jpeg', quality: 90 }); await p.close(); return b64(b); };
  // Whole phone page, scrolled through first so scroll-triggered sections are revealed. Returns image + height in CSS px.
  const fullPhone = async () => {
    const p = await page(390, 844, 2);
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)); } window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 800)); });
    const h = await p.evaluate(() => Math.min(document.body.scrollHeight, 9000));
    const b = await p.screenshot({ type: 'jpeg', quality: 88, fullPage: true });
    await p.close();
    return { src: b64(b), h };
  };

  const needDesk = ['devices', 'browser', 'beforeafter'].includes(format) || tpl.includes('{{DESK}}');
  const needPhone = ['devices', 'phone', 'text'].includes(format) || tpl.includes('{{PHONE}}');
  const desk = needDesk ? await shot(1440, 900, 1) : '';
  const phone = needPhone ? await shot(390, 844, 2) : '';
  const full = format === 'scroll' || /\{\{FULL(_H)?\}\}/.test(tpl) ? await fullPhone() : null;
  const host = esc(name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24)) + '.websprout.app';

  const base = `*{box-sizing:border-box;margin:0}
body{width:1080px;height:1350px;overflow:hidden;font-family:-apple-system,"Segoe UI",Inter,Arial,sans-serif;color:${pal.ink};background:${pal.bg};position:relative}
.tag{display:inline-flex;align-items:center;gap:10px;font-size:26px;font-weight:700;color:${pal.ink};letter-spacing:.3px}
.tag i{width:40px;height:40px;border-radius:11px;background:${pal.chip};display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-size:22px}
.eb{font-size:22px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;color:${pal.accent};margin-bottom:18px}
h1{font-weight:850;letter-spacing:-2.2px;line-height:1.03}
p.s{color:${pal.soft};line-height:1.35}
.url{font-size:28px;font-weight:800;letter-spacing:-.3px}.url span{color:${pal.accent}}
.browser{border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 40px 90px rgba(0,0,0,.35)}
.bar{height:38px;background:#e9ece8;display:flex;align-items:center;gap:8px;padding:0 16px}
.bar b{width:12px;height:12px;border-radius:50%;background:#c9cec7}
.bar span{margin-left:14px;font-size:16px;color:#5b665a;background:#fff;border-radius:7px;padding:4px 14px}
.browser img{display:block;width:100%}
.ph{border-radius:44px;border:11px solid #0b0f0b;overflow:hidden;background:#000;box-shadow:0 40px 90px rgba(0,0,0,.4)}
.ph img{display:block;width:100%}`;
  const tag = `<div class="tag"><i>🌱</i>Websprout</div>`;
  const eb = eyebrow ? `<div class="eb">${esc(eyebrow)}</div>` : '';
  const browserEl = (style) => `<div class="browser" style="${style}"><div class="bar"><b></b><b></b><b></b><span>${host}</span></div><img src="${desk}"></div>`;

  const layouts = {
    // Laptop + phone side by side (the original card)
    devices: () => `<style>${base}
.top{padding:78px 76px 0}.top .tag{margin-bottom:26px}h1{font-size:76px;max-width:900px}p.s{font-size:31px;margin-top:22px;max-width:860px}
.ph{position:absolute;right:62px;top:640px;width:262px;border-radius:40px;border-width:10px}
.foot{position:absolute;left:76px;bottom:62px}</style>
<div class="top">${tag}${eb}<h1>${esc(headline)}</h1><p class="s">${esc(sub)}</p></div>
${browserEl('position:absolute;left:76px;top:500px;width:850px')}
<div class="ph"><img src="${phone}"></div><div class="foot url">Make yours free at <span>websprout.app</span></div>`,

    // One big phone, tilted, running off the bottom edge
    phone: () => `<style>${base}
.top{padding:170px 76px 0;text-align:center}h1{font-size:78px;max-width:930px;margin:0 auto}p.s{font-size:30px;margin:20px auto 0;max-width:820px}
.ph{position:absolute;left:50%;top:600px;width:470px;margin-left:-235px;transform:rotate(-4deg);border-radius:62px;border-width:14px}
.pill{position:absolute;right:56px;top:66px;font-size:22px;font-weight:800;padding:12px 20px;border-radius:999px;background:${pal.ink};color:${palName === 'forest' || palName === 'navy' || palName === 'coral' ? '#111' : '#fff'}}</style>
<div class="top">${eb}<h1>${esc(headline)}</h1><p class="s">${esc(sub)}</p></div>
<div class="ph"><img src="${phone}"></div>
<div style="position:absolute;left:56px;top:66px">${tag}</div><div class="pill">websprout.app</div>`,

    // Edge-to-edge website on top, big type panel below (editorial)
    browser: () => `<style>${base}
.shot{position:absolute;left:0;top:0;width:1080px;height:610px;overflow:hidden;background:#fff}.shot img{width:1080px;display:block}
.chip{position:absolute;left:40px;top:540px;background:rgba(17,17,17,.82);color:#fff;font-size:20px;font-weight:600;padding:10px 18px;border-radius:999px}
.panel{position:absolute;left:0;right:0;top:610px;bottom:0;padding:76px 76px}
h1{font-size:92px;max-width:940px}p.s{font-size:31px;margin-top:22px;max-width:880px}
.foot{position:absolute;left:76px;right:76px;bottom:60px;display:flex;justify-content:space-between;align-items:center}</style>
<div class="shot"><img src="${desk}"></div><div class="chip">${host}</div>
<div class="panel">${eb}<h1>${esc(headline)}</h1><p class="s">${esc(sub)}</p></div>
<div class="foot">${tag}<div class="url"><span>websprout.app</span></div></div>`,

    // Three phones showing different parts of the same site
    scroll: () => {
      const vh = 844, maxOff = Math.max(0, full.h - vh);
      const offs = [0, Math.round(maxOff * 0.4), Math.round(maxOff * 0.78)];
      const ph = (off, x, y, rot) => `<div class="ph" style="left:${x}px;top:${y}px;transform:rotate(${rot}deg)"><div class="vp"><img src="${full.src}" style="margin-top:${-off * (300 / 390)}px"></div></div>`;
      return `<style>${base}
.top{padding:76px 76px 0}.top .tag{margin-bottom:26px}h1{font-size:74px;max-width:930px}p.s{font-size:30px;margin-top:20px;max-width:860px}
.ph{position:absolute;width:322px;border-radius:44px}.vp{width:300px;height:${Math.round(vh * 300 / 390)}px;overflow:hidden}.vp img{width:300px;display:block}
.foot{position:absolute;left:76px;bottom:56px}</style>
<div class="top">${tag}${eb}<h1>${esc(headline)}</h1><p class="s">${esc(sub)}</p></div>
${ph(offs[0], 34, 560, -3)}${ph(offs[1], 379, 520, 0)}${ph(offs[2], 724, 560, 3)}
<div class="foot url">Make yours free at <span>websprout.app</span></div>`;
    },

    // Before (no website) vs after (the real site)
    beforeafter: () => `<style>${base}
.top{padding:70px 76px 0}.top .tag{margin-bottom:22px}h1{font-size:68px;max-width:930px}
.lab{position:absolute;font-size:22px;font-weight:900;letter-spacing:3px;padding:10px 18px;border-radius:10px}
.before{position:absolute;left:76px;top:400px;width:928px;height:250px;border-radius:18px;background:#fff;color:#202124;padding:34px 40px;box-shadow:0 24px 60px rgba(0,0,0,.18);font-family:Arial,sans-serif}
.before .q{font-size:22px;color:#5f6368;border:1px solid #dfe1e5;border-radius:999px;padding:12px 24px;width:560px}
.before .r{margin-top:26px;font-size:30px;color:#1a0dab}.before .n{margin-top:10px;font-size:22px;color:#70757a}
.foot{position:absolute;left:76px;bottom:52px}</style>
<div class="top">${tag}${eb}<h1>${esc(headline)}</h1></div>
<div class="lab" style="left:76px;top:340px;background:#ffffff22;color:${pal.ink};border:2px solid ${pal.ink}55">BEFORE</div>
<div class="before"><div class="q">🔍 ${esc(name.toLowerCase())} ${esc(city.toLowerCase())}</div><div class="r">${esc(name)} · ${esc(before)}</div><div class="n">No website · Hours unknown · No booking</div></div>
<div class="lab" style="left:76px;top:690px;background:${pal.accent};color:${palName === 'sun' || palName === 'cream' || palName === 'sage' ? '#fff' : '#111'}">AFTER</div>
<div style="position:absolute;left:76px;top:750px;width:928px;height:470px;overflow:hidden;border-radius:18px">${browserEl('width:928px')}</div>
<div class="foot url">Make yours free at <span>websprout.app</span></div>`,

    // Typographic tip list with a small phone peeking in
    text: () => {
      const pts = (points.length ? points : ['Your services and prices', 'A big call or book button', 'Looks right on a phone']).slice(0, 3);
      return `<style>${base}
.wrap{padding:84px 76px 0}.wrap .tag{margin-bottom:56px}h1{font-size:88px;max-width:900px}
ol{list-style:none;padding:0;margin-top:60px}li{display:flex;gap:28px;align-items:baseline;font-size:44px;font-weight:700;letter-spacing:-.8px;line-height:1.15;margin-bottom:38px;max-width:620px}
li b{font-size:30px;font-weight:900;color:${pal.accent};min-width:52px}
.ph{position:absolute;right:-40px;bottom:-160px;width:360px;transform:rotate(8deg);border-radius:52px;border-width:12px}
.foot{position:absolute;left:76px;bottom:62px}</style>
<div class="wrap">${tag}${eb}<h1>${esc(headline)}</h1><ol>${pts.map((t, i) => `<li><b>0${i + 1}</b>${esc(t)}</li>`).join('')}</ol></div>
<div class="ph"><img src="${phone}"></div><div class="foot url">Make yours free at <span>websprout.app</span></div>`;
    },
  };
  // A one-off design written by the routine (wildcard posts). Plain text placeholders are HTML-escaped.
  layouts.custom = () => {
    const v = { DESK: desk, PHONE: phone, FULL: full ? full.src : '', FULL_H: full ? String(full.h) : '0', NAME: esc(name), TYPE: esc(type), CITY: esc(city), HOST: host,
      HEADLINE: esc(headline), SUB: esc(sub), POINT1: esc(points[0] || ''), POINT2: esc(points[1] || ''), POINT3: esc(points[2] || ''),
      BG: pal.bg, INK: pal.ink, SOFT: pal.soft, ACCENT: pal.accent, CHIP: pal.chip };
    return tpl.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, k) => (k in v ? v[k] : m));
  };
  if (format === 'custom' && !tpl) throw new Error('--format custom needs --template');
  const card = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${(layouts[format] || layouts.devices)()}</body></html>`;
  const p = await browser.newPage();
  await p.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
  await p.setContent(card, { waitUntil: 'load' });
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  await p.screenshot({ path: out, type: 'jpeg', quality: 88 });
  await browser.close();
  console.log(JSON.stringify({ ok: true, out, name, type: j.type, city, source: j.source, format: layouts[format] ? format : 'devices', palette: palName }));
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
