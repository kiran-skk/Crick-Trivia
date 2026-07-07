/**
 * Stage 2: Enrich each player with structured career data from Wikipedia.
 * Reads:  scripts/data/roster.json
 * Output: scripts/data/enriched.json  (array of player objects with parsed career data)
 *
 * Run: node scripts/2-enrich.mjs
 *
 * Uses Wikipedia's batch query API (50 titles per request) to keep runtime short.
 * Checkpoints every 500 players so it can resume if interrupted.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROSTER_FILE = path.join(__dir, 'data', 'roster.json');
const OUT_FILE = path.join(__dir, 'data', 'enriched.json');
const BATCH_SIZE = 50;
const CHECKPOINT_EVERY = 500;

// ── Wikipedia helpers ──────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function wikiQuery(titles) {
  // Returns { [normalizedTitle]: { extract, wikitext } }
  const params = new URLSearchParams({
    action: 'query',
    titles: titles.join('|'),
    prop: 'extracts|revisions',
    exintro: '1',
    explaintext: '1',
    exsentences: '5',
    rvprop: 'content',
    rvsection: '0',
    rvslots: 'main',
    format: 'json',
    origin: '*',
    redirects: '1',
  });

  let res;
  for (let attempt = 0; attempt < 5; attempt++) {
    res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      headers: { 'User-Agent': 'CrickTriviaBot/1.0 (educational cricket trivia game)' },
    });
    if (res.status === 429) { await sleep(2000 * Math.pow(2, attempt)); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    break;
  }
  const data = await res.json();
  const pages = data?.query?.pages ?? {};

  const result = {};
  for (const page of Object.values(pages)) {
    if (page.missing) continue;
    const title = page.title;
    const extract = page.extract ?? '';
    const wikitext = page.revisions?.[0]?.slots?.main?.['*'] ?? '';
    result[title] = { extract, wikitext };
  }
  // Apply normalizations/redirects so we can match back to original titles
  for (const norm of (data?.query?.normalized ?? [])) {
    if (result[norm.to] && !result[norm.from]) result[norm.from] = result[norm.to];
  }
  for (const redir of (data?.query?.redirects ?? [])) {
    if (result[redir.to] && !result[redir.from]) result[redir.from] = result[redir.to];
  }
  return result;
}

// ── Wikitext parsing ───────────────────────────────────────────────────────

function cleanWiki(s) {
  if (!s) return '';
  return s
    .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1')              // [[link|text]] or [[link]]
    .replace(/\{\{ubl\|([^}]*?)(?:\}\}|$)/gi,                       // {{ubl|a|b}} → a / b
      (_, c) => c.split('|').filter(Boolean).join(' / '))
    .replace(/\{\{(?:nowrap|lang[^|]*|IPA[^|]*)\|([^}]*)\}\}/gi, '$1') // {{nowrap|x}} → x
    .replace(/\{\{[^{}]*\}\}/g, '')                                  // any remaining {{template}}
    .replace(/\{\{[^}]*/g, '')                                       // unclosed {{...
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/'{2,}/g, '')
    .replace(/&[a-z#\d]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function field(wikitext, key) {
  // Allow values that start with {{ (templates) by using a looser first char
  const re = new RegExp(`\\|\\s*${key}\\s*=\\s*([^|\\n][^\\n]*)`, 'i');
  const m = wikitext.match(re);
  if (!m) return null;
  // Strip off a trailing | or }} that bled in from the next field
  const raw = m[1].replace(/\s*\|.*$/s, '').replace(/\}\}.*$/s, '');
  return cleanWiki(raw) || null;
}

