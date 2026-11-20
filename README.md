# websprout-social

Images and a log for Websprout's daily Instagram posts. A scheduled Claude routine runs every evening:

1. picks a business type that hasn't been featured in the last 30 days,
2. runs `make-post.js`, which builds a real example site on websprout.app and screenshots it onto a branded 1080×1350 card,
3. commits the image to `posts/YYYY-MM-DD.jpg` (served publicly from raw.githubusercontent.com so Buffer can fetch it),
4. writes the caption and schedules the post in Buffer for 11:00 AM Central the next day,
5. records it in `history.json`.

Nothing here is secret: only images, captions and the script.

Image formats (`--format`): devices, phone, browser, scroll, beforeafter, text. Palettes (`--palette`): forest, cream, coral, navy, sun, sage. `library.json` records the format and palette of each library image.

Wildcards: about 1 post in 5 uses `--format custom --template templates/<concept>.html`, a one-off design the routine writes itself (see `templates/text-thread.html` for the placeholders).

Analytics: `python3 analytics.py metrics.json` merges Buffer's per-post metrics into `history.json` (48h and 7-day snapshots), scores each post (likes + 2x comments + 3x saves + 3x shares + 5x follows per 100 reached, smoothed for tiny reach) and writes `analytics.json` plus the numbers section of `insights.md`, broken down by format, palette, angle, category, hook style, wildcard concept and weekday.

Run locally: `npm install && node make-post.js --name "Rivera Plumbing" --type "Plumber" --city "Austin" --headline "A plumber website in under 10 seconds." --out posts/test.jpg`
