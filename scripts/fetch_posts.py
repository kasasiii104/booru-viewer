#!/usr/bin/env python3
"""Fetch video and GIF posts. Does not download media files."""

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

NG = ("futanari", "futa", "dickgirl", "newhalf", "bestiality", "zoophilia", "beastiality")
QUERY = "video ~ animated_gif -futanari -futa -dickgirl -bestiality -zoophilia -beastiality"
UA = "booru-viewer/1.0"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40) as res:
        return json.loads(res.read().decode("utf-8"))


def blocked(tags):
    text = " ".join(tags).lower()
    return any(word in text.split() or word in text for word in NG)


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
            best[key] = item
    return list(best.values())


def danbooru(state):
    login = os.environ.get("DANBOORU_LOGIN", "")
    key = os.environ.get("DANBOORU_API_KEY", "")
    page = 1
    found = []
    while page <= 5:
        params = {"tags": QUERY, "limit": 100, "page": page}
        if login and key:
            params["login"] = login
            params["api_key"] = key
        url = "https://danbooru.donmai.us/posts.json?" + urllib.parse.urlencode(params)
        rows = get(url)
        if not rows:
            break
        for row in rows:
            tags = (row.get("tag_string") or "").split()
            if blocked(tags) or not row.get("file_url"):
                continue
            found.append({
                "source": "danbooru",
                "source_id": row["id"],
                "md5": row.get("md5"),
                "score": row.get("score") or 0,
                "rating": row.get("rating"),
                "tags": tags,
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


def gelbooru_like(name, endpoint, user_key, api_key, id_field):
    user = os.environ.get(user_key, "")
    key = os.environ.get(api_key, "")
    if not user or not key:
        print(f"skip {name}: missing API credentials")
        return []
    host = "rule34.xxx" if name == "rule34" else "gelbooru.com"
    found = []
    for pid in range(5):
        params = {
            "page": "dapi", "s": "post", "q": "index", "json": 1,
            "tags": QUERY, "limit": 100, "pid": pid,
            "user_id": user, "api_key": key,
        }
        url = endpoint + "?" + urllib.parse.urlencode(params)
        payload = get(url)
        rows = payload if isinstance(payload, list) else payload.get("post", [])
        if not rows:
            break
        for row in rows:
            tags = str(row.get("tags") or "").split()
            file_url = row.get("file_url")
            if blocked(tags) or not file_url:
                continue
            found.append({
                "source": name,
                "source_id": int(row.get("id")),
                "md5": row.get("md5") or row.get("hash"),
                "score": int(row.get("score") or 0),
                "rating": row.get("rating"),
                "tags": tags,
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
    fresh.extend(gelbooru_like(
        "gelbooru", "https://gelbooru.com/index.php",
        "GELBOORU_USER_ID", "GELBOORU_API_KEY", "id"))
    fresh.extend(gelbooru_like(
        "rule34", "https://api.rule34.xxx/index.php",
        "RULE34_USER_ID", "RULE34_API_KEY", "id"))
    merged = keep_best(items + fresh)
    save(merged, state)
    print(f"catalog {len(merged)} items, added batch {len(fresh)}")


if __name__ == "__main__":
    main()
