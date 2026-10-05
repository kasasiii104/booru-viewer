# booru-viewer

Danbooru、Gelbooru、Rule34.xxx の動画と GIF を、YouTube に近い一覧で見る個人用ビューアーです。ファイルは保存せず、元の URL を再生します。Sankaku は対象外です。獣姦とふたなりは除外します。

## 画面

`index.html` を開くか、GitHub Pages で公開します。サムネイルをタップするとその場で再生します。作品名は `data/taxonomy.json` の対応表で日本語になります。

## 初回取得

API キーはリポジトリの Secrets に置きます。フロントには入れません。

- `DANBOORU_LOGIN` / `DANBOORU_API_KEY`（無くても少量は取れます）
- `GELBOORU_USER_ID` / `GELBOORU_API_KEY`
- `RULE34_USER_ID` / `RULE34_API_KEY`

手元で更新する場合:

```bash
python scripts/fetch_posts.py
```

GitHub Actions は 6 時間ごとに同じスクリプトを実行し、`data/videos.json` を更新します。Actions タブから手動実行もできます。

## 重複と除外

同じ MD5 はスコアの高い方を残します。`futanari` `futa` `dickgirl` `newhalf` `bestiality` `zoophilia` `beastiality` は保存しません。

作品を増やすときは `data/taxonomy.json` にタグと日本語名を足してください。対応が無い作品は英語タグのまま一覧に出ます。
