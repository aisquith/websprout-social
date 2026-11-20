#!/usr/bin/env python3
"""Scores Websprout's Instagram posts and finds what people engage with.

Usage: python3 analytics.py [metrics.json]

metrics.json (optional) is Buffer's list_posts output saved as-is (or just its list of post nodes): each post has
id, sentAt and metrics [{type, value}]. Those numbers are merged into history.json by bufferPostId, keeping
snapshots at 48 hours (metrics48h) and 7 days (metrics7d) as well as the latest (metrics).

Then everything is recomputed from history.json and written to:
  analytics.json  - per-post scores, per-dimension summaries and recommendations (read this when choosing posts)
  insights.md     - the section between <!-- auto:start --> and <!-- auto:end --> (anything else is kept)

Score: engagement = likes + 2*comments + 3*saves + 3*shares + 5*follows, divided by reach, shrunk toward the
account average with K=100 phantom viewers so a post seen by 7 people can't top the table on 2 likes.
Reported per 100 people reached. Reach is reported separately: it shows what Instagram chose to push.
"""
import json, sys, datetime as dt, math, os

K = 100
WEIGHTS = {"reactions": 1, "comments": 2, "saves": 3, "shares": 3, "follows": 5}
DIMS = ["format", "palette", "angle", "category", "headlineStyle", "hookStyle", "wildcard", "concept", "weekday"]
OPTIONS = {
    "format": ["devices", "phone", "browser", "scroll", "beforeafter", "text", "custom"],
    "palette": ["forest", "cream", "coral", "navy", "sun", "sage"],
    "angle": ["speed", "no-designer", "mobile", "free", "trade-callout", "before-after", "leads"],
    "hookStyle": ["question", "statement", "number", "relatable", "how-to"],
}
HERE = os.path.dirname(os.path.abspath(__file__))
P = lambda f: os.path.join(HERE, f)


def parse_time(s):
    return dt.datetime.fromisoformat(str(s).replace("Z", "+00:00"))


def flat(metrics):
    if isinstance(metrics, dict):
        return metrics
    return {m["type"]: m.get("value") for m in (metrics or []) if isinstance(m, dict) and "type" in m}


def load_nodes(path):
    raw = json.load(open(path))
    if isinstance(raw, dict) and "edges" in raw:
        return [e["node"] for e in raw["edges"]]
    if isinstance(raw, dict) and "posts" in raw:
        return raw["posts"]
    return raw


def merge(history, nodes, now):
    byid = {h.get("bufferPostId"): h for h in history if h.get("bufferPostId")}
    merged = 0
    for n in nodes:
        h = byid.get(n.get("id"))
        m = flat(n.get("metrics"))
        if not h or not m:
            continue
        sent = n.get("sentAt") or n.get("dueAt")
        age_h = (now - parse_time(sent)).total_seconds() / 3600 if sent else 0
        snap = dict(m, metricsUpdatedAt=n.get("metricsUpdatedAt"), ageHours=round(age_h, 1))
        h["metrics"] = snap
        if sent:
            h["sentAt"] = sent
        if age_h >= 48 and "metrics48h" not in h:
            h["metrics48h"] = snap
        if age_h >= 24 * 7 and "metrics7d" not in h:
            h["metrics7d"] = snap
        if h.get("status") in ("scheduled", "draft"):
            h["status"] = "sent"
        merged += 1
    return merged


def engagement(m):
    return sum(w * (m.get(k) or 0) for k, w in WEIGHTS.items())


