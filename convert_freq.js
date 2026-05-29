const fs = require('fs');

const txt = fs.readFileSync('utils/en-top-10k.txt', 'utf8');
const words = txt.split(/\r?\n/).filter(w => w.trim().length > 0);
const dict = {};

words.forEach((w, i) => {
    dict[w.toLowerCase().trim()] = i + 1; // 1-indexed rank
});

fs.writeFileSync('utils/frequency-en.json', JSON.stringify(dict));
console.log('Saved frequency-en.json with ' + Object.keys(dict).length + ' words');
