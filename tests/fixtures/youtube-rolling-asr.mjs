// Trecho real (0:48–1:47) da legenda automática em inglês de
// https://www.youtube.com/watch?v=fki0zXwktCY, formato json3 "rolante":
// cada linha fica na tela até a próxima aparecer; "\n" com aAppend quebra a linha.
const raw = [
  [48830, 0, '\n'], [48840, 4240, '>> Good morning, everyone. Happy September.'],
  [50830, 2250, '\n'], [50840, 3880, "Well, I'm filming this August 29th, so"],
  [53070, 1650, '\n'], [53080, 3400, "it's not September yet, but this video"],
  [54710, 1770, '\n'], [54720, 3600, "is going to be the September reset. It's"],
  [56470, 1850, '\n'], [56480, 4320, "weird I'm finally not filming a video"],
  [58310, 2490, '\n'], [58320, 5000, "for school. I've been very school,"],
  [60790, 2530, '\n'], [60800, 4719, 'school, go, go, go, and I wanted to do a'],
  [63310, 2209, '\n'], [63320, 4400, 'slower video, a reset kind of video, and'],
  [65509, 0, '\n'], [65519, 3801, 'a chatty vlog cuz I wanted to give you'],
  [67710, 0, '\n'], [67720, 4080, 'guys some life updates. And speaking of'],
  [69310, 0, '\n'], [69320, 5320, 'life updates, new hoodie, super'],
  [71790, 0, '\n'], [71800, 4920, 'adorable. I am like over the moon with'],
  [74630, 0, '\n'], [74640, 4200, 'this hoodie. The colors, the fit, and'],
  [76710, 0, '\n'], [76720, 4320, 'also fortune from a fortune cookie,'],
  [78830, 0, '\n'], [78840, 4160, '"Enjoy life. It is better to be happy'],
  [81030, 0, '\n'], [81040, 3960, 'than to be wise." September motto right'],
  [82990, 0, '\n'], [83000, 4280, "there. That's what That's the vibe for"],
  [84990, 0, '\n'], [85000, 4680, 'September, but it is 8:00 a.m. I want to'],
  [87270, 0, '\n'], [87280, 4000, 'have a very productive and fun day. My'],
  [89670, 0, '\n'], [89680, 4200, 'room needs a little bit of a reset. I'],
  [91270, 0, '\n'], [91280, 6280, "need like a mental break. School, it's"],
  [93870, 0, '\n'], [93880, 6080, 'not really kicking my butt yet, but like'],
  [97550, 0, '\n'], [97560, 4240, "it's like the senioritis in me that just"],
  [99950, 0, '\n'], [99960, 4640, 'wants a break. Like I got home from'],
  [101790, 0, '\n'], [101800, 5280, 'school yesterday, Friday, and usually'],
];

export const rollingAsrEvents = raw.map(([tStartMs, dDurationMs, text]) => ({
  tStartMs,
  dDurationMs,
  wWinId: 1,
  ...(text === '\n' ? { aAppend: 1 } : {}),
  segs: [{ utf8: text }],
}));
