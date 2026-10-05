#!/usr/bin/env python3
"""Fetch 3D-tool videos and GIFs. Does not download media files."""

import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
VIDEOS = DATA / "videos.json"
STATE = DATA / "state.json"

NG = (
    "futanari", "futa", "dickgirl", "newhalf",
    "bestiality", "zoophilia", "beastiality",
    "yaoi", "gay", "males_only", "bara",
)
TOOLS = {
    "source_filmmaker", "sfm", "blender", "blender_(medium)",
    "mmd", "mikumikudance", "daz_studio", "koikatsu",
    "honey_select", "xps", "xnalara", "cinema_4d", "3d",
}
GAMES = {"overwatch", "nier_automata", "nier", "dead_or_alive", "marie_rose"}
FLAT = {"anime_screenshot", "official_art", "manga", "comic", "sketch", "traditional_media", "pixel_art", "anime_coloring"}
QUERY = "( source_filmmaker ~ blender ~ mmd ~ overwatch ~ nier_automata ~ dead_or_alive ) ( video ~ animated_gif ) -futanari -yaoi -gay -bestiality"
UA = "booru-viewer/1.0"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=40) as res:
            return json.loads(res.read().decode("utf-8"))
    except Exception as exc:
        print(f"request failed: {exc}")
        return None


def blocked(tags):
    words = {tag.lower() for tag in tags}
    return any(word in words for word in NG)


def wanted(tags):
    words = {tag.lower() for tag in tags}
    if blocked(tags):
        return False
    if words & TOOLS:
        return True
    return bool(words & GAMES) and not (words & FLAT)


def load():
    items = json.loads(VIDEOS.read_text()) if VIDEOS.exists() else []
    raw = STATE.read_text() if STATE.exists() else ""
    state = json.loads(raw) if raw.strip() else {}
    return items, state


def save(items, state):
    VIDEOS.write_text(json.dumps(items, ensure_ascii=False, indent=2))
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2))


def keep_best(items):
    best = {}
    for item in items:
        key = item.get("md5") or f"{item['source']}:{item['source_id']}"
        current = best.get(key)
        if current is None or (item.get("score") or 0) > (current.get("score") or 0):
            if current and current.get("copyright_tags") and not item.get("copyright_tags"):
                item["copyright_tags"] = current["copyright_tags"]
            best[key] = item
        elif item.get("copyright_tags") and not current.get("copyright_tags"):
            current["copyright_tags"] = item["copyright_tags"]
    return list(best.values())


def danbooru(state):
    login = os.environ.get("DANBOORU_LOGIN", "")
    key = os.environ.get("DANBOORU_API_KEY", "")
    found = []
    for tags in ("source_filmmaker", "blender", "mmd", "overwatch", "nier_automata", "dead_or_alive"):
        page = 1
        while page <= 3:
            params = {"tags": tags, "limit": 100, "page": page}
            if login and key:
                params["login"] = login
                params["api_key"] = key
            url = "https://danbooru.donmai.us/posts.json?" + urllib.parse.urlencode(params)
            rows = get(url)
            if not rows:
                break
            for row in rows:
                post_tags = (row.get("tag_string") or "").split()
                ext = (row.get("file_ext") or "").lower()
                if ext not in {"mp4", "webm", "gif"} or not wanted(post_tags) or not row.get("file_url"):
                    continue
                found.append({
                    "source": "danbooru",
                    "source_id": row["id"],
                    "md5": row.get("md5"),
                    "score": row.get("score") or 0,
                    "rating": row.get("rating"),
                    "tags": post_tags,
                    "copyright_tags": (row.get("tag_string_copyright") or "").split(),
                    "width": row.get("image_width"),
                    "height": row.get("image_height"),
                    "file_url": row.get("file_url"),
                    "preview_url": row.get("preview_file_url"),
                    "post_url": f"https://danbooru.donmai.us/posts/{row['id']}",
                    "created_at": row.get("created_at"),
                })
            page += 1
            time.sleep(1)
    state["danbooru"] = max([item["source_id"] for item in found], default=state.get("danbooru", 0))
    return found


def gelbooru_like(name, endpoint, user_key, api_key):
    user = os.environ.get(user_key, "")
    key = os.environ.get(api_key, "")
    if not user or not key:
        print(f"skip {name}: missing API credentials")
        return []
    host = "rule34.xxx" if name == "rule34" else "gelbooru.com"
    found = []
    for pid in range(3):
        params = {
            "page": "dapi", "s": "post", "q": "index", "json": 1,
            "tags": QUERY, "limit": 100, "pid": pid,
            "user_id": user, "api_key": key,
        }
        url = endpoint + "?" + urllib.parse.urlencode(params)
        payload = get(url)
        if not payload:
            break
        rows = payload if isinstance(payload, list) else payload.get("post", [])
        if not rows:
            break
        for row in rows:
            tags = str(row.get("tags") or "").split()
            file_url = row.get("file_url") or ""
            if not wanted(tags) or not file_url:
                continue
            if not file_url.lower().endswith((".mp4", ".webm", ".gif")) and "video" not in tags and "animated" not in tags:
                continue
            found.append({
                "source": name,
                "source_id": int(row.get("id")),
                "md5": row.get("md5") or row.get("hash"),
                "score": int(row.get("score") or 0),
                "rating": row.get("rating"),
                "tags": tags,
                "copyright_tags": [],
                "width": int(row.get("width") or 0),
                "height": int(row.get("height") or 0),
                "file_url": file_url,
                "preview_url": row.get("preview_url") or row.get("sample_url"),
                "post_url": f"https://{host}/index.php?page=post&s=view&id={row.get('id')}",
                "created_at": row.get("created_at") or row.get("change"),
            })
        time.sleep(1)
    return found


def main():
    items, state = load()
    fresh = []
    fresh.extend(danbooru(state))
    fresh.extend(gelbooru_like("gelbooru", "https://gelbooru.com/index.php", "GELBOORU_USER_ID", "GELBOORU_API_KEY"))
    fresh.extend(gelbooru_like("rule34", "https://api.rule34.xxx/index.php", "RULE34_USER_ID", "RULE34_API_KEY"))
    merged = [item for item in keep_best(items + fresh) if wanted(item.get("tags") or [])]
    save(merged, state)
    print(f"catalog {len(merged)} items, added batch {len(fresh)}")


if __name__ == "__main__":
    main()
