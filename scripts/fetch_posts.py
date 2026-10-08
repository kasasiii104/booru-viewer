def cache_thumbs(items, limit=1500):
    thumbs = DATA / "thumbs"
    thumbs.mkdir(exist_ok=True)
    saved = 0
    for item in items:
        if saved >= limit:
            break
        if item.get("source") != "gelbooru":
            continue
        key = item.get("md5") or str(item.get("source_id"))
        dest = thumbs / f"{key}.jpg"
        rel = f"data/thumbs/{key}.jpg"
        if dest.exists() and dest.stat().st_size > 200:
            item["preview_url"] = rel
            continue
        url = item.get("preview_url") or ""
        if "gelbooru.com" not in url:
            continue
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://gelbooru.com/"})
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                body = res.read()
                kind = res.headers.get("content-type", "")
            if "image" in kind and len(body) > 200:
                dest.write_bytes(body)
                item["preview_url"] = rel
                saved += 1
        except Exception as exc:
            print(f"thumb failed: {exc}")
    print(f"gelbooru thumbs saved {saved}")
