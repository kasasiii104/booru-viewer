#!/usr/bin/env python3
"""Fetch current and historical 3D videos. Does not download media files."""

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
FLAT = {"anime_screenshot", "official_art", "manga", "comic", "sketch", "traditional_media", "pixel_art", "anime_coloring"}
DANBOORU_TAGS = (
    "3d video", "3d animated_gif", "source_filmmaker video", "blender video",
    "mmd video", "daz_studio video", "koikatsu video", "honey_select video",
)
QUERY = "( 3d ~ source_filmmaker ~ blender ~ mmd ~ daz_studio ~ koikatsu ) ( video ~ animated_gif ) -futanari -yaoi -gay -bestiality"
UA = "booru-viewer/1.0"
STEP = 10


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
    return bool(words & TOOLS) and not blocked(tags) and not (words & FLAT)


def load():
    items = json.loads(VIDEOS.read_text()) if VIDEOS.exists() else []
    raw = STATE.read_text() if STATE.exists() else ""
    state = json.loads(raw) if raw.strip() else {}
    state.setdefault("history", {})
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
            for field in ("copyright_tags", "character_tags", "duration"):
                if current and current.get(field) and not item.get(field):
                    item[field] = current[field]
            best[key] = item
        else:
            for field in ("copyright_tags", "character_tags", "duration"):
                if item.get(field) and not current.get(field):
                    current[field] = item[field]
    return list(best.values())


def danbooru_page(tags, page, login, key):
    params = {"tags": tags, "limit": 100, "page": page}
    if login and key:
        params["login"] = login
        params["api_key"] = key
    rows = get("https://danbooru.donmai.us/posts.json?" + urllib.parse.urlencode(params))
    time.sleep(0.6)
    return rows or []


def danbooru(state):
    login = os.environ.get("DANBOORU_LOGIN", "")
    key = os.environ.get("DANBOORU_API_KEY", "")
    cursors = state["history"].setdefault("danbooru", {})
    found = []
    for tags in DANBOORU_TAGS:
        pages = {1}
        cursor = cursors.get(tags) or 1
        if cursor != "done":
            pages.update(range(int(cursor), int(cursor) + STEP))
        done = False
        for page in sorted(pages):
            rows = danbooru_page(tags, page, login, key)
            if not rows:
                done = True
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
                    "character_tags": (row.get("tag_string_character") or "").split(),
                    "width": row.get("image_width"),
                    "height": row.get("image_height"),
                    "file_url": row.get("file_url"),
                    "preview_url": row.get("preview_file_url"),
                    "duration": row.get("duration") or (row.get("media_asset") or {}).get("duration"),
                    "post_url": f"https://danbooru.donmai.us/posts/{row['id']}",
                    "created_at": row.get("created_at"),
                })
        cursors[tags] = "done" if done or cursor == "done" else int(cursor) + STEP
    return found


def gelbooru_like(name, endpoint, user_key, api_key, state):
    user = os.environ.get(user_key, "")
    key = os.environ.get(api_key, "")
    if not user or not key:
        print(f"skip {name}: missing API credentials")
        return []
    host = "rule34.xxx" if name == "rule34" else "gelbooru.com"
    cursor = state["history"].get(name, 0)
    pages = {0}
    if cursor != "done":
        pages.update(range(int(cursor), int(cursor) + STEP))
    found = []
    done = False
    for pid in sorted(pages):
        params = {
            "page": "dapi", "s": "post", "q": "index", "json": 1,
            "tags": QUERY, "limit": 100, "pid": pid,
            "user_id": user, "api_key": key,
        }
        payload = get(endpoint + "?" + urllib.parse.urlencode(params))
        time.sleep(0.6)
        rows = payload if isinstance(payload, list) else (payload or {}).get("post", [])
        if not rows:
            done = True
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
                "character_tags": [],
                "width": int(row.get("width") or 0),
                "height": int(row.get("height") or 0),
                "file_url": file_url,
                "preview_url": row.get("preview_url") or row.get("sample_url"),
                "duration": row.get("duration"),
                "post_url": f"https://{host}/index.php?page=post&s=view&id={row.get('id')}",
                "created_at": row.get("created_at") or row.get("change"),
            })
    state["history"][name] = "done" if done or cursor == "done" else int(cursor) + STEP
    return found


def main():
    items, state = load()
    fresh = []
    fresh.extend(danbooru(state))
    fresh.extend(gelbooru_like("gelbooru", "https://gelbooru.com/index.php", "GELBOORU_USER_ID", "GELBOORU_API_KEY", state))
    fresh.extend(gelbooru_like("rule34", "https://api.rule34.xxx/index.php", "RULE34_USER_ID", "RULE34_API_KEY", state))
    merged = [item for item in keep_best(items + fresh) if wanted(item.get("tags") or [])]
    save(merged, state)
    print(f"catalog {len(merged)} items, added batch {len(fresh)}")
    print("history", json.dumps(state.get("history"), ensure_ascii=False))


if __name__ == "__main__":
    main()
