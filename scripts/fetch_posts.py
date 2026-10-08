def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=40) as res:
            return json.loads(res.read().decode("utf-8"))
    except Exception as exc:
        print(f"request failed: {exc} {url.split('api_key')[0]}")
        return None


GEL_TAGS = (
    "3d video rating:explicit", "source_filmmaker video rating:explicit",
    "blender video rating:explicit", "mmd video rating:explicit",
    "daz_studio video rating:explicit", "koikatsu video rating:explicit",
    "honey_select video rating:explicit",
)


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
            continue
        cursors[tags] = "done" if done or cursor == "done" else int(cursor) + STEP
    return found
