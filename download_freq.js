const https = require('https');
const fs = require('fs');

const url = "https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt";
const file = fs.createWriteStream("utils/en-top-10k.txt");

https.get(url, response => {
  response.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log("Download Completo");
  });
}).on('error', err => {
  fs.unlink("utils/en-top-10k.txt");
  console.error("Erro:", err.message);
});