def main():
    now = dt.datetime.now(dt.timezone.utc)
    history = json.load(open(P("history.json")))
    merged = merge(history, load_nodes(sys.argv[1]), now) if len(sys.argv) > 1 else 0

    posts = []
    for h in history:
        m = h.get("metrics")
        if not m or (m.get("ageHours") or 0) < 48:
            continue
        reach = m.get("reach") or m.get("views") or 0
        posts.append({"h": h, "m": m, "reach": reach, "eng": engagement(m)})
    tot_reach = sum(p["reach"] for p in posts)
    base = (sum(p["eng"] for p in posts) / tot_reach) if tot_reach else 0.03
    for p in posts:
        p["score"] = round(100 * (p["eng"] + K * base) / (p["reach"] + K), 2)
        p["h"]["score"] = p["score"]
        h = p["h"]
        h.setdefault("wildcard", h.get("format") == "custom")
        if h.get("sentAt") and "weekday" not in h:
            h["weekday"] = parse_time(h["sentAt"]).astimezone(dt.timezone(dt.timedelta(hours=-6))).strftime("%a")

    def val(h, d):
        v = h.get(d)
        return None if v in (None, "") else str(v).lower() if isinstance(v, bool) else str(v)

    dims = {}
    for d in DIMS:
        groups = {}
        for p in posts:
            v = val(p["h"], d)
            if v is None:
                continue
            g = groups.setdefault(v, {"n": 0, "score": 0, "reach": 0, "follows": 0, "saves": 0, "shares": 0, "comments": 0})
            g["n"] += 1
            g["score"] += p["score"]
            g["reach"] += p["reach"]
            for k in ("follows", "saves", "shares", "comments"):
                g[k] += p["m"].get(k) or 0
        rows = []
        for v, g in groups.items():
            rows.append({"value": v, "n": g["n"], "avgScore": round(g["score"] / g["n"], 2), "avgReach": round(g["reach"] / g["n"]),
                         "follows": g["follows"], "saves": g["saves"], "shares": g["shares"], "comments": g["comments"]})
        rows.sort(key=lambda r: -r["avgScore"])
        tested = {r["value"] for r in rows if r["n"] >= 2}
        dims[d] = {
            "rows": rows,
            "best": next((r["value"] for r in rows if r["n"] >= 2), None),
            "bestForReach": max((r for r in rows if r["n"] >= 2), key=lambda r: r["avgReach"], default={}).get("value"),
            "underTested": [o for o in OPTIONS.get(d, []) if o not in tested],
        }

    ranked = sorted(posts, key=lambda p: -p["score"])
    out = {
        "updated": now.isoformat(timespec="minutes"),
        "measuredPosts": len(posts),
        "tentative": len(posts) < 8,
        "accountAverage": {"score": round(100 * base, 2), "reach": round(tot_reach / len(posts)) if posts else 0},
        "posts": [{"date": p["h"].get("date"), "type": p["h"].get("type"), "format": p["h"].get("format"), "palette": p["h"].get("palette"),
                   "angle": p["h"].get("angle"), "concept": p["h"].get("concept"), "headline": p["h"].get("headline"), "captionHook": p["h"].get("captionHook"),
                   "score": p["score"], "reach": p["reach"], **{k: p["m"].get(k) for k in ("reactions", "comments", "saves", "shares", "follows", "views")}}
                  for p in ranked],
        "dimensions": dims,
        "topWildcards": [{"date": p["h"].get("date"), "concept": p["h"].get("concept"), "template": p["h"].get("template"), "score": p["score"]}
                         for p in ranked if p["h"].get("wildcard") in (True, "true")],
    }
    json.dump(out, open(P("analytics.json"), "w"), indent=2)
    json.dump(history, open(P("history.json"), "w"), indent=2)

    L = [f"<!-- auto:start (written by analytics.py; do not edit by hand) -->",
         f"## Numbers ({out['updated'][:10]})", "",
         f"Posts measured (48h+ old): {len(posts)}" + (" - patterns are tentative until 8." if out["tentative"] else ""),
         f"Account average: score {out['accountAverage']['score']} per 100 reached, reach {out['accountAverage']['reach']}.", "",
         "| date | type | format | palette | angle | headline | score | reach | likes | comments | saves | shares | follows |",
         "|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for p in out["posts"]:
        L.append(f"| {p['date']} | {p['type']} | {p['format']} | {p['palette']} | {p['angle']} | {p['headline']} | {p['score']} | {p['reach']} | "
                 f"{p['reactions'] or 0} | {p['comments'] or 0} | {p['saves'] or 0} | {p['shares'] or 0} | {p['follows'] or 0} |")
    for d in DIMS:
        rows = dims[d]["rows"]
        if not rows:
            continue
        L += ["", f"**By {d}** (best: {dims[d]['best'] or 'not enough data'}" + (f"; most reach: {dims[d]['bestForReach']}" if dims[d]['bestForReach'] else "") +
              (f"; untested: {', '.join(dims[d]['underTested'])}" if dims[d]["underTested"] else "") + ")", "",
              "| " + d + " | posts | avg score | avg reach | follows | saves | shares | comments |", "|---|---|---|---|---|---|---|---|"]
        L += [f"| {r['value']} | {r['n']} | {r['avgScore']} | {r['avgReach']} | {r['follows']} | {r['saves']} | {r['shares']} | {r['comments']} |" for r in rows]
    L.append("<!-- auto:end -->")
    auto = "\n".join(L)

    old = open(P("insights.md")).read() if os.path.exists(P("insights.md")) else "# Websprout Instagram insights\n"
    if "<!-- auto:start" in old and "<!-- auto:end -->" in old:
        a, b = old.index("<!-- auto:start"), old.index("<!-- auto:end -->") + len("<!-- auto:end -->")
        new = old[:a] + auto + old[b:]
    else:
        new = old.rstrip() + "\n\n" + auto + "\n"
    open(P("insights.md"), "w").write(new)
    print(json.dumps({"merged": merged, "measured": len(posts), "best": {d: dims[d]["best"] for d in DIMS}, "underTested": {d: dims[d]["underTested"] for d in OPTIONS}}))


if __name__ == "__main__":
    main()
