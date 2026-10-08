#!/usr/bin/env python3
"""Fetch current and historical erotic 3D videos. Does not download media files."""

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
PART = 10000

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
ANIME = {
    "vocaloid", "hatsune_miku", "touhou", "hololive", "kantai_collection",
    "idolmaster", "love_live!", "love_live", "precure", "naruto", "one_piece",
    "bleach", "dragon_ball", "fate_(series)", "fate/stay_night", "umamusume",
    "bocchi_the_rock!", "spy_x_family", "konosuba", "re:zero", "sword_art_online",
    "kimetsu_no_yaiba", "jujutsu_kaisen", "boku_no_hero_academia", "pokemon",
    "gintama", "jojo's_bizarre_adventure", "attack_on_titan", "shingeki_no_kyojin",
    "neon_genesis_evangelion", "sailor_moon", "pretty_cure", "project_sekai",
    "bang_dream!", "chainsaw_man", "oshi_no_ko", "frieren", "sousou_no_frieren",
}
EROTIC = {
    "sex", "vaginal", "penis", "nude", "completely_nude", "pussy", "oral",
    "fellatio", "paizuri", "cum", "creampie", "nipples", "masturbation",
    "anus", "sex_from_behind", "penetration", "vaginal_penetration",
}
DANBOORU_TAGS = (
    "3d video rating:e", "source_filmmaker video rating:e", "blender video rating:e",
    "mmd video rating:e", "daz_studio video rating:e", "koikatsu video rating:e",
    "honey_select video rating:e",
)
GEL_TAGS = (
    "3d video rating:explicit", "source_filmmaker video rating:explicit",
    "blender video rating:explicit", "mmd video rating:explicit",
    "daz_studio video rating:explicit", "koikatsu video rating:explicit",
    "honey_select video rating:explicit",
)
QUERY = "( 3d ~ source_filmmaker ~ blender ~ mmd ~ daz_studio ~ koikatsu ) ( video ~ animated_gif ) rating:explicit -futanari -yaoi -gay -bestiality"
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


def words_of(tags):
    return {str(tag).lower() for tag in tags}


def blocked(words):
    return any(word in words for word in NG) or any(word in words for word in ANIME) or bool(words & FLAT)


def wanted(tags, rating=""):
    words = words_of(tags)
    if not (words & TOOLS) or blocked(words):
        return False
    level = str(rating or "").lower()
    if level in {"s", "g", "safe"}:
        return False
    return level in {"e", "q", "explicit", "questionable"} or bool(words & EROTIC)


def load():
    items = []
    parts = sorted(DATA.glob("videos-*.json"))
    if parts:
        for part in parts:
            items.extend(json.loads(part.read_text()))
    elif VIDEOS.exists():
        items = json.loads(VIDEOS.read_text())
    raw = STATE.read_text() if STATE.exists() else ""
    state = json.loads(raw) if raw.strip() else {}
    state.setdefault("history", {})
    return items, state


def save(items, state):
    names = []
    chunks = range(0, max(len(items), 1), PART)
    for index, start in enumerate(chunks, 1):
        name = f"videos-{index}.json"
        (DATA / name).write_text(json.dumps(items[start:start + PART], ensure_ascii=False))
        names.append(name)
    for path in DATA.glob("videos-*.json"):
        if path.name not in names:
            path.unlink()
    if VIDEOS.exists():
        VIDEOS.unlink()
    (DATA / "catalog.json").write_text(json.dumps({"parts": names, "count": len(items)}, ensure_ascii=False))
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
                rating = row.get("rating")
                if ext not in {"mp4", "webm", "gif"} or not wanted(post_tags, rating) or not row.get("file_url"):
                    continue
                found.append({
                    "source": "danbooru",
                    "source_id": row["id"],
                    "md5": row.get("md5"),
                    "score": row.get("score") or 0,
                    "rating": rating,
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
    tags_list = GEL_TAGS if name == "gelbooru" else (QUERY,)
    cursors = state["history"].setdefault(name, {})
    if not isinstance(cursors, dict):
        cursors = {}
        state["history"][name] = cursors
    found = []
    for tags in tags_list:
        cursor = cursors.get(tags, 0)
        pages = {0}
        if cursor != "done":
            pages.update(range(int(cursor), int(cursor) + STEP))
        done = False
        failed = False
        for pid in sorted(pages):
            params = {
                "page": "dapi", "s": "post", "q": "index", "json": 1,
                "tags": tags, "limit": 100, "pid": pid,
                "user_id": user, "api_key": key,
            }
            payload = get(endpoint + "?" + urllib.parse.urlencode(params))
            time.sleep(0.6)
            if payload is None:
                failed = True
                break
            rows = payload if isinstance(payload, list) else payload.get("post", [])
            if isinstance(rows, dict):
                rows = [rows]
            if not rows:
                done = True
                break
            for row in rows:
                post_tags = str(row.get("tags") or "").split()
                file_url = row.get("file_url") or ""
                rating = row.get("rating")
                if not wanted(post_tags, rating) or not file_url:
                    continue
                if not file_url.lower().endswith((".mp4", ".webm", ".gif")) and "video" not in post_tags and "animated" not in post_tags:
                    continue
                found.append({
                    "source": name,
                    "source_id": int(row.get("id")),
                    "md5": row.get("md5") or row.get("hash"),
                    "score": int(row.get("score") or 0),
                    "rating": rating,
                    "tags": post_tags,
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
        if failed:
            print(f"{name} {tags}: request failed, cursor kept")
            continue
        cursors[tags] = "done" if done or cursor == "done" else int(cursor) + STEP
    return found


def main():
    items, state = load()
    fresh = []
    fresh.extend(danbooru(state))
    fresh.extend(gelbooru_like("gelbooru", "https://gelbooru.com/index.php", "GELBOORU_USER_ID", "GELBOORU_API_KEY", state))
    fresh.extend(gelbooru_like("rule34", "https://api.rule34.xxx/index.php", "RULE34_USER_ID", "RULE34_API_KEY", state))
    merged = [item for item in keep_best(items + fresh) if wanted(item.get("tags") or [], item.get("rating"))]
    save(merged, state)
    print(f"catalog {len(merged)} items, added batch {len(fresh)}")
    print("history", json.dumps(state.get("history"), ensure_ascii=False))


if __name__ == "__main__":
    main()
