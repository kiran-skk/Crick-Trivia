// Shared "Guess the Cricketer" game data — plain business logic, no styling.
// Each player has 8 progressive hints, ordered vague -> obvious.

export const PLAYERS = [
  {
    id: 'p1',
    name: 'Virat Kohli',
    photoId: 'kohli',
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
    id: 'p2',
    name: 'Ellyse Perry',
    photoId: 'perry',
    hints: [
      'Born in Sydney, Australia in 1990',
      'All-rounder: right-arm fast-medium bowler, right-hand bat',
      'Youngest to debut for Australia in both cricket and football (soccer)',
      'International debut for Australia in 2007, aged 16',
      'Franchise: Sydney Sixers in the WBBL',
      'Holder of the world record for best bowling figures in a WT20I match',
      'Named ICC Women\'s Cricketer of the Decade (2011-2020)',
      'Wears the baggy green cap number 227',
    ],
    fact: 'One of only a few athletes to represent their country in two different sports.',
  },
  {
    id: 'p3',
    name: 'Shane Warne',
    photoId: 'warne',
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
    id: 'p4',
    name: 'Jos Buttler',
    photoId: 'buttler',
    hints: [
      'Born in Somerset, England in 1990',
      'Wicketkeeper-batter known for explosive finishing',
      'ODI debut in 2012 vs West Indies',
      'Captained his national team to a T20 World Cup title in 2022',
      'Franchise: Rajasthan Royals in the IPL',
      'Invented a shot nicknamed after himself involving a ramp over the keeper',
      'Was England\'s vice-captain across multiple formats',
      'Scored the winning runs in the dramatic 2019 World Cup final',
    ],
    fact: 'Regarded as one of the most destructive white-ball finishers of his generation.',
  },
  {
    id: 'p5',
    name: 'Ben Stokes',
    photoId: 'stokes',
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
    id: 'p6',
    name: 'Suzie Bates',
    photoId: 'bates',
    hints: [
      'Born in Dunedin, New Zealand in 1987',
      'Right-handed opening batter and part-time bowler',
      'International debut in 2006',
      'Also played basketball for the New Zealand national team',
      'Franchise: Adelaide Strikers in the WBBL',
      'First women\'s cricketer to score 4,000 ODI runs',
      'Captained New Zealand across multiple World Cups',
      'Named a two-time ICC Women\'s ODI Cricketer of the Year',
    ],
    fact: 'A dual-sport international who became one of the most consistent openers in women\'s ODI cricket.',
  },
  {
    id: 'p7',
    name: 'Kane Williamson',
    photoId: 'williamson',
    hints: [
      'Born in Tauranga, New Zealand in 1990',
      'Right-handed batter known for calm, technically precise strokeplay',
      'Test debut in 2010 vs India',
      'Captained his national team to the inaugural World Test Championship title in 2021',
      'Franchise: Gujarat Titans in the IPL',
      'Holds his country\'s record for most international centuries',
      'Widely praised for a famously even-tempered demeanour on and off the field',
      'Runner-up finisher in both the 2015 and 2019 ODI World Cup finals',
    ],
    fact: 'Regarded as one of the "Fab Four" batters of his generation alongside Kohli, Root and Smith.',
  },
  {
    id: 'p8',
    name: 'Meg Lanning',
    photoId: 'lanning',
    hints: [
      'Born in Singapore, raised in Melbourne, Australia, in 1992',
      'Right-handed top-order batter',
      'International debut in 2010',
      'Captained her national team to five ICC Women\'s T20 World Cup titles',
      'Franchise: Delhi Capitals in the WPL',
      'Youngest cricketer, male or female, to reach 1,000 ODI runs at the time',
      'Retired from international cricket in 2023 as one of the most decorated captains ever',
      'Named ICC Women\'s ODI Player of the Decade shortlist honouree',
    ],
    fact: 'One of the most successful captains in the history of women\'s international cricket.',
  },
];

export function scoreForHintIndex(hintIndex) {
  // hintIndex: 0-based index of the hint that was showing when the guess was made
  const table = [800, 700, 600, 500, 400, 300, 200, 100];
  return table[Math.min(hintIndex, table.length - 1)];
}
