/**
 * Stage 3: Generate hints for each player and assemble game-data.js.
 * Reads:  scripts/data/enriched.json
 * Output: game-data.js (in repo root)
 *
 * Run:
 *   node scripts/3-build.mjs           # template-based hints (fast, free)
 *   node scripts/3-build.mjs --ai      # Claude-generated hints (better quality, ~$2 for 10k)
 *
 * Requires ANTHROPIC_API_KEY env var when --ai is used.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ENRICHED = path.join(__dir, 'data', 'enriched.json');
const OUT = path.join(__dir, '..', 'game-data.js');

const USE_AI = process.argv.includes('--ai');
const AI_BATCH = 5;   // players per Claude call
const AI_CONCURRENCY = 8; // simultaneous Claude calls

// ── Original 8 hand-crafted players (always at the top) ──────────────────

const ORIGINAL_PLAYERS = [
  {
    id: 'p1', name: 'Virat Kohli', photoId: 'kohli',
    hints: [
      'Born in Delhi, India in 1988',
      'Right-handed top-order batter',
      'Made ODI debut in 2008 vs Sri Lanka',
      'Captained his national team in all three formats',
      'Franchise: Royal Challengers Bengaluru (IPL) since 2008',
      'Holds the record for most ODI centuries all-time',
      'Nicknamed "King Kohli" by fans and pundits',
      'Married to a Bollywood actress in 2017',
    ],
    fact: 'Widely regarded as one of the greatest run-chasers in ODI history.',
  },
  {
    id: 'p2', name: 'Ellyse Perry', photoId: 'perry',
    hints: [
      'Born in Sydney, Australia in 1990',
      'All-rounder: right-arm fast-medium bowler, right-hand bat',
      'Youngest to debut for Australia in both cricket and football (soccer)',
      'International debut for Australia in 2007, aged 16',
      'Franchise: Sydney Sixers in the WBBL',
      'Holder of the world record for best bowling figures in a WT20I match',
      "Named ICC Women's Cricketer of the Decade (2011-2020)",
      'Wears the baggy green cap number 227',
    ],
    fact: 'One of only a few athletes to represent their country in two different sports.',
  },
  {
    id: 'p3', name: 'Shane Warne', photoId: 'warne',
    hints: [
      'Born in Victoria, Australia in 1969',
      'Leg-spin bowler renowned for prodigious turn',
      'Test debut in 1992 vs India',
      'Delivered the "Ball of the Century" in his first Ashes Test',
      'Took over 700 Test wickets in his career',
      'Captained the Rajasthan Royals to the inaugural IPL title in 2008',
      'Retired from international cricket in 2007',
      'Passed away in 2022, mourned across the cricketing world',
    ],
    fact: 'Considered by many the greatest spin bowler the game has ever seen.',
  },
  {
    id: 'p4', name: 'Jos Buttler', photoId: 'buttler',
    hints: [
      'Born in Somerset, England in 1990',
      'Wicketkeeper-batter known for explosive finishing',
      'ODI debut in 2012 vs West Indies',
      'Captained his national team to a T20 World Cup title in 2022',
      'Franchise: Rajasthan Royals in the IPL',
      'Invented a shot nicknamed after himself involving a ramp over the keeper',
      "Was England's vice-captain across multiple formats",
      'Scored the winning runs in the dramatic 2019 World Cup final',
    ],
    fact: 'Regarded as one of the most destructive white-ball finishers of his generation.',
  },
  {
    id: 'p5', name: 'Ben Stokes', photoId: 'stokes',
    hints: [
      'Born in Christchurch, New Zealand in 1991',
      'All-rounder: left-hand bat, right-arm fast-medium bowler',
      'Test debut in 2013 vs Australia',
      'Captained his national team to a Test series win over India in 2024',
      'Franchise: Chennai Super Kings in the IPL',
      'Struck an unbeaten 135 to win the 2019 World Cup final in a Super Over',
      'Also starred with the ball and bat in the epic 2019 Headingley Ashes Test',
      'Known for a fierce competitive streak dubbed "Stokes-mentality" by teammates',
    ],
    fact: 'Central figure in some of the most dramatic finishes in modern Test and ODI cricket.',
  },
  {
    id: 'p6', name: 'Suzie Bates', photoId: 'bates',
    hints: [
      'Born in Dunedin, New Zealand in 1987',
      'Right-handed opening batter and part-time bowler',
      'International debut in 2006',
      'Also played basketball for the New Zealand national team',
      'Franchise: Adelaide Strikers in the WBBL',
      "First women's cricketer to score 4,000 ODI runs",
      'Captained New Zealand across multiple World Cups',
      "Named a two-time ICC Women's ODI Cricketer of the Year",
    ],
    fact: "A dual-sport international who became one of the most consistent openers in women's ODI cricket.",
  },
  {
    id: 'p7', name: 'Kane Williamson', photoId: 'williamson',
    hints: [
      'Born in Tauranga, New Zealand in 1990',
      'Right-handed batter known for calm, technically precise strokeplay',
      'Test debut in 2010 vs India',
      'Captained his national team to the inaugural World Test Championship title in 2021',
      'Franchise: Gujarat Titans in the IPL',
      "Holds his country's record for most international centuries",
      'Widely praised for a famously even-tempered demeanour on and off the field',
      'Runner-up finisher in both the 2015 and 2019 ODI World Cup finals',
    ],
    fact: 'Regarded as one of the "Fab Four" batters of his generation alongside Kohli, Root and Smith.',
  },
  {
    id: 'p8', name: 'Meg Lanning', photoId: 'lanning',
    hints: [
      'Born in Singapore, raised in Melbourne, Australia, in 1992',
      'Right-handed top-order batter',
      'International debut in 2010',
      "Captained her national team to five ICC Women's T20 World Cup titles",
      'Franchise: Delhi Capitals in the WPL',
      'Youngest cricketer, male or female, to reach 1,000 ODI runs at the time',
      'Retired from international cricket in 2023 as one of the most decorated captains ever',
      "Named ICC Women's ODI Player of the Decade shortlist honouree",
    ],
    fact: "One of the most successful captains in the history of women's international cricket.",
  },
];

const ORIGINAL_NAMES = new Set(ORIGINAL_PLAYERS.map(p => p.name.toLowerCase()));

// ── Clean residual wikitext from enriched fields ─────────────────────────

function cleanField(s) {
  if (!s) return s;
  return s
    .replace(/\{\{ubl\|([^}]+)\}\}/gi, (_, c) => c.split('|').join(' / '))  // {{ubl|a|b}} → a / b
    .replace(/\{\{[^}]*\}\}/g, '')     // any remaining {{...}}
    .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1')  // [[link|text]]
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanPlayer(p) {
  return {
    ...p,
    batting: cleanField(p.batting),
    bowling: cleanField(p.bowling),
    role: cleanField(p.role),
    birthPlace: cleanField(p.birthPlace),
    clubs: p.clubs?.map(cleanField).filter(Boolean),
  };
}

// ── Template-based hint generation ────────────────────────────────────────

function pickFormat(stats) {
  if (!stats) return null;
  const order = ['Test', 'ODI', 'T20I', 'T20', 'First-class', 'List A'];
  for (const fmt of order) {
    if (stats[fmt]) return [fmt, stats[fmt]];
  }
  const entries = Object.entries(stats);
  return entries.length ? entries[0] : null;
}

function templateHints(rawPlayer) {
  const player = cleanPlayer(rawPlayer);
  const hints = [];

  // H1: birth (vague)
  if (player.birthYear && player.birthPlace) {
    hints.push(`Born in ${player.birthPlace} in ${player.birthYear}`);
  } else if (player.birthYear && player.country) {
    hints.push(`Born in ${player.country} in ${player.birthYear}`);
  } else if (player.country) {
    hints.push(`International cricketer representing ${player.country}`);
  } else {
    hints.push('A professional cricketer active at first-class level');
  }

  // H2: playing role
  const batting = player.batting ? `${player.batting} ` : '';
  const roleStr = player.role ?? 'cricketer';
  const bowlingStr = player.bowling ? `, ${player.bowling}` : '';
  hints.push(`${batting}${roleStr}${bowlingStr}`.trim());

  // H3: debut
  const debut = player.testDebut ?? player.odiDebut ?? player.t20iDebut;
  const fmt = player.testDebut ? 'Test' : player.odiDebut ? 'ODI' : 'T20I';
  if (debut?.year && debut?.vs) {
    hints.push(`Made ${fmt} debut in ${debut.year} against ${debut.vs}`);
  } else if (debut?.year) {
    hints.push(`Made ${fmt} debut in ${debut.year}`);
  } else if (debut?.vs) {
    hints.push(`Made ${fmt} debut against ${debut.vs}`);
  } else if (player.clubs?.length) {
    hints.push(`Plays first-class cricket for ${player.clubs[0]}`);
  } else {
    hints.push(`Plays for ${player.country ?? 'their national team'}`);
  }

  // H4: franchise / domestic team
  if (player.clubs?.length) {
    const list = player.clubs.slice(0, 2).join(' and ');
    hints.push(`Domestic career includes stints with ${list}`);
  } else {
    hints.push(`Has represented ${player.country ?? 'their country'} in international cricket`);
  }

  // H5: stats
  const primary = pickFormat(player.stats);
  if (primary) {
    const [fmtName, s] = primary;
    const m = s.matches ?? 0;
    const mWord = m === 1 ? 'match' : 'matches';
    if (m && s.runs != null && s.runs > 100) {
      hints.push(`Has scored ${s.runs.toLocaleString()} runs in ${m} ${fmtName} ${mWord}`);
    } else if (m && s.wickets != null && s.wickets > 10) {
      hints.push(`Has taken ${s.wickets} wickets in ${m} ${fmtName} ${mWord}`);
    } else if (m > 1) {
      hints.push(`Has played ${m} ${fmtName} ${mWord} in their career`);
    } else {
      hints.push(`Made their professional debut in ${fmtName} cricket`);
    }
  } else {
    hints.push(`Has represented their team across multiple formats`);
  }

  // H6–H8: drawn from intro text sentences
  const sentences = (player.introText ?? '')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 40 && !/^(This|The|It|They)\s/i.test(s));

  const used = new Set();
  const fillers = [
    `Known for their consistency and dedication to the sport`,
    `A respected figure in ${player.country ?? 'world'} cricket`,
    `Part of a talented generation of cricketers from their region`,
  ];
  let fillerIdx = 0;
  for (let i = 0; hints.length < 8; i++) {
    const s = sentences[i];
    if (s && !used.has(s)) {
      let h = s.slice(0, 120).trim();
      if (h.endsWith(',') || h.endsWith(' and')) h = h.replace(/[, and]+$/, '') + '…';
      hints.push(h);
      used.add(s);
    } else if (!s) {
      hints.push(fillers[fillerIdx++ % fillers.length]);
    }
  }

  return hints.slice(0, 8);
}

function templateFact(rawPlayer) {
  const player = cleanPlayer(rawPlayer);
  const primary = pickFormat(player.stats);
  if (primary) {
    const [fmt, s] = primary;
    if (s.runs > 5000) return `Has accumulated over ${s.runs.toLocaleString()} ${fmt} runs in an outstanding career.`;
    if (s.wickets > 100) return `A prolific wicket-taker with over ${s.wickets} ${fmt} wickets.`;
  }
  if (player.role?.includes('all-rounder')) return `A genuine all-rounder who contributes with both bat and ball.`;
  if (player.testDebut) return `A Test cricket specialist who has represented ${player.country ?? 'their country'} with distinction.`;
  return `One of ${player.country ?? 'their country'}'s notable cricketers at the professional level.`;
}

// ── AI-based hint generation (Claude claude-haiku-4-5-20251001) ──────────────────────────────────

async function aiHintsForBatch(players, anthropic) {
  const desc = players.map((p, i) => {
    const parts = [];
    if (p.country) parts.push(`Country: ${p.country}`);
    if (p.birthYear) parts.push(`Born: ${p.birthYear}${p.birthPlace ? ` in ${p.birthPlace}` : ''}`);
    if (p.batting || p.role) parts.push(`Role: ${[p.batting, p.role].filter(Boolean).join(' ')}`);
    if (p.bowling) parts.push(`Bowling: ${p.bowling}`);
    const d = p.testDebut ?? p.odiDebut ?? p.t20iDebut;
    if (d) {
      const fmt = p.testDebut ? 'Test' : p.odiDebut ? 'ODI' : 'T20I';
      parts.push(`${fmt} debut: ${d.year ?? '?'}${d.vs ? ` vs ${d.vs}` : ''}`);
    }
    if (p.clubs?.length) parts.push(`Teams: ${p.clubs.slice(0, 3).join(', ')}`);
    const pr = pickFormat(p.stats);
    if (pr) {
      const [fmt, s] = pr;
      const sp = [s.matches && `${s.matches} ${fmt} matches`, s.runs > 100 && `${s.runs} runs`, s.wickets > 10 && `${s.wickets} wickets`].filter(Boolean);
      if (sp.length) parts.push(`Stats: ${sp.join(', ')}`);
    }
    if (p.introText) parts.push(`Bio: ${p.introText.slice(0, 250)}`);
    return `${i + 1}. Name: ${p.name} | ${parts.join(' | ')}`;
  }).join('\n');

  const prompt = `Generate cricket trivia hints for ${players.length} cricketers. Return ONLY a JSON array, no extra text.

For each player create exactly 8 progressive hints (vague→obvious) + 1 notable fact.
Rules:
- Hint 1: birth year and city/country (most vague — do NOT reveal name)
- Hint 2: batting style and playing role
- Hint 3: international debut year and opponent (if available)
- Hint 4: domestic or franchise team(s)
- Hint 5: career stat (runs, wickets, or matches)
- Hint 6: notable achievement or record
- Hint 7: a personal or career detail that narrows it down
- Hint 8: most distinctive identifier (almost gives away the name, but still no name)
- NEVER include the player's name in any hint
- One short sentence per hint (max 100 chars)

Players:
${desc}

Return array of ${players.length} objects:
[{"hints":["h1","h2","h3","h4","h5","h6","h7","h8"],"fact":"one sentence fact"},...]`;

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content[0].text.trim();
  const jsonMatch = text.match(/\[[\s\S]+\]/);
  if (!jsonMatch) throw new Error(`No JSON in AI response: ${text.slice(0, 200)}`);
  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed) || parsed.length !== players.length) {
    throw new Error(`Expected ${players.length} items, got ${parsed.length}`);
  }
  return parsed;
}

async function runWithConcurrency(tasks, limit) {
  const results = new Array(tasks.length);
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const enriched = JSON.parse(await fs.readFile(ENRICHED, 'utf8'));
  console.log(`Loaded ${enriched.length} enriched players.`);

  // Skip players already in the original 8
  const candidates = enriched.filter(p => !ORIGINAL_NAMES.has(p.name.toLowerCase()));
  console.log(`${candidates.length} candidates after excluding the original 8.`);

  let generated;

  if (USE_AI) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic();
    console.log(`Generating AI hints for ${candidates.length} players (${Math.ceil(candidates.length / AI_BATCH)} Claude calls)...`);

    const batches = [];
    for (let i = 0; i < candidates.length; i += AI_BATCH) {
      batches.push(candidates.slice(i, i + AI_BATCH));
    }

    let done = 0;
    const tasks = batches.map(batch => async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await aiHintsForBatch(batch, anthropic);
          done += batch.length;
          process.stdout.write(`\r  ${done}/${candidates.length} players`);
          return batch.map((p, i) => ({ player: p, ...result[i] }));
        } catch (e) {
          if (attempt === 2) throw e;
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    });

    const batchResults = await runWithConcurrency(tasks, AI_CONCURRENCY);
    generated = batchResults.flat();
    console.log('\n');
  } else {
    console.log(`Generating template hints for ${candidates.length} players...`);
    generated = candidates.map(p => ({
      player: p,
      hints: templateHints(p),
      fact: templateFact(p),
    }));
  }

  // Assemble final player list
  let idCounter = 9;
  const newPlayers = generated.map(({ player, hints, fact }) => ({
    id: `p${idCounter++}`,
    name: player.name,
    photoId: player.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    hints: (hints ?? []).slice(0, 8).map(h => String(h).replace(/'/g, "'")),
    fact: String(fact ?? templateFact(player)).replace(/'/g, "'"),
  }));

  const allPlayers = [...ORIGINAL_PLAYERS, ...newPlayers];
  console.log(`Total players: ${allPlayers.length}`);

  // Serialize to JS
  // Final wikitext sanitization — strip any remaining {{ }} fragments from every string
  function sanitize(s) {
    return String(s ?? '')
      .replace(/\{\{ubl\|([^}]*)/gi, (_, c) => c.split('|').filter(Boolean).join(' / '))
      .replace(/\{\{[^}]*\}?\}?/g, '')
      .replace(/\[\[[^\]]*\|?([^\]]*)\]\]/g, '$1')
      .replace(/\[https?:[^\]]+\]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  allPlayers.forEach(p => {
    p.hints = p.hints.map(sanitize);
    p.fact = sanitize(p.fact);
  });

  const jsContent = `// Shared "Guess the Cricketer" game data — plain business logic, no styling.
// Each player has 8 progressive hints, ordered vague -> obvious.
// Auto-generated: ${new Date().toISOString().split('T')[0]} — ${allPlayers.length} players total.

export const PLAYERS = ${JSON.stringify(allPlayers, null, 2)};

export function scoreForHintIndex(hintIndex) {
  // hintIndex: 0-based index of the hint that was showing when the guess was made
  const table = [800, 700, 600, 500, 400, 300, 200, 100];
  return table[Math.min(hintIndex, table.length - 1)];
}
`;

  await fs.writeFile(OUT, jsContent);
  console.log(`game-data.js written with ${allPlayers.length} players.`);
}

main().catch(e => { console.error(e); process.exit(1); });
