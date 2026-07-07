/**
 * Stage 1: Fetch cricket player names from Wikipedia categories.
 * Output: scripts/data/roster.json  (array of unique player article titles)
 *
 * Run: node scripts/1-fetch-roster.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dir, 'data', 'roster.json');

// Wikipedia cricket categories to pull from.
// Wikipedia uses "India Test cricketers" (country adjective form), NOT "Indian Test cricketers".
// Ordered by priority — international first, domestic/franchise after.
const CATEGORIES = [
  // Test-playing nations (men) — correct Wikipedia naming
  'India Test cricketers',
  'Australia Test cricketers',
  'England Test cricketers',
  'Pakistan Test cricketers',
  'West Indies Test cricketers',
  'Sri Lanka Test cricketers',
  'South Africa Test cricketers',
  'New Zealand Test cricketers',
  'Bangladesh Test cricketers',
  'Zimbabwe Test cricketers',
  'Afghanistan Test cricketers',
  'Ireland Test cricketers',
  'Netherlands cricketers',
  'Scotland cricketers',
  'Namibia cricketers',
  'United Arab Emirates cricketers',
  'Kenya cricketers',
  'Canada cricketers',
  'Nepal cricketers',
  'Papua New Guinea cricketers',
  'Oman cricketers',
  'Hong Kong cricketers',
  'Singapore cricketers',
  'USA cricketers',
  // ODI-only players (broader catch)
  'India One Day International cricketers',
  'Australia One Day International cricketers',
  'England One Day International cricketers',
  'Pakistan One Day International cricketers',
  'West Indies One Day International cricketers',
  'Sri Lanka One Day International cricketers',
  'South Africa One Day International cricketers',
  'New Zealand One Day International cricketers',
  'Bangladesh One Day International cricketers',
  'Zimbabwe One Day International cricketers',
  // Women's international
  'India women cricketers',
  'Australia women cricketers',
  'England women cricketers',
  'Pakistan women cricketers',
  'New Zealand women cricketers',
  'South Africa women cricketers',
  'West Indies women cricketers',
  'Sri Lanka women cricketers',
  'Bangladesh women cricketers',
  'Zimbabwe women cricketers',
  // IPL franchises (large source of domestic players)
  'Mumbai Indians cricketers',
  'Chennai Super Kings cricketers',
  'Royal Challengers Bangalore cricketers',
  'Kolkata Knight Riders cricketers',
  'Delhi Capitals cricketers',
  'Rajasthan Royals cricketers',
  'Sunrisers Hyderabad cricketers',
  'Punjab Kings cricketers',
  'Gujarat Titans cricketers',
  'Lucknow Super Giants cricketers',
  // Other major T20 leagues
  'Big Bash League cricketers',
  'Pakistan Super League cricketers',
  'Caribbean Premier League cricketers',
  'SA20 cricketers',
  'International League T20 cricketers',
  'Major League Cricket cricketers',
  'Women\'s Premier League cricketers',
  'Women\'s Big Bash League cricketers',
  // English county clubs (~100-300 players each)
  'Derbyshire County Cricket Club cricketers',
  'Durham County Cricket Club cricketers',
  'Essex County Cricket Club cricketers',
  'Glamorgan County Cricket Club cricketers',
  'Gloucestershire County Cricket Club cricketers',
  'Hampshire County Cricket Club cricketers',
  'Kent County Cricket Club cricketers',
  'Lancashire County Cricket Club cricketers',
  'Leicestershire County Cricket Club cricketers',
  'Middlesex County Cricket Club cricketers',
  'Northamptonshire County Cricket Club cricketers',
  'Nottinghamshire County Cricket Club cricketers',
  'Somerset County Cricket Club cricketers',
  'Surrey County Cricket Club cricketers',
  'Sussex County Cricket Club cricketers',
  'Warwickshire County Cricket Club cricketers',
  'Worcestershire County Cricket Club cricketers',
  'Yorkshire County Cricket Club cricketers',
  // Australian state teams
  'New South Wales cricketers',
  'Victoria cricketers',
  'Queensland cricketers',
  'South Australia cricketers',
  'Western Australia cricketers',
  'Tasmania cricketers',
  // Indian domestic teams (Ranji Trophy)
  'Mumbai cricketers',
  'Karnataka cricketers',
  'Tamil Nadu cricketers',
  'Delhi cricketers',
  'Uttar Pradesh cricketers',
  'Bengal cricketers',
  'Baroda cricketers',
  'Haryana cricketers',
  'Rajasthan cricketers',
  'Maharashtra cricketers',
  'Hyderabad cricketers',
  'Vidarbha cricketers',
  'Gujarat cricketers',
  'Punjab cricketers',
  'Madhya Pradesh cricketers',
  'Himachal Pradesh cricketers',
  // Pakistani domestic teams
  'Lahore Qalandars cricketers',
  'Islamabad United cricketers',
  'Karachi Kings cricketers',
  'Peshawar Zalmi cricketers',
  'Quetta Gladiators cricketers',
  'Multan Sultans cricketers',
  // South African domestic
  'Cape Cobras cricketers',
  'Lions cricketers',
  'Dolphins cricketers',
  'Knights cricketers',
  'Warriors cricketers',
  'Titans cricketers',
  // New Zealand domestic
  'Auckland cricket team cricketers',
  'Wellington cricket team cricketers',
  'Canterbury cricket team cricketers',
  'Otago cricket team cricketers',
  'Central Districts cricketers',
  'Northern Districts cricketers',
  // CPL teams
  'Trinbago Knight Riders cricketers',
  'Guyana Amazon Warriors cricketers',
  'Barbados Royals cricketers',
  'Jamaica Tallawahs cricketers',
  'Saint Kitts and Nevis Patriots cricketers',
  'Saint Lucia Kings cricketers',
];

// Titles to skip: lists, disambiguation pages, non-player articles
const SKIP_PATTERNS = [
  /^List of /i,
  /^Category:/i,
  /\(disambiguation\)/i,
  /cricket( team| board| council| association| federation)?$/i,
  /^ICC /i,
  /^[A-Z]{2,4} cricket/i,
  / season$/i,
  /tournament/i,
  / cup$/i,
];

function shouldSkip(title) {
  return SKIP_PATTERNS.some(p => p.test(title));
}

async function fetchCategoryPage(category, cmcontinue) {
  const params = new URLSearchParams({
    action: 'query',
    list: 'categorymembers',
    cmtitle: `Category:${category}`,
    cmlimit: '500',
    cmtype: 'page',
    format: 'json',
    origin: '*',
  });
  if (cmcontinue) params.set('cmcontinue', cmcontinue);

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      headers: { 'User-Agent': 'CrickTriviaBot/1.0 (educational cricket trivia game)' },
    });
    if (res.status === 429) {
      const wait = 2000 * Math.pow(2, attempt);
      process.stdout.write(` [rate-limited, waiting ${wait / 1000}s]`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  throw new Error('Too many 429 retries');
}

async function fetchCategory(category) {
  const names = [];
  let cmcontinue = null;
  let pages = 0;

  do {
    const data = await fetchCategoryPage(category, cmcontinue);
    const members = data?.query?.categorymembers ?? [];
    for (const m of members) {
      if (!shouldSkip(m.title)) names.push(m.title);
    }
    cmcontinue = data?.continue?.cmcontinue ?? null;
    pages++;
    if (cmcontinue) await sleep(600);
  } while (cmcontinue && pages < 20); // safety cap: 20 pages × 500 = 10,000 per category

  return names;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  await fs.mkdir(path.dirname(OUT), { recursive: true });

  // Load existing roster if resuming
  let existing = new Set();
  try {
    existing = new Set(JSON.parse(await fs.readFile(OUT, 'utf8')));
    console.log(`Resuming: ${existing.size} players already in roster.json`);
  } catch {}

  const all = new Set(existing);

  for (const cat of CATEGORIES) {
    process.stdout.write(`  ${cat} ... `);
    try {
      const names = await fetchCategory(cat);
      const before = all.size;
      names.forEach(n => all.add(n));
      console.log(`${names.length} fetched, +${all.size - before} new (total: ${all.size})`);
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
    }
    await sleep(800); // polite pause between categories
  }

  const result = [...all].sort();
  await fs.writeFile(OUT, JSON.stringify(result, null, 2));
  console.log(`\nDone. ${result.length} unique player names saved to scripts/data/roster.json`);
}

main().catch(e => { console.error(e); process.exit(1); });
