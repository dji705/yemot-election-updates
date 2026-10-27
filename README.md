# Yemot Election Updates

Node.js API for Vercel that reads election-related headlines from configured public RSS feeds and formats a short Hebrew response for Yemot HaMashiach.

## Deploy

Import this repository into Vercel. The project uses Node.js 18+ and has no npm dependencies.

## Endpoints

- `/api/yemot` — Hebrew welcome/menu message.
- `/api/yemot?action=latest` — reads the latest election-related headlines.
- `/api/yemot?action=list&limit=10` — reads up to 10 headlines.
- `/api/yemot?action=item&n=1` — reads one item from the current feed results.
- `/api/yemot?action=sources` — describes the news sources.
- `/api/yemot?action=json` — returns structured JSON for testing.

## Yemot INI starter

```ini
type=api
api_link=https://YOUR-PROJECT.vercel.app/api/yemot?action=latest
say_api_answer=yes
api_url_post=no
```

Replace `YOUR-PROJECT` with the Vercel deployment name. Verify the response format with a test call before connecting the line.

## Sources and limitations

The source list is in `api/yemot.js`: ynet breaking news and general news, כאן חדשות, כל רגע (`https://www.kore.co.il/feed`), וואלה, סרוגים, מעריב, and ישראל היום. RSS feed formats and availability can change. A source that fails to respond is skipped so the API can still return headlines from other sources. The API filters RSS headlines by election-related Hebrew keywords; this can miss relevant articles or include unrelated ones. The official Central Elections Committee website is listed for reference but is not scraped as a feed.

This is a headline reader, not an official election-results service. Verify official results and announcements at the Central Elections Committee website.
