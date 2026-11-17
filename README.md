# websprout-social

Images and a log for Websprout's daily Instagram posts. A scheduled Claude routine runs every evening:

1. picks a business type that hasn't been featured in the last 30 days,
2. runs `make-post.js`, which builds a real example site on websprout.app and screenshots it onto a branded 1080×1350 card,
3. commits the image to `posts/YYYY-MM-DD.jpg` (served publicly from raw.githubusercontent.com so Buffer can fetch it),
4. writes the caption and schedules the post in Buffer for 11:00 AM Central the next day,
5. records it in `history.json`.

Nothing here is secret: only images, captions and the script.

Run locally: `npm install && node make-post.js --name "Rivera Plumbing" --type "Plumber" --city "Austin" --headline "A plumber website in under 10 seconds." --out posts/test.jpg`
