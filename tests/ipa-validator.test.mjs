import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidIpa, cleanIpa } from '../utils/ipa-validator.js';

test('IPA Validator: accepts authentic General American IPA transcriptions', () => {
  const validCases = [
    '/wi ˈθɔt əv ˈræpɪŋ ɪt, bət ðɛn ˈdɪdənt/',
    '/aɪ θɪŋk ju ʃʊd kɔl hər/',
    '/aɪ kænt ɡɛt ˈoʊvər wʌt ˈhæpənd/',
    '/ɡɛt ˈoʊvər/',
    '/aɪ stɪl ˈhævənt ˈɡɑːtn̩ ˈoʊvər ɪt/',
    '/gˈʊd/',
    '/ˈæp.əl/',
    '/ˈwɔːtər/',
    '/ˈwɑːtər/',
    '/ˈwɑɾɚ/',
    '/həˈloʊ/',
    '/ðæt/',
    '/θɔt/',
    '/ðɛn/',
    '/ˈræpɪŋ/',
    '/ˈdɪdənt/',
    '[wi ˈθɔt əv ˈræpɪŋ ɪt, bət ðɛn ˈdɪdənt]',
    'wi ˈθɔt əv ˈræpɪŋ ɪt, bət ðɛn ˈdɪdənt',
  ];

  for (const item of validCases) {
    assert.equal(isValidIpa(item), true, `Deveria aceitar IPA válido: ${item}`);
  }
});

test('IPA Validator: rejects Brazilian Portuguese respelling and informal phonetic approximations', () => {
  const abrasileiradoCases = [
    'Uí fót óv rrépin it, bât dén dídnt.',
    'Pronúncia (IPA): Uí fót óv rrépin it, bât dén dídnt.',
    'Ai kent get ôuver uót répennd',
    'get ôuver',
    'Ai stil révent góten ôuver it',
    'Uí',
    'fót',
    'répin',
    'rrépin',
    'bât',
    'dén',
    'dídnt',
    'dídânt',
    'díd-ja',
    'don-cha',
    'tchá',
    '/Uí fót óv rrépin it, bât dén dídnt/',
    '/Ai kent get ôuver/',
  ];

  for (const item of abrasileiradoCases) {
    assert.equal(isValidIpa(item), false, `Deveria rejeitar pronúncia abrasileirada: ${item}`);
    assert.equal(cleanIpa(item), '', `cleanIpa deveria retornar vazio para: ${item}`);
  }
});

test('IPA Validator: rejects English source sentences and Portuguese translation leaks', () => {
  const leaks = [
    'We thought of wrapping it, but then didn\'t.',
    'I can\'t get over what happened.',
    'Nós pensamos em embrulhar isso, mas depois não fizemos.',
    'Eu não consigo superar o que aconteceu.',
    'transcrição IPA da frase inteira',
    'transcrição IPA só da palavra-foco',
    'Vou bater aqui com você',
    '',
    '   ',
    null,
    undefined,
    123,
    {},
  ];

  for (const item of leaks) {
    assert.equal(isValidIpa(item), false, `Deveria rejeitar vazamentos ou não-strings: ${item}`);
    assert.equal(cleanIpa(item), '');
  }
});

test('IPA Validator: rejects plain non-IPA words without phonetic symbols or slashes', () => {
  const plainText = [
    'Ui fot ov repin it, bat den didnt',
    'thinking about something else',
    'good morning',
  ];

  for (const item of plainText) {
    assert.equal(isValidIpa(item), false, `Deveria rejeitar texto sem marcas fonéticas de IPA: ${item}`);
  }
});

test('IPA Validator: cleanIpa normalizes formatting to /.../', () => {
  assert.equal(
    cleanIpa('wi ˈθɔt əv ˈræpɪŋ ɪt, bət ðɛn ˈdɪdənt'),
    '/wi ˈθɔt əv ˈræpɪŋ ɪt, bət ðɛn ˈdɪdənt/'
  );
  assert.equal(
    cleanIpa('[wi ˈθɔt əv ˈræpɪŋ ɪt, bət ðɛn ˈdɪdənt]'),
    '/wi ˈθɔt əv ˈræpɪŋ ɪt, bət ðɛn ˈdɪdənt/'
  );
  assert.equal(
    cleanIpa('/wi ˈθɔt əv ˈræpɪŋ ɪt, bət ðɛn ˈdɪdənt/'),
    '/wi ˈθɔt əv ˈræpɪŋ ɪt, bət ðɛn ˈdɪdənt/'
  );
  assert.equal(cleanIpa('   /θɔt/   '), '/θɔt/');
});
