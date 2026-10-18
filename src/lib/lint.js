// @ts-nocheck
/* The prose linter, copied as is from author-business System/Tools/sf.js (the lint section, with U.wordCount, U.sum,
 * U.mean, U.stdev and U.escRe; Prose comes from prose.js), so the writing screen's Check finds the same AI-sounding
 * phrases and gives the same score as `sf lint`. Do not edit it here: change sf.js, then copy again with
 * `npm run sync-parser`. tests/lintcheck.test.ts checks the copy when the vault is checked out beside this repository. */
import { Prose } from './prose.js';

const U = (() => {
  function wordCount(text) {
    const m = String(text || '').match(/[A-Za-z0-9À-ɏЀ-ӿ]+(?:['’\-][A-Za-z0-9À-ɏ]+)*/g);
    return m ? m.length : 0;
  }
  const sum = (arr) => arr.reduce((a, b) => a + (b || 0), 0);
  const mean = (arr) => (arr.length ? sum(arr) / arr.length : 0);
  function stdev(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(sum(arr.map((x) => (x - m) * (x - m))) / (arr.length - 1));
  }
  const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { wordCount, sum, mean, stdev, escRe };
})();

export const Lint = (() => {
  const P = '(?:he|she|i|they|we|you)';
  const POSS = '(?:his|her|my|their|our|your)';
  const R = (id, cat, sev, re, msg, fix) => ({ id, cat, sev, re, msg, fix: fix || '' });

  const RULES = [
    // AI vocabulary
    R('vocab.delve', 'AI vocabulary', 3, /\bdelv(?:e|es|ed|ing)\b/gi, '"Delve" is one of the most over-produced AI words.', 'Use the plain verb: dig, look into, search.'),
    R('vocab.tapestry', 'AI vocabulary', 3, /\btapestr(?:y|ies)\b(?! (?:hung|hangs|on the wall|frame|weaver|loom))/gi, '"Tapestry" used as a metaphor is a top AI tell.', 'Name the actual things that are woven together.'),
    R('vocab.testament', 'AI vocabulary', 3, /\b(?:a|the) (?:living |silent |quiet )?testament to\b/gi, '"A testament to" is boilerplate.', 'Show the evidence instead of announcing it.'),
    R('vocab.symphony', 'AI vocabulary', 2, /\b(?:a|the) (?:symphony|cacophony|kaleidoscope|mosaic|tableau) of\b/gi, 'Ornamental collective noun ("a symphony of...").', 'Pick the one sound or image that matters.'),
    R('vocab.dance', 'AI vocabulary', 2, /\ba (?:delicate |intricate |careful |strange |silent )?dance of\b/gi, '"A dance of..." is an ornamental cliché.', 'Describe the actual movement or exchange.'),
    R('vocab.palpable', 'AI vocabulary', 2, /\bpalpabl[ey]\b/gi, '"Palpable" is an AI favourite for tension and silence.', 'Show what makes the tension felt.'),
    R('vocab.unspoken', 'AI vocabulary', 2, /\bunspoken (?:words?|tension|understanding|promise|question|agreement|truth|thing)\b/gi, '"Unspoken X" tells the reader about subtext instead of creating it.', 'Write the scene so the reader feels what is not said.'),
    R('vocab.electric', 'AI vocabulary', 2, /\b(?:the air (?:was |felt )?electric|electric (?:silence|tension|touch|current|charge)|air (?:crackled|hummed|thrummed))\b/gi, 'Charged-air cliché.', 'Use a physical, specific cue.'),
    R('vocab.ministrations', 'AI vocabulary', 3, /\bministrations\b/gi, '"Ministrations" is a notorious machine-romance word.', 'Say what the hands are actually doing.'),
    R('vocab.orbs', 'AI vocabulary', 3, new RegExp('\\b' + POSS + ' (?:\\w+ )?orbs\\b', 'gi'), 'Eyes as "orbs".', 'Just say eyes, or nothing.'),
    R('vocab.reminder', 'AI vocabulary', 2, /\b(?:a|an) (?:stark|poignant|powerful|sobering|grim|bitter|painful|constant|gentle|vivid|haunting|harsh|cruel) reminder\b/gi, '"A stark reminder" is boilerplate.', 'Let the image remind the reader on its own.'),
    R('vocab.beacon', 'AI vocabulary', 2, /\b(?:a|the) beacon of (?:hope|light|warmth|safety)\b/gi, '"Beacon of hope" cliché.'),
    R('vocab.journey', 'AI vocabulary', 2, /\bembark(?:ed|ing|s)? on (?:a|this|the|their|his|her) (?:\w+ )?journey\b/gi, '"Embark on a journey".', 'Name the actual trip or task.'),
    R('vocab.navigate', 'AI vocabulary', 2, /\bnavigat(?:e|ed|ing) the (?:complexities|treacherous|labyrinth|murky|choppy|delicate)\b/gi, 'Corporate "navigate" metaphor.'),
    R('vocab.myriad', 'AI vocabulary', 1, /\b(?:a )?myriad(?: of)?\b/gi, '"Myriad" is over-produced.', 'Give a number or a concrete list.'),
    R('vocab.intricate', 'AI vocabulary', 1, /\b(?:intricate(?:ly)?|multifaceted|meticulous(?:ly)?|ethereal|otherworldly|visceral|indelible|inexorabl[ey])\b/gi, 'AI-favoured descriptor.', 'Check it earns its place; specifics beat adjectives.'),
    R('vocab.ozone', 'AI vocabulary', 1, /\b(?:smell(?:ed|s)? of|scent of|tang of|taste of) ozone\b/gi, '"Smelled of ozone" is an AI stock image.'),
    R('vocab.weight', 'AI vocabulary', 2, new RegExp('\\bthe (?:full |crushing |sheer )?weight of (?:it all|everything|(?:(?:the|' + POSS + '|those|that|this|all|his|her) )?(?:unspoken |unsaid |old |new |)(?:words?|world|gaze|stare|decision|silence|loss|grief|responsibility|years|memor(?:y|ies)|history|secrets?|truth|moment|expectations?|guilt|shame|sorrow|regret|command|leadership|crown|past|future|choice|knowledge|question))\\b', 'gi'), '"The weight of..." is a top machine-prose image.', 'What is physically heavy? Show it once, concretely.'),
    R('vocab.mixture', 'AI vocabulary', 1, /\b(?:a (?:mix|mixture|blend|cocktail) of \w+ and \w+|smell(?:ed|s)? of \w+ and \w+)\b/gi, 'The "X and Y" sensory pairing is an AI habit.', 'One precise smell is stronger than two vague ones.'),

    // stock body language and emotion
    R('stock.breath-held', 'Stock phrase', 3, new RegExp('\\b(?:let out|released|exhaled) a breath ' + P + ' (?:didn\'t|did not|hadn\'t|had not) (?:know|realize|realise) ' + P + ' (?:was|were|had been) holding\\b', 'gi'), 'The most notorious stock phrase in fiction.', 'Cut it, or show the release in a fresh physical way.'),
    R('stock.shiver', 'Stock phrase', 3, new RegExp('\\b(?:shivers?|chills?|a jolt|jolts|a thrill|tingles?) (?:ran|raced|crept|went|shot|traveled|travelled|skittered) (?:down|up|through|along) ' + POSS + ' (?:spine|back|arms?|body)\\b|\\bsen(?:t|ding|ds) (?:a )?(?:shivers?|chills?|jolts?|a jolt|a thrill) (?:down|up|through)', 'gi'), 'Shiver-down-the-spine cliché.'),
    R('stock.breath-hitched', 'Stock phrase', 2, new RegExp('\\b' + POSS + ' breath (?:hitched|caught|stuttered|stilled)\\b', 'gi'), 'Breath hitched or caught.'),
    R('stock.shaky-breath', 'Stock phrase', 2, /\b(?:released|let out|drew|took|exhaled) a (?:shaky|ragged|shuddering|trembling|steadying|deep|long) breath\b/gi, 'Stock breathing beat.'),
    R('stock.jaw', 'Stock phrase', 2, new RegExp('\\b(?:' + POSS + ' )?jaws? (?:clenched|tightened|set|hardened|worked)\\b|\\bclench(?:ed|ing) ' + POSS + ' jaw\\b', 'gi'), 'Jaw-clenching beat.'),
    R('stock.heart', 'Stock phrase', 2, new RegExp('\\b' + POSS + ' (?:heart|pulse) (?:pounded|hammered|raced|thundered|skipped a beat|leapt|leaped|lurched|stuttered|fluttered|did a little)\\b', 'gi'), 'Pounding-heart beat.', 'Find the body detail only this character would notice.'),
    R('stock.stomach', 'Stock phrase', 2, new RegExp('\\b' + POSS + ' (?:stomach|gut) (?:churned|knotted|dropped|twisted|lurched|flipped|clenched|tightened)\\b', 'gi'), 'Stomach-churning beat.'),
    R('stock.blood-cold', 'Stock phrase', 3, new RegExp('\\b(?:' + POSS + ' )?blood (?:ran|went|turned) cold\\b|\\bblood (?:froze|turned to ice)\\b', 'gi'), 'Blood-ran-cold cliché.'),
    R('stock.swallowed', 'Stock phrase', 2, /\bswallow(?:ed|s)? (?:hard|thickly|past the lump)\b|\ba lump (?:formed )?in (?:his|her|my|their) throat\b/gi, 'Swallowed hard, or a lump in the throat.'),
    R('stock.smile-tug', 'Stock phrase', 3, /\b(?:a|the) (?:small |slow |wry |sad |soft |faint |thin |tight |knowing |lopsided |rueful |crooked |tiny )?(?:smile|grin|smirk) (?:tugg?ed|played|curved|crept|spread|danced|twitched|ghosted|flickered|pulled) (?:at|on|across|over)\b/gi, 'Smile tugging at the lips.'),
    R('stock.mouth-corner', 'Stock phrase', 2, new RegExp('\\bthe corners? of ' + POSS + ' (?:mouth|lips) (?:twitched|tugged|curled|quirked|lifted|turned up|ticked up)\\b', 'gi'), 'Corner-of-the-mouth beat.'),
    R('stock.ghost-smile', 'Stock phrase', 2, /\b(?:the )?(?:ghost|whisper|hint|flicker) of a (?:smile|laugh|grin|frown)\b/gi, '"The ghost of a smile".'),
    R('stock.eyes', 'Stock phrase', 1, new RegExp('\\b' + POSS + ' (?:eyes|gaze) (?:widened|narrowed|softened|hardened|darkened|sparkled|glinted|glistened|twinkled|flashed|flickered|bored into)\\b', 'gi'), 'Expressive-eyes beat (fine once; a tic in clusters).'),
    R('stock.whisper-voice', 'Stock phrase', 3, /\b(?:voice|words?|it) (?:was |came out )?(?:barely|scarcely|little more than|no more than|hardly) (?:above |more than )?a whisper\b/gi, '"Barely above a whisper".'),
    R('stock.steel-voice', 'Stock phrase', 2, new RegExp('\\b(?:steel|iron|ice|an edge) (?:in|to|entered) ' + POSS + ' voice\\b', 'gi'), 'Steel-in-her-voice cliché.'),
    R('stock.beat', 'Stock phrase', 2, /(?:^|[.!?]\s+)A beat\.|\ba beat (?:passed|of silence)\b/g, 'Screenplay "a beat" in prose.', 'Show what happens in the pause, or cut it.'),
    R('stock.silence', 'Stock phrase', 2, /\b(?:the )?silence (?:stretched|hung|thickened|settled|lingered|pressed|grew|swelled|was deafening)\b|\bdeafening silence\b|\b(?:hung|hanging|hangs) (?:heavy )?in the air\b|\bhung between (?:them|us)\b/gi, 'Stock silence or air beat.'),
    R('stock.air-thick', 'Stock phrase', 2, /\bthe air (?:was |grew |felt |hung )?(?:thick|heavy|charged|dense|pregnant|alive) with\b/gi, '"The air was thick with...".'),
    R('stock.time-slowed', 'Stock phrase', 2, /\btime (?:seemed to )?(?:slow(?:ed)?|stood still|stopped|stretched)\b|\bthe world (?:seemed to )?(?:narrowed|tilted|fell away|stopped|spun|shrank)\b/gi, 'Time-slowed or world-narrowed beat.'),
    R('stock.wave', 'Stock phrase', 2, /\ba (?:fresh )?(?:wave|surge|rush|flood|wash) of (?:relief|nausea|guilt|exhaustion|panic|fear|grief|emotion|warmth|dizziness|sadness|shame|anger|longing|tenderness)\b|\bwashed over (?:him|her|me|them|us)\b/gi, 'Wave-of-emotion beat.', 'Emotions do not need weather; show the behaviour.'),
    R('stock.flicker', 'Stock phrase', 2, /\ba (?:flicker|flash|glimmer|spark|pang|twinge|stab) of (?:hope|fear|recognition|something|amusement|doubt|guilt|emotion|regret|sadness|annoyance|irritation|pain|jealousy|unease|surprise)\b/gi, '"A flicker of [emotion]".'),
    R('stock.something-shifted', 'Stock phrase', 3, /\bsomething (?:shifted|changed|broke|cracked|stirred|settled|loosened|unlocked|unknotted|tightened|flickered|passed) (?:in|inside|within|between|across|behind|beneath)\b/gi, '"Something shifted" is a known Claude tic.', 'Name what changed, in behaviour.'),
    R('stock.couldnt-help', 'Stock phrase', 2, /\bcould(?:n't| not) help but\b/gi, '"Couldn\'t help but" is a known model tic.', 'Just have them do it.'),
    R('stock.sense-of', 'Stock phrase', 1, /\ba (?:deep |strange |profound |growing |sudden |sinking |overwhelming )?sense of\b(?! (?:humou?r|direction|smell|taste|touch|hearing|proportion|place|occasion|time|style|fashion|fairness|duty|decency)\b)/gi, '"A sense of..." abstracts a feeling.'),
    R('stock.little-did', 'Stock phrase', 3, new RegExp('\\blittle did ' + P + ' know\\b', 'gi'), '"Little did she know".'),
    R('stock.maybe-just-maybe', 'Stock phrase', 3, /\bmaybe,? just maybe\b/gi, '"Maybe, just maybe".'),
    R('stock.pregnant-pause', 'Stock phrase', 3, /\bpregnant (?:pause|silence)\b|\bcalm before the storm\b/gi, 'Dead metaphor.'),
    R('stock.in-that-moment', 'Stock phrase', 1, /\b(?:in that (?:moment|instant)|for the first time in (?:years|forever|a long time|(?:his|her|my|their) (?:life|lives)))\b/gi, 'Signpost phrase; usually removable.'),
    R('stock.hair-hand', 'Stock phrase', 1, new RegExp('\\b(?:ran|runs|running|raked|rakes|dragged) (?:a hand|' + POSS + ' (?:hand|hands|fingers)) through ' + POSS + ' hair\\b', 'gi'), 'Hand-through-hair beat.'),
    R('stock.knuckles', 'Stock phrase', 1, /\bknuckles (?:turned|went|were|whitened|white)\b|\bwhite-knuckled\b/gi, 'White-knuckle beat.'),
    R('stock.padded', 'Stock phrase', 1, /\bpadd(?:ed|ing) (?:across|down|into|to|over|back)\b/gi, '"Padded" across the room is an AI favourite.'),

    // constructions
    R('con.negative-parallel', 'Construction', 2, /\b(?:it|this|that|he|she|they)(?:'s| is| was|'re| are| were) ?n(?:o|')t (?:just |only |merely |simply |about )?[^.!?\n]{1,60}?[,;—–-]+\s*(?:it|this|that|he|she|they)(?:'s| is| was|'re| are| were)\b/gi, 'Negative parallelism ("It wasn\'t X, it was Y") is the top structural AI tell.', 'State what it is. Drop the strawman.'),
    R('con.negative-parallel-2', 'Construction', 2, /\b(?:It|This|That) (?:wasn't|isn't|was not|is not) [^.!?\n]{1,80}[.!?]\s+(?:It|This|That) (?:was|is)\b/g, 'Negative parallelism across two sentences.'),
    R('con.not-just', 'Construction', 2, /\bnot (?:just|only|merely|simply) [^,.;!?\n]{1,40}(?:,|—|;)\s*but\b/gi, '"Not just X, but Y".'),
    R('con.not-stack', 'Construction', 2, /\bNot [^.!?\n]{1,40}\.\s+Not [^.!?\n]{1,40}\./g, 'Stacked negations ("Not X. Not Y.").'),
    R('con.copula', 'Construction', 1, /\b(?:serves?|served|serving|stands?|stood) as (?:a|an|the) (?:reminder|testament|symbol|sign|beacon|warning|monument|metaphor)\b/gi, 'Copula avoidance ("served as a reminder").', 'Use "is", or let the image work alone.'),
    R('con.trailing-participle', 'Construction', 2, /,\s(?:highlighting|underscoring|emphasi[sz]ing|showcasing|reflecting|signall?ing|symboli[sz]ing|reminding (?:him|her|them|me|us) of)\b/gi, 'Trailing "-ing" commentary clause.', 'Cut it; the sentence already showed it.'),
    R('con.rhetorical-q', 'Construction', 2, /\bThe (?:result|answer|truth|problem|catch|kicker|best part|worst part|irony|reason|twist)\?/g, 'Self-posed rhetorical question.'),
    R('con.something-about', 'Construction', 1, /\bsomething about (?:him|her|it|them|the way|this|that|the)\b/gi, '"Something about..." vagueness.', 'Say what, exactly.'),

    // telling, filters, hedges
    R('tell.named-emotion', 'Telling', 1, /\b(?:he|she|i|they|we|[a-z]+) (?:was|were|felt|seemed|looked|grew|became) (?:so |very |incredibly |deeply |utterly |suddenly |completely |truly )?(?:angry|sad|happy|nervous|scared|terrified|furious|anxious|excited|jealous|confused|embarrassed|frustrated|overwhelmed|devastated|elated|ashamed|guilty|lonely|heartbroken|relieved|annoyed|irritated|afraid|worried|hopeful|grateful)\b/gi, 'Named emotion. Fine sometimes; check whether the scene should show it.'),
    R('filter.verbs', 'Filter word', 1, new RegExp('\\b' + P + ' (?:felt|saw|heard|noticed|realized|realised|watched|wondered|knew|smelled|tasted|could (?:see|hear|feel|smell|taste))\\b', 'gi'), 'Filter verb puts glass between reader and experience.', 'Show the thing perceived, not the perceiving.'),
    R('filler.began-to', 'Filler', 1, /\b(?:began|begins|beginning|started|starts|starting) to\b/gi, '"Began to" usually delays the verb.'),
    R('filler.suddenly', 'Filler', 1, /\b(?:suddenly|all of a sudden|out of nowhere)\b/gi, '"Suddenly" announces surprise instead of creating it.'),

    // dialogue
    R('dlg.tag-adverb', 'Dialogue', 1, /\b(?:said|asked|replied|whispered|muttered|murmured|answered|called|shouted|snapped|added)\s+(?!only|early|family|reply|ugly|holy|belly|rally|bully)(\w{3,}ly)\b/gi, 'Adverb on a dialogue tag.', 'Let the line carry the tone.'),
    R('dlg.action-tag', 'Dialogue', 1, /["”],?\s+(?:he|she|they|i|[A-Z][a-z]+)\s+(?:hissed|growled|purred|breathed|chuckled|laughed|smiled|sighed|grinned|snarled|husked|rasped|smirked)\b/g, 'Non-speech verb used as a speech tag.', 'Use "said" or a separate action beat.'),

    // setting and names
    R('set.stock-setting', 'Stock setting', 1, /\b(?:bustling (?:market(?:place)?|city|streets?|tavern|port)|dimly[- ]lit (?:tavern|room|corridor|alley|bar|hallway)|ancient (?:courtyard|tome|runes)|cobblestoned? streets?|labyrinthine (?:streets|corridors|alleys))\b/gi, 'Mode-collapse setting.', 'Give it one detail no other book has.'),
    R('name.ai-default', 'Default name', 1, /\b(?:Elara|Lyra|Kael|Kaelen|Seraphina|Zephyr|Thorne|Voss|Elowen|Liora|Caelan|Aurelia|Lysander|Isolde|Vesper|Seraphine|Evangeline|Aria Blackwood|Sarah Chen|Marcus Chen|Dr\. Chen)\b/g, 'A name language models reach for by default.', 'Fine if chosen on purpose; otherwise pick a name with roots in the character\'s world.')
  ];

  const ENDING_RE = /(?:would never be the same|nothing would ever be the same|everything had changed|(?:was|is) only the beginning|(?:was|is) just the beginning|and (?:that|it) was enough|for now,? (?:that|it) was enough|somehow,? (?:she|he|they|I) knew|(?:the )?(?:real )?(?:work|journey|story|fight) (?:was |had )?(?:only )?just (?:beginning|begun)|for the first time in (?:a long time|years))/i;

  const STOP = ('a about above after again against all am an and any are as at be because been before being below between both but by ' +
    'could did do does doing down during each few for from further had has have having he her here hers herself him himself his how ' +
    'i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own ' +
    'same she should so some such than that the their theirs them themselves then there these they this those through to too under until up ' +
    'very was we were what when where which while who whom why will with would you your yours yourself yourselves said says say like back ' +
    'one two still even then than into onto upon around again away yes no oh okay ok got get gets go goes went gone come came comes know knew ' +
    'think thought see saw look looked looking want wanted make made way thing things something nothing anything everything time maybe ' +
    'there\'s it\'s don\'t didn\'t i\'m you\'re can\'t wasn\'t couldn\'t wouldn\'t that\'s he\'s she\'s we\'re they\'re i\'d i\'ll ' +
    'let us across behind toward towards through while because must might can will shall may also another every each other much many ' +
    'little long last first next own right left new old good well off already enough almost always never ever only both either neither ' +
    'though although yet once twice here hand hands head eyes face door room voice day night man woman people').split(/\s+/);
  const STOPSET = new Set(STOP);

  const LY_SKIP = /^(only|early|family|reply|ugly|holy|belly|rally|bully|daily|likely|lonely|lovely|friendly|elderly|silly|jelly|fly|ally|july|italy|lily|supply|apply|imply|rely|curly|chilly|hilly|oily|wily|surly|burly|holly|jolly|sully|melancholy|anomaly|assembly|homily|monopoly|unlikely|costly|deadly|ghostly|kindly|lively|lowly|orderly|sickly|smelly|worldly|weekly|monthly|yearly|hourly|nightly|bodily|comely|courtly|cowardly|gangly|ghastly|grisly|heavenly|leisurely|manly|measly|motherly|fatherly|neighborly|portly|princely|scholarly|sprightly|stately|timely|unruly|wobbly|wrinkly)$/i;

  // Expected rate per 10,000 words in published fiction (rough, conservative) for words model prose inflates.
  const WATCH = {
    sharp: 2.5, sharply: 0.8, edge: 2, edges: 1, gaze: 1.5, whisper: 1.5, whispered: 3, murmured: 1, murmur: 0.6,
    shadow: 1.5, shadows: 2, glint: 0.4, gleam: 0.5, flicker: 0.4, flickered: 0.5, hum: 0.5, hummed: 0.4, ache: 0.6, ached: 0.4,
    trembling: 0.8, trembled: 0.6, echo: 0.6, echoed: 0.6, lingered: 0.7, linger: 0.4, weight: 1.5, breath: 4, pulse: 0.8,
    warmth: 0.8, smirk: 0.2, smirked: 0.2, steady: 1.2, steadied: 0.3, quiet: 4, quietly: 2, softly: 2, soft: 3, gentle: 1.2,
    gently: 1.5, faint: 1, faintly: 0.4, hollow: 0.5, raw: 0.6, tension: 0.4, resolve: 0.3, crimson: 0.3, velvet: 0.3,
    velvety: 0.05, honeyed: 0.05, impossibly: 0.1, somehow: 2, testament: 0.05, tapestry: 0.05, ozone: 0.03, palpable: 0.05,
    jaw: 1.2, throat: 2, spine: 0.6, chest: 3, fingers: 4, thrum: 0.05, thrummed: 0.05, inexorable: 0.03, unspoken: 0.1,
    precisely: 0.4, carefully: 1.2, measured: 0.3, deliberate: 0.3, deliberately: 0.3, settled: 1.5, shifted: 1.2, rhythm: 0.4
  };

  function compileExtra(phrases) {
    return (phrases || []).filter(Boolean).map((p, i) => {
      const esc = U.escRe(p).replace(/\s+/g, '\\s+');
      return R('custom.' + i, 'House list', 2, new RegExp('\\b' + esc + '\\b', 'gi'), '"' + p + '" is on this book\'s banned list.');
    });
  }

  function inQuotes(text, idx) {
    const paraStart = text.lastIndexOf('\n\n', idx);
    const seg = text.slice(paraStart < 0 ? 0 : paraStart, idx);
    const straight = (seg.match(/"/g) || []).length;
    const open = (seg.match(/“/g) || []).length, close = (seg.match(/”/g) || []).length;
    return (straight % 2 === 1) || open > close;
  }

  function dialogueChars(text) {
    let n = 0, m;
    const re = /"[^"\n]*"|“[^”\n]*”/g;
    while ((m = re.exec(text)) !== null) n += m[0].length;
    return n;
  }

  function syllables(word) {
    let w = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return 0;
    if (w.length <= 3) return 1;
    w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
    const m = w.match(/[aeiouy]{1,2}/g);
    return Math.max(1, m ? m.length : 1);
  }

  const adverbCount = (text) => (text.match(/\b[A-Za-z]{3,}ly\b/g) || []).filter((w) => !LY_SKIP.test(w)).length;

  function run(text, opts) {
    opts = opts || {};
    text = String(text || '');
    const disabled = new Set((opts.disable || []).map((d) => String(d).toLowerCase()));
    const rules = RULES.concat(compileExtra(opts.extraPhrases));
    const issues = [];

    rules.forEach((rule) => {
      if (disabled.has(rule.id) || disabled.has(rule.cat.toLowerCase())) return;
      const re = new RegExp(rule.re.source, rule.re.flags.indexOf('g') >= 0 ? rule.re.flags : rule.re.flags + 'g');
      let m, guard = 0;
      while ((m = re.exec(text)) !== null && guard++ < 5000) {
        if (m[0].length === 0) { re.lastIndex++; continue; }
        let start = m.index, t = m[0];
        if (rule.id === 'stock.beat' && /^[.!?]\s+/.test(t)) { const off = t.match(/^[.!?]\s+/)[0].length; start += off; t = t.slice(off); }
        issues.push({ rule: rule.id, cat: rule.cat, sev: rule.sev, start, end: start + t.length, text: t, msg: rule.msg, fix: rule.fix });
      }
    });

    const words = U.wordCount(text);
    const per1k = (n) => (words ? n * 1000 / words : 0);
    const sents = Prose.sentences(text);
    const lens = sents.map((s) => U.wordCount(s.text)).filter((n) => n > 0);
    const meanLen = U.mean(lens), sdLen = U.stdev(lens);
    const cv = meanLen ? sdLen / meanLen : 0;
    const paras = Prose.paragraphs(text);

    // em dashes against the Style Guide limit
    const dashes = [];
    let m2;
    const reDash = /—|\s--\s/g;
    while ((m2 = reDash.exec(text)) !== null) dashes.push({ start: m2.index, end: m2.index + m2[0].length });
    const emMax = opts.emdashMax != null ? opts.emdashMax : 4;
    if (!disabled.has('punct.emdash') && per1k(dashes.length) > emMax) {
      dashes.forEach((d) => {
        issues.push({ rule: 'punct.emdash', cat: 'Punctuation', sev: 2, start: d.start, end: d.end, text: text.slice(d.start, d.end),
          msg: 'Em dashes run at ' + per1k(dashes.length).toFixed(1) + ' per 1,000 words; the limit is ' + emMax + '.',
          fix: 'Most can become a comma, colon, full stop, or nothing.' });
      });
    }
    const ell = (text.match(/…|\.\.\./g) || []).length;
    let excl = 0, m3;
    const reEx = /!/g;
    while ((m3 = reEx.exec(text)) !== null) if (!inQuotes(text, m3.index)) excl++;

    // rhythm: runs of nearly identical sentence lengths
    if (!disabled.has('rhythm.monotone')) {
      let run0 = 0;
      for (let i = 1; i <= sents.length; i++) {
        const same = i < sents.length && Math.abs(U.wordCount(sents[i].text) - U.wordCount(sents[i - 1].text)) <= 3 && U.wordCount(sents[i].text) >= 6;
        if (same) { run0++; continue; }
        if (run0 >= 4) {
          const a = sents[i - 1 - run0], b = sents[i - 1];
          issues.push({ rule: 'rhythm.monotone', cat: 'Rhythm', sev: 2, start: a.start, end: b.end, text: text.slice(a.start, Math.min(b.end, a.start + 80)) + '…',
            msg: (run0 + 1) + ' sentences in a row of nearly the same length.', fix: 'Vary it: a fragment, a long periodic sentence, a question.' });
        }
        run0 = 0;
      }
    }

    // the same opening word three or more times in a row
    if (!disabled.has('rhythm.openers')) {
      let streak = 1;
      for (let k = 1; k <= sents.length; k++) {
        const w0 = k < sents.length ? (sents[k].text.match(/^["“‘']?([A-Za-z']+)/) || [])[1] : null;
        const w1 = (sents[k - 1].text.match(/^["“‘']?([A-Za-z']+)/) || [])[1];
        if (w0 && w1 && w0.toLowerCase() === w1.toLowerCase() && !/^(and|but)$/i.test(w0)) { streak++; continue; }
        if (streak >= 3) {
          const first = sents[k - streak];
          issues.push({ rule: 'rhythm.openers', cat: 'Rhythm', sev: 2, start: first.start, end: sents[k - 1].end,
            text: streak + ' × "' + w1 + '"', msg: streak + ' sentences in a row start with "' + w1 + '".', fix: '' });
        }
        streak = 1;
      }
    }

    // one-line paragraphs outside dialogue
    const narrParas = paras.filter((p) => !/^\s*["“]/.test(p.text));
    const oneLiners = narrParas.filter((p) => Prose.sentences(p.text).length <= 1 && U.wordCount(p.text) < 25);
    const oneLineRatio = narrParas.length ? oneLiners.length / narrParas.length : 0;
    if (!disabled.has('rhythm.fragments') && narrParas.length >= 6 && oneLineRatio > 0.35) {
      oneLiners.forEach((p) => {
        issues.push({ rule: 'rhythm.fragments', cat: 'Rhythm', sev: 1, start: p.start, end: p.end, text: p.text.trim().slice(0, 60),
          msg: Math.round(oneLineRatio * 100) + '% of narrative paragraphs are a single short line. Dramatic fragments lose force when constant.', fix: '' });
      });
    }

    // throat-clearing paragraph openers
    paras.forEach((p) => {
      const mm = p.text.match(/^\s*(In the (?:dim|pale|soft|golden|flickering|fading|gr[ae]y|amber|silver|cold|harsh|early|late) (?:light|glow|haze|dawn|dusk)|As the (?:sun|moon|night|day|dawn|evening) (?:rose|set|fell|broke|crept|wore on))/);
      if (mm) issues.push({ rule: 'con.throat-clearing', cat: 'Construction', sev: 1, start: p.start + mm.index, end: p.start + mm.index + mm[0].length,
        text: mm[0].trim(), msg: 'Throat-clearing atmospheric opener.', fix: 'Open on a person doing something.' });
    });

    // tidy ending
    if (opts.checkEnding !== false && paras.length && !disabled.has('end.tidy')) {
      const lastP = paras[paras.length - 1];
      const em = lastP.text.match(ENDING_RE);
      if (em) issues.push({ rule: 'end.tidy', cat: 'Ending', sev: 2, start: lastP.start + em.index, end: lastP.start + em.index + em[0].length,
        text: em[0], msg: 'Summarising, tidy closing line.', fix: 'End on an image, an action, a line of dialogue or a question.' });
    }

    // echoes (opt-in, a revision-pass concern rather than an AI tell): the same long narrative word twice within
    // 25 words. Dialogue and capitalised words are skipped; deliberate repetition is common there.
    if (opts.echo && !disabled.has('rhythm.echo')) {
      const tokRe = /[A-Za-z][A-Za-z']{5,}/g, last = {}, names = new Set(), reported = new Set();
      let tm, idx = 0;
      (opts.properNames || []).forEach((n) => String(n).split(/\s+/).forEach((p) => names.add(p.toLowerCase())));
      while ((tm = tokRe.exec(text)) !== null) {
        idx++;
        const wl = tm[0].toLowerCase();
        if (STOPSET.has(wl) || names.has(wl) || /^[A-Z]/.test(tm[0]) || inQuotes(text, tm.index)) continue;
        if (last[wl] && idx - last[wl] <= 25 && !reported.has(wl + ':' + last[wl])) {
          reported.add(wl + ':' + idx);
          issues.push({ rule: 'rhythm.echo', cat: 'Repetition', sev: 1, start: tm.index, end: tm.index + tm[0].length, text: tm[0],
            msg: '"' + tm[0] + '" echoes ' + (idx - last[wl]) + ' words after its last use.', fix: 'Fine if deliberate; otherwise vary or cut one.' });
        }
        last[wl] = idx;
      }
    }

    const adverbs = adverbCount(text);
    const tricolons = (text.match(/\b[\w'-]+, [\w'-]+,? and [\w'-]+\b/g) || []).length;
    const hedges = (text.match(/\b(?:very|really|just|quite|rather|somewhat|slightly|literally|totally|actually|basically)\b/gi) || []).length;

    issues.sort((a, b) => a.start - b.start || b.sev - a.sev);

    const weights = { 3: 3, 2: 1.5, 1: 0.3 };
    let weighted = 0;
    const bySev = { 1: 0, 2: 0, 3: 0 }, byCat = {};
    const unscored = (it) => it.cat === 'Punctuation' || it.cat === 'Repetition' || it.rule === 'rhythm.fragments';
    issues.forEach((it) => {
      byCat[it.cat] = (byCat[it.cat] || 0) + 1;
      if (unscored(it)) return;
      weighted += weights[it.sev] || 0;
      bySev[it.sev]++;
    });
    const tellIndex = words ? weighted * 1000 / words : 0;
    let totalSyl = 0;
    (text.match(/[A-Za-z]+/g) || []).forEach((w) => { totalSyl += syllables(w); });
    const flesch = (words && lens.length) ? 206.835 - 1.015 * (words / lens.length) - 84.6 * (totalSyl / words) : 0;

    return {
      issues,
      stats: {
        words, sentences: lens.length, paragraphs: paras.length,
        meanSentence: +meanLen.toFixed(1), sdSentence: +sdLen.toFixed(1), rhythmCV: +cv.toFixed(2),
        longestSentence: lens.length ? Math.max(...lens) : 0, sentenceLengths: lens,
        dialogueRatio: text.length ? +(dialogueChars(text) / text.length).toFixed(2) : 0,
        emdashPer1k: +per1k(dashes.length).toFixed(1), emdashMax: emMax, ellipsesPer1k: +per1k(ell).toFixed(1), exclaimNarrationPer1k: +per1k(excl).toFixed(1),
        adverbsPer1k: +per1k(adverbs).toFixed(1), tricolonsPer1k: +per1k(tricolons).toFixed(1), hedgesPer1k: +per1k(hedges).toFixed(1),
        oneLineParagraphRatio: +oneLineRatio.toFixed(2), fleschReadingEase: Math.round(flesch),
        tellIndex: +tellIndex.toFixed(1), tellGrade: tellIndex < 2 ? 'Clean' : tellIndex < 5 ? 'Light' : tellIndex < 10 ? 'Noticeable' : 'Heavy',
        bySeverity: bySev, byCategory: byCat
      }
    };
  }

  // Manuscript-level tics: words and phrases the whole book leans on.
  function tics(text, opts) {
    opts = opts || {};
    const names = new Set();
    (opts.properNames || []).forEach((n) => String(n).split(/\s+/).forEach((p) => names.add(p.toLowerCase())));
    const toks = String(text || '').match(/[A-Za-z][A-Za-z'’]*/g) || [];
    const total = toks.length || 1, counts = {}, capCounts = {};
    toks.forEach((t) => {
      const w = t.toLowerCase().replace(/’/g, "'");
      counts[w] = (counts[w] || 0) + 1;
      if (/^[A-Z]/.test(t)) capCounts[w] = (capCounts[w] || 0) + 1;
    });
    const per10k = (n) => n * 10000 / total;
    const watch = [];
    Object.keys(WATCH).forEach((w) => {
      const c = counts[w] || 0, rate = per10k(c), ratio = rate / WATCH[w];
      if (c >= (opts.minCount || 8) && ratio >= 3) watch.push({ word: w, count: c, per10k: +rate.toFixed(1), expected: WATCH[w], ratio: +ratio.toFixed(1) });
    });
    watch.sort((a, b) => b.ratio - a.ratio);
    const signature = [];
    Object.keys(counts).forEach((w) => {
      const c = counts[w];
      if (w.length < 4 || STOPSET.has(w) || names.has(w) || WATCH[w]) return;
      if ((capCounts[w] || 0) > c * 0.6) return;
      const rate = per10k(c);
      if (c >= 20 && rate >= 12) signature.push({ word: w, count: c, per10k: +rate.toFixed(1) });
    });
    signature.sort((a, b) => b.per10k - a.per10k);
    const low = toks.map((t) => t.toLowerCase());
    const grams = {};
    [3, 4].forEach((n) => {
      for (let i = 0; i + n <= low.length; i++) {
        const g = low.slice(i, i + n);
        if (g.filter((w) => !STOPSET.has(w) && !names.has(w)).length < 2) continue;
        const key = g.join(' ');
        grams[key] = (grams[key] || 0) + 1;
      }
    });
    const phrases = Object.keys(grams).filter((k) => grams[k] >= (opts.minPhrase || 4))
      .map((k) => ({ phrase: k, count: grams[k] })).sort((a, b) => b.count - a.count).slice(0, 40);
    return { words: toks.length, watch, signature: signature.slice(0, 30), phrases };
  }

  return { RULES, WATCH, run, tics, adverbCount, STOPWORDS: STOPSET };
})();
