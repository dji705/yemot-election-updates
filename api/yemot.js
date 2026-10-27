const SOURCES = [
  { name: "ynet מבזקים", url: "https://www.ynet.co.il/Integration/StoryRss1854.xml" },
  { name: "ynet חדשות", url: "https://www.ynet.co.il/Integration/StoryRss2.xml" },
  { name: "כאן חדשות", url: "https://www.kan.org.il/rss/" },
  { name: "כל רגע", url: "https://www.kore.co.il/feed" },
  { name: "וואלה", url: "https://rss.walla.co.il/feed/22" },
  { name: "סרוגים", url: "https://www.srugim.co.il/feed" },
  { name: "מעריב מבזקים", url: "https://www.maariv.co.il/Rss/RssFeedsMivzakiChadashot" },
  { name: "ישראל היום", url: "https://www.israelhayom.co.il/rss" },
  { name: "ועדת הבחירות המרכזית", url: "https://www.bechirot.gov.il/" }
];

const MAX_ITEMS = 30;
const TIMEOUT_MS = 4500;

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(item, name) {
  const match = item.match(new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "i"));
  return match ? decodeXml(match[1]) : "";
}

function parseRss(xml, source) {
  const items = [];
  const chunks = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
  for (const chunk of chunks) {
    const title = tag(chunk, "title");
    const link = tag(chunk, "link");
    const pubDate = tag(chunk, "pubDate") || tag(chunk, "dc:date");
    const description = tag(chunk, "description");
    if (!title || !link || !/^https?:\/\//i.test(link)) continue;
    items.push({
      title: title.slice(0, 240),
      source,
      link,
      date: pubDate || "",
      description: description.slice(0, 400)
    });
  }
  return items;
}

async function getFeed(source) {
  if (source.name === "ועדת הבחירות המרכזית") return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: { "user-agent": "yemot-election-updates/1.0 (+RSS reader)" }
    });
    if (!response.ok) return [];
    const xml = await response.text();
    return parseRss(xml, source.name);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function isElectionRelated(item) {
  const text = (item.title + " " + item.description).toLowerCase();
  return /בחירות|ועדת הבחירות|קלפי|קלפיות|מפלגה|מפלגות|קמפיין|סקרים|מנדטים|הצבעה|בוחר|בוחרים|רשימה לכנסת|כנסת|ראש הממשלה|בחירות מקומיות/.test(text);
}

function cleanSpeech(text) {
  return String(text || "").replace(/[\r\n]/g, " ").replace(/#/g, "").replace(/\s+/g, " ").trim();
}

function formatRead(text) {
  return "read=t-" + cleanSpeech(text);
}

function formatMenu(text = "ברוכים הבאים לעדכוני בחירות.") {
  // Yemot API read grammar: read=<spoken text>=<parameter>,<reuse>,<max>,<min>,<timeout>,<input mode>,...
  // Accept only the three menu keys: 0, 1, 2.
  return "read=t-" + cleanSpeech(
    text + " להקראת המבזקים האחרונים הקישו אחת. לשמיעת מקורות החדשות הקישו שתיים. לחזרה לשלוחה הקודמת הקישו אפס."
  ) + "=CHOICE,,1,1,7,Digits,no,no,,012,1,Ok";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).send(formatRead("השירות תומך בבקשת GET בלבד"));

  const query = req.query || {};
  const action = String(query.action || "").toLowerCase();
  const choice = String(query.CHOICE ?? query.choice ?? query.Digits ?? query.digits ?? "").trim();
  const limit = Math.min(MAX_ITEMS, Math.max(1, Number.parseInt(query.limit || "10", 10) || 10));

  // The read prompt sends the next key back to this endpoint as CHOICE.
  if (choice === "0" || action === "0" || action === "exit" || action === "hangup") {
    return res.status(200).send("go_to_folder=/8");
  }

  if (choice === "2" || action === "2" || action === "sources") {
    const sourcesText = "מקורות החדשות הם ynet, כאן חדשות, כל רגע, וואלה, סרוגים, מעריב וישראל היום.";
    return res.status(200).send(formatMenu(sourcesText));
  }

  const wantsLatest = choice === "1" || action === "1" || action === "latest" || action === "list";
  const isMenuRequest = !choice && !action;

  if (!wantsLatest && !isMenuRequest && action !== "json" && action !== "item") {
    return res.status(200).send(formatMenu("לא זוהתה בחירה."));
  }

  if (isMenuRequest) {
    return res.status(200).send(formatMenu());
  }

  const feeds = await Promise.all(SOURCES.map(getFeed));
  let items = feeds.flat().filter(isElectionRelated);
  const seen = new Set();
  items = items.filter(item => {
    const key = item.link || item.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  items.sort((a, b) => {
    const ta = Date.parse(a.date) || 0;
    const tb = Date.parse(b.date) || 0;
    return tb - ta;
  });
  items = items.slice(0, limit);

  if (action === "json") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      updatedAt: new Date().toISOString(),
      count: items.length,
      sources: SOURCES.map(s => ({ name: s.name, url: s.url })),
      items
    });
  }

  if (wantsLatest || action === "latest" || action === "list") {
    if (!items.length) return res.status(200).send(formatMenu("לא נמצאו כרגע מבזקי בחירות זמינים. נסו שוב מאוחר יותר."));
    const output = items.map((item, i) => "עדכון " + (i + 1) + ". " + item.title + ". מקור: " + item.source + ".").join(" ");
    return res.status(200).send(formatMenu(output));
  }

  if (action === "item") {
    const index = Math.max(1, Number.parseInt(query.n || "1", 10) || 1) - 1;
    const item = items[index];
    if (!item) return res.status(200).send(formatRead("העדכון המבוקש לא נמצא."));
    return res.status(200).send(formatMenu(item.title + ". מקור: " + item.source + ". " + (item.description || "")));
  }

  return res.status(200).send(formatMenu());
}