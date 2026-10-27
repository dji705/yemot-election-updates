# Yemot Election Updates

Node.js API for Vercel that reads election-related headlines from configured public RSS feeds and formats a short Hebrew response for Yemot HaMashiach.

## Deploy

Import this repository into Vercel. The project uses Node.js 18+ and has no npm dependencies.

## Endpoints

- `/api/yemot` — interactive Hebrew menu: press 1 for latest election headlines, 2 for sources, or 0 to finish. After options 1 and 2, the menu is played again.
- `/api/yemot?action=latest` — reads the latest election-related headlines directly (for browser testing).
- `/api/yemot?action=list&limit=10` — reads up to 10 headlines.
- `/api/yemot?action=item&n=1` — reads one item from the current feed results.
- `/api/yemot?action=sources` — describes the news sources.
- `/api/yemot?action=json` — returns structured JSON for testing.

## Yemot INI starter

```ini
type=api
api_link=https://YOUR-PROJECT.vercel.app/api/yemot
say_api_answer=yes
api_url_post=no
api_end_goto=/8
```

Replace `YOUR-PROJECT` with the Vercel deployment name. Verify the response format with a test call before connecting the line.

## Sources and limitations

The source list is in `api/yemot.js`: ynet breaking and general news, כאן חדשות, כל רגע, וואלה general/politics/breaking, סרוגים, מעריב, ישראל היום, Google News election search, and the Jerusalem Post 2026 election feed. The parser supports RSS and Atom-style entries, normalizes duplicate headlines across feeds, and filters Hebrew and English election-related terms. RSS feed formats and availability can change; a source that fails or times out is skipped so other feeds can still contribute. The Central Elections Committee site is not treated as an RSS feed.

This is a headline reader, not an official election-results service. Verify official results and announcements at the Central Elections Committee website.