function fieldNum(wikitext, key) {
  const val = field(wikitext, key);
  // Strip commas from numbers like "15,921"
  const n = parseInt((val ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseYear(text) {
  const m = (text ?? '').match(/(\d{4})/);
  return m ? parseInt(m[1]) : null;
}

function parseBirthYear(wikitext, extract) {
  // Try infobox first
  const bf = field(wikitext, 'birth_date') ?? field(wikitext, 'date_of_birth');
  if (bf) {
    const y = bf.match(/(\d{4})/);
    if (y) return parseInt(y[1]);
  }
  // Fall back to extract intro "born 5 November 1988" or "(born 1988)"
  const em = extract.match(/\(born[^)]*?(\d{4})\)/i) ?? extract.match(/born\s+(?:\d+\s+\w+\s+)?(\d{4})/i);
  return em ? parseInt(em[1]) : null;
}

function parseCountry(wikitext, extract) {
  const cf = field(wikitext, 'country') ?? field(wikitext, 'nationality');
  if (cf && cf.length < 40) return cf;
  const MAP = {
    'Indian': 'India', 'Australian': 'Australia', 'English': 'England', 'British': 'England',
    'Pakistani': 'Pakistan', 'West Indian': 'West Indies', 'Sri Lankan': 'Sri Lanka',
    'South African': 'South Africa', 'New Zealand': 'New Zealand', 'New Zealander': 'New Zealand',
    'Bangladeshi': 'Bangladesh', 'Zimbabwean': 'Zimbabwe', 'Afghan': 'Afghanistan',
    'Irish': 'Ireland', 'Dutch': 'Netherlands', 'Scottish': 'Scotland', 'Kenyan': 'Kenya',
    'Namibian': 'Namibia', 'Nepali': 'Nepal', 'Canadian': 'Canada', 'Omani': 'Oman',
  };
  for (const [adj, country] of Object.entries(MAP)) {
    if (extract.includes(adj + ' international') || extract.includes(adj + ' cricketer')) {
      return country;
    }
  }
  return null;
}

function parseBirthPlace(wikitext) {
  return field(wikitext, 'birth_place') ?? field(wikitext, 'place_of_birth') ?? null;
}

function parseBatting(wikitext) {
  return field(wikitext, 'batting') ?? field(wikitext, 'batting_style') ?? null;
}

function parseBowling(wikitext) {
  return field(wikitext, 'bowling') ?? field(wikitext, 'bowling_style') ?? null;
}

function parseRole(wikitext, extract) {
  const r = field(wikitext, 'role');
  if (r) return r;
  const ROLES = [
    [/wicket.?keep/i, 'wicketkeeper-batter'],
    [/all.?round/i, 'all-rounder'],
    [/opening batt/i, 'opening batter'],
    [/top.?order batt/i, 'top-order batter'],
    [/middle.?order batt/i, 'middle-order batter'],
    [/lower.?order batt/i, 'lower-order batter'],
    [/leg.?spin/i, 'leg-spin bowler'],
    [/off.?spin/i, 'off-spin bowler'],
    [/left.?arm spin/i, 'left-arm spinner'],
    [/fast.?medium bow/i, 'fast-medium bowler'],
    [/fast bow/i, 'fast bowler'],
    [/pace bow/i, 'pace bowler'],
    [/spin bow/i, 'spin bowler'],
    [/batt/i, 'batter'],
  ];
  for (const [pat, role] of ROLES) {
    if (pat.test(extract)) return role;
  }
  return null;
}

function parseDebut(wikitext, prefix) {
  const dateStr = field(wikitext, `${prefix}debutdate`);
  const vs = field(wikitext, `${prefix}debutvs`);
  // Fallback: extract year directly from raw line even if cleanWiki stripped the template
  let year = parseYear(dateStr);
  if (!year) {
    const raw = wikitext.match(new RegExp(`\\|\\s*${prefix}debutdate\\s*=\\s*([^\\n]+)`, 'i'));
    if (raw) year = parseYear(raw[1]);
  }
  if (!year && !vs) return null;
  return { year: year ?? null, vs: vs ?? null };
}

function parseClubs(wikitext) {
  const clubs = [];
  for (let i = 1; i <= 12; i++) {
    const c = field(wikitext, `club${i}`);
    if (!c) break;
    if (c.length < 80 && !clubs.includes(c)) clubs.push(c);
  }
  return clubs;
}

function parseStats(wikitext) {
  const formats = {};
  for (let i = 1; i <= 5; i++) {
    const colName = cleanWiki(field(wikitext, `column${i}`) ?? '').replace(/\s*\(.*?\)$/, '').trim();
    if (!colName) continue;
    const matches = fieldNum(wikitext, `matches${i}`);
    if (!matches) continue;
    formats[colName] = {
      matches,
      runs: fieldNum(wikitext, `runs${i}`),
      wickets: fieldNum(wikitext, `wickets${i}`),
      batAvg: fieldNum(wikitext, `bat avg${i}`) ?? fieldNum(wikitext, `batting avg${i}`),
      bowlAvg: fieldNum(wikitext, `bowl avg${i}`) ?? fieldNum(wikitext, `bowling avg${i}`),
    };
  }
  return Object.keys(formats).length ? formats : null;
}

function isCricketer(extract) {
  return /cricket/i.test(extract.slice(0, 400));
}

function parsePlayer(title, extract, wikitext) {
  if (!isCricketer(extract)) return null;

  const name = title.replace(/\s*\(.*?\)$/, '').trim(); // strip disambiguation suffixes
  const country = parseCountry(wikitext, extract);
  const birthYear = parseBirthYear(wikitext, extract);
  const birthPlace = parseBirthPlace(wikitext);
  const batting = parseBatting(wikitext);
  const bowling = parseBowling(wikitext);
  const role = parseRole(wikitext, extract);
  const testDebut = parseDebut(wikitext, 'test');
  const odiDebut = parseDebut(wikitext, 'odi');
  const t20iDebut = parseDebut(wikitext, 't20i');
  const clubs = parseClubs(wikitext);
  const stats = parseStats(wikitext);

  // Need at least country or birth year to make useful hints
  if (!country && !birthYear) return null;

  return {
    name,
    country,
    birthYear,
    birthPlace,
    batting,
    bowling,
    role,
    testDebut,
    odiDebut,
    t20iDebut,
    clubs: clubs.length ? clubs : null,
    stats,
    introText: extract.slice(0, 400).replace(/\n/g, ' ').trim(),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const roster = JSON.parse(await fs.readFile(ROSTER_FILE, 'utf8'));
  console.log(`Roster has ${roster.length} players.`);

  // Load existing enriched data if resuming
  let done = new Map();
  try {
    const prev = JSON.parse(await fs.readFile(OUT_FILE, 'utf8'));
    prev.forEach(p => done.set(p.name, p));
    console.log(`Resuming: ${done.size} already enriched.`);
  } catch {}

  const remaining = roster.filter(n => !done.has(n.replace(/\s*\(.*?\)$/, '').trim()));
  console.log(`Fetching data for ${remaining.length} players...`);

  let fetched = 0;
  let skipped = 0;

  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE);
    try {
      const pages = await wikiQuery(batch);
      for (const title of batch) {
        const page = pages[title];
        if (!page) { skipped++; continue; }
        const player = parsePlayer(title, page.extract, page.wikitext);
        if (player) {
          done.set(player.name, player);
          fetched++;
        } else {
          skipped++;
        }
      }
    } catch (e) {
      console.error(`\nBatch error at ${i}: ${e.message}. Retrying in 2s...`);
      await sleep(2000);
      i -= BATCH_SIZE; // retry this batch
      continue;
    }

    const total = fetched + skipped;
    process.stdout.write(`\r  ${total}/${remaining.length} processed — ${fetched} enriched, ${skipped} skipped`);

    // Checkpoint
    if (total % CHECKPOINT_EVERY === 0 || i + BATCH_SIZE >= remaining.length) {
      await fs.writeFile(OUT_FILE, JSON.stringify([...done.values()], null, 2));
    }

    await sleep(600); // ~1.5 requests/sec, safely under Wikipedia's limits
  }

  console.log(`\n\nDone. ${done.size} players saved to scripts/data/enriched.json`);
}

main().catch(e => { console.error(e); process.exit(1); });
