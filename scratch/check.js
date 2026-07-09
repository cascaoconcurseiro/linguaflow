const fs = require('fs');
const code = fs.readFileSync('content/settings-panel.js', 'utf8');
const html = code.substring(code.indexOf('_html() {'), code.lastIndexOf('}'));
const ids = ['sel-lang', 'sel-mode', 'sel-autopause', 'rng-font', 'rng-font-trans', 'rng-bg', 'rng-position', 'rng-horizontal', 'rng-delay', 'rng-anticipation', 'rng-flash', 'col-known', 'col-saved', 'sel-font-family', 'sel-palette', 'sel-tts-speed', 'sel-blur', 'sel-cefr-level', 'sel-cefr-colors'];
const missing = ids.filter(id => !html.includes('id="' + id + '"'));
console.log('Missing IDs:', missing);
