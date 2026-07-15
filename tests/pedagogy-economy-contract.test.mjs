#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [contract, home, library, study, game] = await Promise.all([
  readFile(new URL('../docs/CONTRATO_PEDAGOGICO_ECONOMIA_P0_2_2026-07-14.md', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/homeView.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/libraryView.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/studyView.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/gameView.js', import.meta.url), 'utf8'),
]);

let passed = 0;
function check(condition, message) {
  assert.ok(condition, message);
  passed += 1;
  console.log(`  ✓ ${message}`);
}

console.log('Contrato pedagógico e economia P0.2');

check(/Errei`, `Difícil`, `Bom` e `Fácil` concedem o mesmo XP/.test(contract),
  'XP por conclusão honesta é independente da nota');
check(/cap server-side fixo de 20\/dia/.test(contract),
  'quota inicial de cards novos é server-side');
check(/300 XP\/dia/.test(contract),
  'limite competitivo diário está explícito');
check(/limite é do placar, não do estudo/.test(contract),
  'cap competitivo não bloqueia aprendizagem');
check(/Card futuro[^\n]+modo Prática/.test(contract),
  'prática futura é separada do FSRS');
check(/recompensa de `card \+ dia` permanece consumida depois do undo/.test(contract),
  'undo não abre ciclo de farming');
check(/p_previous_card[^\n]+não é autoridade/.test(contract),
  'snapshot de undo é capturado pelo servidor');
check(/CTA primário:[\s\S]*Continuar seu plano/.test(contract),
  'próxima ação de aprendizagem é o CTA primário');
check(/Missões não podem ser “ganhar XP” nem “salvar palavras”/.test(contract),
  'missões circulares e coleta sem aprendizagem estão proibidas');

// Etapa 4: o contrato precisa aparecer na arquitetura de informação, não só
// existir num documento. Estes testes deliberadamente evitam cor, posição ou
// classes CSS; verificam somente linguagem e decisão de produto.
check((home.match(/id="home-primary-plan"/g) || []).length === 1
    && (home.match(/id="btn-study-now"/g) || []).length === 1,
  'Home oferece uma única continuação explícita do plano');
check(!/Ganhar \$\{xpTarget\} XP/.test(home) && !/id:\s*['"]xp['"]/.test(home),
  'Home não usa missão circular de ganhar XP');
check(!/recordEvent\(['"]quests_complete['"]\)/.test(home),
  'Home não duplica a recompensa das mesmas evidências');
check(!/claimWeeklyQuest\(/.test(home) && !/Ganhar \$\{weeklyTarget\} XP/.test(home),
  'missão semanal não transforma XP em objetivo circular nem cria prêmio sobre prêmio');
check(!/id:\s*['"]capture['"][^\n]+Salvar/.test(home),
  'capturar conteúdo não é tratado como missão de recuperação');
check(!/bônus (?:de XP )?do primeiro estudo|primeiro estudo do dia dá bônus/i.test(home),
  'Home não promete bônus de XP desconectado de evidência');
check(!/>Consolidados</.test(library),
  'Cofre não chama estado mature de domínio consolidado');

check(!/recordEvent\(['"]game_match['"]/.test(game),
  'prática livre repetível não alimenta XP, streak ou liga');
check(/Prática livre[^\n]+sem alterar seu placar/i.test(game),
  'Jogo explica explicitamente a separação entre prática e placar');

const gradeMarkup = study.slice(study.indexOf('id="grading-buttons"'), study.indexOf('</div>', study.indexOf('id="grading-buttons"')) + 6);
check(!/XP/i.test(gradeMarkup),
  'botões de nota não prometem XP diferente por qualidade');

console.log(`\n${passed} contratos pedagógicos/econômicos passaram.`);
