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

GitHub Actions は30分ごと（cron `0,30`）に同じスクリプトを実行します。保存は分割 JSON で、`data/videos-N.json` は全項目を含む取得用、`data/cards-N.json` は表示用の軽量版、`data/catalog.json` はパート一覧です。2026年11月時点で約26.5万件、27パートあります。1回の取得はクエリごとに最新ページ（100件）＋未完了の履歴ページです。Actions タブから手動実行もできます。

ブラウザは先頭パートから段階的に読み込みます。続きはスクロールまたはボタンで読み込めます。検索・件数は読込済みの範囲が対象です。Pages は `python scripts/build_site.py` で `_site/` に集めた公開に必要なファイルだけを配信します。

取得時に全ソースが失敗すると Actions が失敗します。部分失敗は実行サマリに表示します。サムネイル取得は1回あたり約10分で打ち切り、残りは次回。

## 重複と除外

同じ MD5 はスコアの高い方を残します。`futanari` `futa` `dickgirl` `newhalf` `bestiality` `zoophilia` `beastiality` は保存しません。

作品を増やすときは `data/taxonomy.json` にタグと日本語名を足してください。対応が無い作品は英語タグのまま一覧に出ます。
