// Imagens das palavras dos cursos de vocabulário (#443). Fonte única: este
// mapa gera a migration de imagens (scripts/generate-course-images.mjs).
//
// Critério editorial: só recebe imagem a palavra que uma ilustração mostra sem
// ambiguidade (objeto, animal, comida, cor). Parentesco, sentimento, tempo,
// direção e adjetivos abstratos ficam sem imagem: nada genérico.
// Ilustrações: Noto Emoji (Google), imagens sob Apache 2.0, versão fixada.

export const IMAGE_SOURCE = {
  base: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@v2.047/svg/emoji_u',
  credit: 'Noto Emoji (Google)',
  license: 'Apache-2.0',
};

// unit id -> sequência de code points do Noto (separados por "_", sem FE0F).
export const IMAGES = {
  // 01 Pessoas e família
  'unit-1000-words-a1-01-01': '1f931', // mother
  'unit-1000-words-a1-01-02': '1f468_200d_1f37c', // father
  'unit-1000-words-a1-01-09': '1f9d2', // child
  'unit-1000-words-a1-01-11': '1f476', // baby
  'unit-1000-words-a1-01-13': '1f475', // grandmother
  'unit-1000-words-a1-01-14': '1f474', // grandfather
  'unit-1000-words-a1-01-18': '1f46a', // family
  'unit-1000-words-a1-01-19': '1f468', // man
  'unit-1000-words-a1-01-20': '1f469', // woman
  // 02 Cores
  'unit-1000-words-a1-02-01': '1f7e5', // red
  'unit-1000-words-a1-02-02': '1f7e6', // blue
  'unit-1000-words-a1-02-03': '1f7e9', // green
  'unit-1000-words-a1-02-04': '1f7e8', // yellow
  'unit-1000-words-a1-02-05': '2b1b', // black
  'unit-1000-words-a1-02-06': '2b1c', // white
  'unit-1000-words-a1-02-07': '1f7e7', // orange
  'unit-1000-words-a1-02-08': '1f7ea', // purple
  'unit-1000-words-a1-02-09': '1fa77', // pink
  'unit-1000-words-a1-02-10': '1f7eb', // brown
  'unit-1000-words-a1-02-11': '1fa76', // gray
  'unit-1000-words-a1-02-12': '1f947', // gold
  'unit-1000-words-a1-02-13': '1f948', // silver
  'unit-1000-words-a1-02-18': '1f3a8', // color
  'unit-1000-words-a1-02-20': '1f308', // rainbow
  // 08 Corpo humano
  'unit-1000-words-a1-08-04': '1f441', // eye
  'unit-1000-words-a1-08-05': '1f442', // ear
  'unit-1000-words-a1-08-06': '1f443', // nose
  'unit-1000-words-a1-08-07': '1f444', // mouth
  'unit-1000-words-a1-08-08': '1f9b7', // tooth
  'unit-1000-words-a1-08-11': '1f4aa', // arm
  'unit-1000-words-a1-08-12': '270b', // hand
  'unit-1000-words-a1-08-13': '261d', // finger
  'unit-1000-words-a1-08-16': '1f9b5', // leg
  'unit-1000-words-a1-08-18': '1f9b6', // foot
  'unit-1000-words-a1-08-19': '1fac0', // heart
  // 09 Roupas e acessórios
  'unit-1000-words-a1-09-01': '1f45a', // clothes
  'unit-1000-words-a1-09-02': '1f454', // shirt
  'unit-1000-words-a1-09-03': '1f455', // t-shirt
  'unit-1000-words-a1-09-04': '1f456', // pants
  'unit-1000-words-a1-09-05': '1f456', // jeans
  'unit-1000-words-a1-09-06': '1fa73', // shorts
  'unit-1000-words-a1-09-07': '1f457', // dress
  'unit-1000-words-a1-09-10': '1f9e5', // coat
  'unit-1000-words-a1-09-11': '1f9e5', // jacket
  'unit-1000-words-a1-09-12': '1f9e6', // socks
  'unit-1000-words-a1-09-13': '1f45e', // shoes
  'unit-1000-words-a1-09-14': '1f45f', // sneakers
  'unit-1000-words-a1-09-15': '1f97e', // boots
  'unit-1000-words-a1-09-16': '1f452', // hat
  'unit-1000-words-a1-09-17': '1f9e3', // scarf
  'unit-1000-words-a1-09-18': '1f9e4', // gloves
  'unit-1000-words-a1-09-20': '1f48d', // ring
  // 11 Comida básica e refeições
  'unit-1000-words-a1-11-05': '1f35e', // bread
  'unit-1000-words-a1-11-06': '1f35a', // rice
  'unit-1000-words-a1-11-07': '1fad8', // beans
  'unit-1000-words-a1-11-08': '1f95a', // egg
  'unit-1000-words-a1-11-09': '1f356', // meat
  'unit-1000-words-a1-11-10': '1f969', // beef
  'unit-1000-words-a1-11-11': '1f357', // chicken
  'unit-1000-words-a1-11-12': '1f41f', // fish
  'unit-1000-words-a1-11-13': '1f9c0', // cheese
  'unit-1000-words-a1-11-14': '1f9c8', // butter
  'unit-1000-words-a1-11-16': '1f9c2', // salt
  'unit-1000-words-a1-11-17': '1f336', // pepper
  'unit-1000-words-a1-11-19': '1f372', // soup
  'unit-1000-words-a1-11-20': '1f96a', // sandwich
  // 12 Frutas, legumes e verduras
  'unit-1000-words-a1-12-03': '1f34e', // apple
  'unit-1000-words-a1-12-04': '1f34c', // banana
  'unit-1000-words-a1-12-05': '1f34a', // orange
  'unit-1000-words-a1-12-06': '1f347', // grapes
  'unit-1000-words-a1-12-07': '1f353', // strawberry
  'unit-1000-words-a1-12-08': '1f34b', // lemon
  'unit-1000-words-a1-12-10': '1f34d', // pineapple
  'unit-1000-words-a1-12-11': '1f349', // watermelon
  'unit-1000-words-a1-12-12': '1f96d', // mango
  'unit-1000-words-a1-12-13': '1f951', // avocado
  'unit-1000-words-a1-12-14': '1f345', // tomato
  'unit-1000-words-a1-12-15': '1f954', // potato
  'unit-1000-words-a1-12-16': '1f9c5', // onion
  'unit-1000-words-a1-12-17': '1f9c4', // garlic
  'unit-1000-words-a1-12-18': '1f955', // carrot
  'unit-1000-words-a1-12-19': '1f96c', // lettuce
  'unit-1000-words-a1-12-20': '1f33d', // corn
  // 13 Bebidas, sabores e mesa
  'unit-1000-words-a1-13-01': '1f4a7', // water
  'unit-1000-words-a1-13-02': '1f9c3', // juice
  'unit-1000-words-a1-13-03': '2615', // coffee
  'unit-1000-words-a1-13-04': '1f375', // tea
  'unit-1000-words-a1-13-05': '1f95b', // milk
  'unit-1000-words-a1-13-06': '1f37a', // beer
  'unit-1000-words-a1-13-07': '1f964', // soda
  'unit-1000-words-a1-13-08': '1f9ca', // ice
  'unit-1000-words-a1-13-18': '1f37d', // plate
  'unit-1000-words-a1-13-19': '1f374', // fork
  'unit-1000-words-a1-13-20': '1f52a', // knife
  // 15 Transporte
  'unit-1000-words-a1-15-01': '1f697', // car
  'unit-1000-words-a1-15-02': '1f68c', // bus
  'unit-1000-words-a1-15-03': '1f687', // subway
  'unit-1000-words-a1-15-04': '1f686', // train
  'unit-1000-words-a1-15-05': '2708', // plane
  'unit-1000-words-a1-15-06': '1f6b2', // bike
  'unit-1000-words-a1-15-07': '1f3cd', // motorcycle
  'unit-1000-words-a1-15-08': '1f695', // taxi
  'unit-1000-words-a1-15-09': '1f69a', // truck
  'unit-1000-words-a1-15-10': '1f6a2', // ship
  'unit-1000-words-a1-15-11': '1f689', // station
  'unit-1000-words-a1-15-12': '1f68f', // stop
  'unit-1000-words-a1-15-13': '1f3ab', // ticket
  'unit-1000-words-a1-15-14': '1f4ba', // seat
  'unit-1000-words-a1-15-17': '1f6e3', // highway
  'unit-1000-words-a1-15-20': '1f6b6', // walk
  // 16 Clima e natureza
  'unit-1000-words-a1-16-01': '26c5', // weather
  'unit-1000-words-a1-16-02': '2600', // sun
  'unit-1000-words-a1-16-04': '2601', // cloudy
  'unit-1000-words-a1-16-05': '1f327', // rainy
  'unit-1000-words-a1-16-06': '1f32c', // windy
  'unit-1000-words-a1-16-07': '26c8', // storm
  'unit-1000-words-a1-16-08': '2744', // snow
  'unit-1000-words-a1-16-09': '1f975', // hot
  'unit-1000-words-a1-16-12': '1f976', // cold
  'unit-1000-words-a1-16-13': '1f321', // degrees
  'unit-1000-words-a1-16-17': '1f342', // fall
  'unit-1000-words-a1-16-20': '26f0', // mountain
  // 18 Animais
  'unit-1000-words-a1-18-01': '1f415', // dog
  'unit-1000-words-a1-18-02': '1f408', // cat
  'unit-1000-words-a1-18-04': '1f426', // bird
  'unit-1000-words-a1-18-05': '1f41f', // fish
  'unit-1000-words-a1-18-06': '1f40e', // horse
  'unit-1000-words-a1-18-07': '1f404', // cow
  'unit-1000-words-a1-18-08': '1f416', // pig
  'unit-1000-words-a1-18-09': '1f411', // sheep
  'unit-1000-words-a1-18-10': '1f414', // chicken
  'unit-1000-words-a1-18-11': '1f986', // duck
  'unit-1000-words-a1-18-12': '1f401', // mouse
  'unit-1000-words-a1-18-13': '1f407', // rabbit
  'unit-1000-words-a1-18-14': '1f40d', // snake
  'unit-1000-words-a1-18-15': '1f412', // monkey
  'unit-1000-words-a1-18-16': '1f981', // lion
  'unit-1000-words-a1-18-17': '1f43b', // bear
  'unit-1000-words-a1-18-18': '1f988', // shark
  'unit-1000-words-a1-18-19': '1f41d', // bee
  'unit-1000-words-a1-18-20': '1f577', // spider
};
