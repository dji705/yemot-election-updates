import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let CACHE;

function loadData() {
  if (CACHE) return CACHE;
  const readCompressed = (name) => {
    const file = path.join(ROOT, "election26", "data", name);
    const b64 = fs.readFileSync(file, "utf8").replace(/\s+/g, "");
    return JSON.parse(gunzipSync(Buffer.from(b64, "base64")).toString("utf8"));
  };
  const towns = readCompressed("towns.json.gz.b64");
  const stations = readCompressed("polling-stations.json.gz.b64");
  const excluded = new Set(["סמל ועדה","שם ישוב","סמל ישוב","בזב","מצביעים","פסולים","כשרים","Unnamed: 45","Unnamed: 51"]);
  const partyFields = Object.keys(towns[0] || {}).filter(k => !excluded.has(k));
  CACHE = { towns, stations, partyFields };
  return CACHE;
}

const LETTERS = [..."אבגדהוזחטיכלמנסעפצקרשת"];
const LETTERS_PER_PAGE = 9;
const PAGE_SIZE = 8;
const clean = (v) => String(v ?? "").replace(/[\r\n#]/g, " ").replace(/\s+/g, " ").trim();
const num = (v) => Number(v || 0);
const pct = (a, b) => b ? (100 * a / b).toFixed(1) : "0";
const say = (text) => clean(text);
function read(text, param = "home") {
  return "read=t-" + say(text) + "=" + param + ",no,1,1,7,Digits,no,no,,,1,Ok";
}
function partyList(row, fields, max = 6) {
  return fields.map(code => ({ code, votes: num(row[code]) }))
    .filter(x => x.votes > 0)
    .sort((a, b) => b.votes - a.votes)
    .slice(0, max);
}
function partiesText(row, fields, valid) {
  const list = partyList(row, fields, 7);
  return list.length
    ? "הרשימות המובילות: " + list.map(x => x.code + ", " + x.votes + " קולות, " + pct(x.votes, valid) + " אחוז").join(". ") + "."
    : "לא נמצאו קולות לרשימות.";
}
function townStats(t) {
  return "יישוב " + t["שם ישוב"] + ". בעלי זכות בחירה " + num(t["בזב"]) +
    ". מצביעים " + num(t["מצביעים"]) + ". אחוז הצבעה " + pct(num(t["מצביעים"]), num(t["בזב"])) +
    ". קולות כשרים " + num(t["כשרים"]) + ". קולות פסולים " + num(t["פסולים"]) + ".";
}
function menuHome() {
  return read("מאגר תוצאות בחירות. שימו לב, קובץ המקור מסומן בחירות 24, ולא אומת כנתוני הכנסת ה־26. לחיפוש לפי יישוב הקישו אחת. לסיכום ארצי של הנתונים הקישו שתיים. ליציאה הקישו אפס.", "home");
}
function findInput(q) {
  const fixed = ["home", "wm_nav", "WM_NAV", "CHOICE", "choice", "Digits", "digits", "key", "KEY"];
  for (const k of fixed) if (q[k] !== undefined && String(q[k]).trim() !== "") return { param: k, value: String(q[k]).trim() };
  const prefixes = ["letterpage_", "townlist_", "townaction_", "stations_"];
  for (const prefix of prefixes) {
    const k = Object.keys(q).find(x => x.startsWith(prefix) && String(q[x]).trim() !== "");
    if (k) return { param: k, value: String(q[k]).trim() };
  }
  return null;
}
function townListFor(letterIndex, towns) {
  const letter = LETTERS[letterIndex];
  return towns.filter(t => String(t["שם ישוב"] || "").startsWith(letter))
    .sort((a, b) => String(a["שם ישוב"]).localeCompare(String(b["שם ישוב"]), "he"));
}
function letterPrompt(page) {
  const group = LETTERS.slice(page * LETTERS_PER_PAGE, (page + 1) * LETTERS_PER_PAGE);
  const options = group.map((l, i) => "לאות " + l + " הקישו " + (i + 1)).join(". ");
  return "בחרו אות ראשונה של שם היישוב. " + options + ". " +
    (page < 2 ? "לקבוצת האותיות הבאה הקישו אפס." : "לחזרה לתפריט הראשי הקישו אפס.");
}
function townListPrompt(list, letterIndex, page) {
  const start = page * PAGE_SIZE;
  const names = list.slice(start, start + PAGE_SIZE);
  const spoken = names.map((t, i) => (i + 1) + ". " + t["שם ישוב"]).join(". ");
  return "נמצאו " + list.length + " יישובים. " + (spoken || "אין יישובים בעמוד זה.") +
    ". לבחירת יישוב הקישו את מספרו. " + (start + PAGE_SIZE < list.length ? "לעמוד הבא הקישו אפס. " : "") +
    "לחזרה לבחירת אות הקישו תשע.";
}
function townMenu(t) {
  return "נבחר היישוב " + t["שם ישוב"] + ". לסיכום הצבעה הקישו אחת. לתוצאות הרשימות הקישו שתיים. לפירוט קלפיות הקישו שלוש. לחיפוש יישוב אחר הקישו אפס.";
}
function stationRows(town, stations) {
  return stations.filter(s => String(s["סמל ישוב"]) === String(town["סמל ישוב"]))
    .sort((a, b) => num(a["קלפי"]) - num(b["קלפי"]));
}
function stationPrompt(rows, town, page) {
  const slice = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  return "ביישוב " + town["שם ישוב"] + " יש " + rows.length + " קלפיות. " +
    slice.map((s, i) => "להשמעת קלפי " + s["קלפי"] + " הקישו " + (i + 1)).join(". ") +
    ". " + (page * PAGE_SIZE + PAGE_SIZE < rows.length ? "לעמוד הבא הקישו אפס. " : "") +
    "לחזרה ליישוב הקישו תשע.";
}
function nationalSummary(towns, fields) {
  const totals = { eligible: 0, voted: 0, valid: 0, invalid: 0 };
  const votes = Object.fromEntries(fields.map(k => [k, 0]));
  for (const t of towns) {
    totals.eligible += num(t["בזב"]);
    totals.voted += num(t["מצביעים"]);
    totals.valid += num(t["כשרים"]);
    totals.invalid += num(t["פסולים"]);
    for (const f of fields) votes[f] += num(t[f]);
  }
  const top = Object.entries(votes).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 8);
  return "סיכום הנתונים בקובץ. בעלי זכות בחירה " + totals.eligible + ". מצביעים " + totals.voted +
    ". אחוז הצבעה " + pct(totals.voted, totals.eligible) + ". קולות כשרים " + totals.valid +
    ". פסולים " + totals.invalid + ". הרשימות המובילות: " +
    top.map(([k, v]) => k + ", " + v + " קולות, " + pct(v, totals.valid) + " אחוז").join(". ") + ".";
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).send(read("השירות תומך בבקשת GET בלבד."));
  try {
    const { towns, stations, partyFields } = loadData();
    const q = req.query || {};
    const action = String(q.action || "").toLowerCase();
    if (action === "health") return res.status(200).send("OK: " + towns.length + " towns, " + stations.length + " polling stations");
    if (action === "json") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(200).json({ towns: towns.length, pollingStations: stations.length, partyCodes: partyFields, sourceElection: 24, verifiedAsKnesset26: false });
    }
    const input = findInput(q);
    if (!input) return res.status(200).send(menuHome());
    const key = input.value;
    const param = input.param;

    if (param === "home" || ["wm_nav","WM_NAV","CHOICE","choice","Digits","digits","key","KEY"].includes(param)) {
      if (key === "0") return res.status(200).send("go_to_folder=/8");
      if (key === "1") return res.status(200).send(read(letterPrompt(0), "letterpage_0"));
      if (key === "2") return res.status(200).send(read(nationalSummary(towns, partyFields), "home"));
      return res.status(200).send(menuHome());
    }

    if (param.startsWith("letterpage_")) {
      const page = Number(param.split("_")[1]) || 0;
      if (key === "0") {
        const next = page + 1;
        return res.status(200).send(next < 3 ? read(letterPrompt(next), "letterpage_" + next) : menuHome());
      }
      const index = page * LETTERS_PER_PAGE + Number(key) - 1;
      if (!Number.isInteger(index) || index < page * LETTERS_PER_PAGE || index >= Math.min(LETTERS.length, (page + 1) * LETTERS_PER_PAGE)) {
        return res.status(200).send(read("בחירה לא תקינה. " + letterPrompt(page), param));
      }
      const list = townListFor(index, towns);
      if (!list.length) return res.status(200).send(read("לא נמצאו יישובים באות " + LETTERS[index] + ". " + letterPrompt(page), param));
      return res.status(200).send(read(townListPrompt(list, index, 0), "townlist_" + index + "_0"));
    }

    if (param.startsWith("townlist_")) {
      const [, letterRaw, pageRaw] = param.split("_");
      const letterIndex = Number(letterRaw);
      const page = Number(pageRaw) || 0;
      const list = townListFor(letterIndex, towns);
      if (key === "0" && (page + 1) * PAGE_SIZE < list.length) {
        const next = page + 1;
        return res.status(200).send(read(townListPrompt(list, letterIndex, next), "townlist_" + letterIndex + "_" + next));
      }
      if (key === "9") return res.status(200).send(read(letterPrompt(Math.floor(letterIndex / LETTERS_PER_PAGE)), "letterpage_" + Math.floor(letterIndex / LETTERS_PER_PAGE)));
      const selected = list[page * PAGE_SIZE + Number(key) - 1];
      if (!selected || !/^[1-8]$/.test(key)) return res.status(200).send(read("בחירה לא תקינה. " + townListPrompt(list, letterIndex, page), param));
      return res.status(200).send(read(townMenu(selected), "townaction_" + selected["סמל ישוב"]));
    }

    if (param.startsWith("townaction_")) {
      const code = param.slice("townaction_".length);
      const town = towns.find(t => String(t["סמל ישוב"]) === code);
      if (!town) return res.status(200).send(menuHome());
      if (key === "0") return res.status(200).send(read(letterPrompt(0), "letterpage_0"));
      if (key === "1") return res.status(200).send(read(townStats(town) + " " + townMenu(town), param));
      if (key === "2") return res.status(200).send(read("תוצאות הרשימות ביישוב " + town["שם ישוב"] + ". " + partiesText(town, partyFields, num(town["כשרים"])) + " " + townMenu(town), param));
      if (key === "3") {
        const rows = stationRows(town, stations);
        if (!rows.length) return res.status(200).send(read("לא נמצאו קלפיות. " + townMenu(town), param));
        return res.status(200).send(read(stationPrompt(rows, town, 0), "stations_" + code + "_0"));
      }
      return res.status(200).send(read(townMenu(town), param));
    }

    if (param.startsWith("stations_")) {
      const [, code, pageRaw] = param.split("_");
      const page = Number(pageRaw) || 0;
      const town = towns.find(t => String(t["סמל ישוב"]) === code);
      if (!town) return res.status(200).send(menuHome());
      const rows = stationRows(town, stations);
      if (key === "9") return res.status(200).send(read(townMenu(town), "townaction_" + code));
      if (key === "0" && (page + 1) * PAGE_SIZE < rows.length) {
        const next = page + 1;
        return res.status(200).send(read(stationPrompt(rows, town, next), "stations_" + code + "_" + next));
      }
      if (!/^[1-8]$/.test(key)) return res.status(200).send(read(stationPrompt(rows, town, page), param));
      const station = rows[page * PAGE_SIZE + Number(key) - 1];
      if (!station) return res.status(200).send(read(stationPrompt(rows, town, page), param));
      const text = "קלפי " + station["קלפי"] + " ביישוב " + town["שם ישוב"] + ". בעלי זכות בחירה " + num(station["בזב"]) +
        ". מצביעים " + num(station["מצביעים"]) + ". אחוז הצבעה " + pct(num(station["מצביעים"]), num(station["בזב"])) +
        ". קולות כשרים " + num(station["כשרים"]) + ". פסולים " + num(station["פסולים"]) + ". " +
        partiesText(station, partyFields, num(station["כשרים"])) + " לחזרה לרשימת הקלפיות הקישו תשע.";
      return res.status(200).send(read(text, param));
    }

    return res.status(200).send(menuHome());
  } catch (error) {
    console.error("election26 IVR error:", error);
    return res.status(200).send(read("אירעה שגיאה בטעינת מאגר התוצאות. נא לנסות שוב מאוחר יותר."));
  }
}
