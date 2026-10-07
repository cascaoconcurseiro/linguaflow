// #535: decisões editoriais explícitas. Capítulos antigos e progresso mantêm seus IDs.
import { PEDAGOGY_CURRICULUM } from './curriculum-pedagogy.mjs';
import { COURSES } from './batches/sequence-535.mjs';
const specifications = [
 ['A1','Apresentação e primeiras frases','Apresentar-se, perguntar e negar com to be; pedir esclarecimento.','first-sentences-a1-01 first-sentences-a1-02 first-sentences-a1-03 pedagogy-a1-clarify'],
 ['A1','Objetos e existência','Identificar objetos, apontar e dizer o que existe.','pedagogy-a1-articles pedagogy-a1-plurals pedagogy-a1-demonstratives first-sentences-a1-04 1000-words-a1-04 1000-words-a1-26'],
 ['A1','Pessoas, descrição e posse','Descrever pessoas e indicar relações e posse.','first-sentences-a1-05 pedagogy-a1-possessive-s 1000-words-a1-01 1000-words-a1-38 pedagogy-a1-descriptions 1000-words-a1-09'],
 ['A1','Números, dias e horários','Reconhecer números e informar telefone, preços e horários.','1000-words-a1-03 1000-words-a1-05 numbers-a1-03 1000-words-a1-06 1000-words-a1-07 numbers-a1-04 numbers-a1-02'],
 ['A1','Rotina e perguntas','Falar de rotina e frequência; perguntar e ligar informações simples.','first-sentences-a1-06 first-sentences-a1-07 pedagogy-a1-have pedagogy-a1-frequency sequence-a1-wh pedagogy-a1-object-pronouns pedagogy-a1-basic-connectors'],
 ['A1','Casa e lugares','Localizar objetos e reconhecer informações sobre a cidade e transporte.','prepositions-b1-02 1000-words-a1-10 1000-words-a1-14 1000-words-a1-15'],
 ['A1','Gostos, pedidos e habilidades','Expressar gostos, quantidades e habilidades; compreender instruções.','first-sentences-a1-10 1000-words-a1-11 pedagogy-a1-some-any first-sentences-a1-08 first-sentences-a1-09'],
 ['A1','Ações agora e revisão','Descrever ações acontecendo agora e retomar rotina, lugar e horário.','pedagogy-a1-now'],
 ['A2','Rotinas em contraste','Contrastar hábitos e ações temporárias em trabalho, estudo e casa.','tenses-b1-01 1000-words-a1-20 1000-words-a1-21 1000-words-a1-30 1000-words-a1-35 1000-words-a1-36 1000-words-a1-40 routine-a2-01 routine-a2-02'],
 ['A2','Relatos no passado','Relatar acontecimentos simples e distinguir contexto e ação no passado.','first-sentences-a1-11 pedagogy-a2-past-simple tenses-b1-02 first-sentences-a1-12 numbers-a1-01'],
 ['A2','Descrições e comparação','Descrever aparência e sentimentos; comparar pessoas, objetos e situações.','1000-words-a1-02 1000-words-a1-19 1000-words-a1-23 1000-words-a1-24 1000-words-a1-39 sequence-a2-ed-ing pedagogy-a2-comparatives pedagogy-a2-superlatives'],
 ['A2','Quantidades e compras','Distinguir contáveis e incontáveis; explicar quantidade e realizar compras.','1000-words-a1-12 1000-words-a1-13 1000-words-a1-31 1000-words-a1-44 pedagogy-a2-countability pedagogy-a2-too-enough routine-a2-03 collocations-b2-02 shopping-a2-01 shopping-a2-02 shopping-a2-03'],
 ['A2','Planos e compromissos','Propor planos, combinar datas e comunicar intenção e futuro.','prepositions-b1-01 tenses-b1-05 numbers-a1-05 numbers-a1-06 numbers-a1-08 routine-a2-05 routine-a2-06 social-a2-02 social-a2-04 1000-words-a1-22'],
 ['A2','Regras, escolhas e finalidade','Dar conselho, explicar obrigação e condições simples; dizer a finalidade.','pedagogy-a2-advice-rules modals-b1-01 modals-b1-02 modals-b1-07 pedagogy-a2-simple-conditionals pedagogy-a2-verb-patterns pedagogy-a2-purpose-sequence prepositions-b1-03 1000-words-a1-41 1000-words-a1-43'],
 ['A2','Serviços e problemas','Pedir ajuda e esclarecer problemas em saúde, deslocamento e viagem.','1000-words-a1-08 1000-words-a1-16 1000-words-a1-17 1000-words-a1-32 1000-words-a1-34 survival-a2-01 survival-a2-02 survival-a2-03 survival-a2-08 survival-a2-10 health-a2-01 travel-a2-02 travel-a2-03 travel-a2-05 travel-a2-10 travel-a2-11'],
 ['A2','Experiências recentes e revisão','Falar de experiências recentes e retomar informação em fala conectada.','pedagogy-a2-recent-experiences connected-b2-05'],
 ['B1','Experiência e duração','Relacionar experiência, resultado e duração ao presente.','tenses-b1-03 pedagogy-b1-duration tenses-b1-04'],
 ['B1','Narrativas e hábitos passados','Narrar acontecimentos em sequência e explicar hábitos antigos.','pedagogy-b1-used-to tenses-b1-06 routine-a2-04 stories-b1-01 stories-b1-02 paragraphs-b2-04'],
 ['B1','Possibilidades e hipóteses','Explicar condições, possibilidades e hipóteses sobre o presente.','pedagogy-b1-probability tenses-b1-07 tenses-b1-08 tenses-b1-14 modals-b1-06'],
 ['B1','Descrição e confirmação','Especificar pessoas e coisas; perguntar com polidez e confirmar informação.','pedagogy-b1-simple-relatives pedagogy-b1-polite-questions sequence-b1-tags prepositions-b1-04 1000-words-a1-25'],
 ['B1','Relatar informação','Reconhecer a voz passiva e relatar afirmações e perguntas de outras pessoas.','tenses-b1-10 tenses-b1-12 tenses-b1-13'],
 ['B1','Razões, contrastes e combinações','Explicar razões e contrastes usando conectores e combinações frequentes.','pedagogy-b1-reasons-contrast prepositions-b1-06 1000-words-a1-42 collocations-b2-01 pedagogy-b1-phrasal-context'],
 ['B1','Opinião e resolução de problemas','Expressar opinião e conduzir conversas, pedidos e reclamações.','shopping-a2-04 shopping-a2-06 health-a2-02 health-a2-05 social-a2-01 social-a2-03 social-a2-05 street-a1-03 street-a1-04 idioms-b2-04 idioms-b2-06 connected-b2-02 connected-b2-03'],
 ['B1','Histórias, parágrafos e revisão','Acompanhar histórias e organizar informação conectada em parágrafos.','stories-b1-04 stories-b1-09 paragraphs-b2-01 paragraphs-b2-08 pedagogy-b1-integrated'],
 ['B2','Tempo e especulação','Interpretar perspectivas de tempo e deduções sobre acontecimentos passados.','pedagogy-b2-future-perfect pedagogy-b2-accustomed tenses-b1-15 modals-b1-03 modals-b1-04 modals-b1-05 modals-b1-08 connected-b2-01'],
 ['B2','Condições e arrependimento','Interpretar condições complexas e expressar arrependimento e alternativas.','pedagogy-b2-unless tenses-b1-09 grammar-b2-01 grammar-b2-02'],
 ['B2','Passivas e causativo','Relatar processos e serviços usando passivas e causativo.','tenses-b1-11 grammar-b2-03'],
 ['B2','Relativas e complementos','Interpretar relativas e escolher complementos verbais em contexto.','grammar-b2-04 grammar-b2-05'],
 ['B2','Precisão e organização do discurso','Controlar referência, intensidade, contraste e registro em textos conectados.','pedagogy-b2-intensity pedagogy-b2-reference-articles prepositions-b1-05 collocations-b2-03 collocations-b2-05 collocations-b2-07 collocations-b2-08 register-c1-01'],
 ['B2','Argumentação','Acompanhar e organizar argumentos, razões, contrapontos e comparações.','pedagogy-b2-argument-structure debate-b2-01 debate-b2-02 debate-b2-03 debate-b2-04 debate-b2-05 debate-b2-06 paragraphs-b2-05 paragraphs-b2-09'],
 ['B2','Registro e linguagem indireta','Interpretar pedidos, recusas, mal-entendidos e opiniões suavizadas.','social-a2-06 idioms-b2-05 subtext-b2-03 subtext-b2-04'],
 ['B2','Temas e revisão integradora','Retomar estruturas e interpretar vocabulário de temas sociais e profissionais.','themes-b2-01 themes-b2-02 themes-b2-03 themes-b2-04 themes-b2-05 themes-b2-06 collocations-b2-06 tenses-b1-16'],
];
export const BLOCKS=specifications.map(([level,title,goal,shortIds],index)=>({
 level,title,goal,number:index%8+1,ids:[...shortIds.split(' ').map(id=>`lesson-${id}`),`lesson-sequence-${level.toLowerCase()}-m${index%8+1}`],
}));
// Dependências locais: além da consolidação do bloco anterior, estruturas novas
// precisam da sua base semântica. Vocabulário do mesmo bloco pode ser explorado em paralelo.
const prerequisites={
 'first-sentences-a1-02':['first-sentences-a1-01'],
 'first-sentences-a1-03':['first-sentences-a1-02'],
 'pedagogy-a1-plurals':['pedagogy-a1-articles'],
 'pedagogy-a1-demonstratives':['pedagogy-a1-plurals'],
 'first-sentences-a1-04':['pedagogy-a1-plurals'],
 'pedagogy-a1-possessive-s':['first-sentences-a1-05'],
 'pedagogy-a1-descriptions':['1000-words-a1-38'],
 '1000-words-a1-05':['1000-words-a1-03'],
 'numbers-a1-03':['1000-words-a1-05'],
 'numbers-a1-04':['1000-words-a1-05','1000-words-a1-07'],
 'numbers-a1-02':['1000-words-a1-05'],
 'first-sentences-a1-07':['first-sentences-a1-06'],
 'pedagogy-a1-have':['first-sentences-a1-06'],
 'pedagogy-a1-frequency':['first-sentences-a1-06'],
 'sequence-a1-wh':['first-sentences-a1-07'],
 'pedagogy-a1-object-pronouns':['first-sentences-a1-06'],
 'pedagogy-a1-basic-connectors':['first-sentences-a1-06'],
 'pedagogy-a1-some-any':['1000-words-a1-11'],
 'pedagogy-a2-past-simple':['first-sentences-a1-11'],
 'tenses-b1-02':['pedagogy-a2-past-simple'],
 'first-sentences-a1-12':['tenses-b1-02'],
 'sequence-a2-ed-ing':['1000-words-a1-19'],
 'pedagogy-a2-superlatives':['pedagogy-a2-comparatives'],
 'pedagogy-a2-too-enough':['pedagogy-a2-countability'],
 'shopping-a2-01':['pedagogy-a2-countability'],
 'shopping-a2-03':['shopping-a2-01'],
 'numbers-a1-06':['numbers-a1-05','tenses-b1-05'],
 'routine-a2-06':['tenses-b1-05'],
 'modals-b1-07':['pedagogy-a2-advice-rules'],
 'pedagogy-a2-purpose-sequence':['pedagogy-a2-verb-patterns'],
 'health-a2-01':['1000-words-a1-08','1000-words-a1-32'],
 'travel-a2-10':['1000-words-a1-17'],
 'pedagogy-b1-duration':['tenses-b1-03'],
 'tenses-b1-04':['pedagogy-b1-duration'],
 'stories-b1-01':['tenses-b1-06'],
 'stories-b1-02':['tenses-b1-06'],
 'tenses-b1-08':['tenses-b1-07'],
 'sequence-b1-tags':['pedagogy-b1-polite-questions'],
 'tenses-b1-13':['tenses-b1-12'],
 'prepositions-b1-06':['pedagogy-b1-reasons-contrast'],
 'grammar-b2-02':['tenses-b1-09','grammar-b2-01'],
 'grammar-b2-03':['tenses-b1-11'],
 'debate-b2-01':['pedagogy-b2-argument-structure'],
 'paragraphs-b2-05':['pedagogy-b2-argument-structure'],
 'paragraphs-b2-09':['pedagogy-b2-argument-structure'],
};
const source=new Map(PEDAGOGY_CURRICULUM.map(l=>[l.id,l]));
for(const course of COURSES)for(const l of course.lessons)source.set(l.id,{id:l.id,courseId:course.id,level:course.level,core:true,role:'base',reason:'Introdução ou consolidação planejada #535'});
const assigned=new Map();
for(const block of BLOCKS)for(const id of block.ids){if(assigned.has(id)||!source.get(id)?.core)throw Error(`Base inválida: ${id}`);assigned.set(id,block);}
for(const l of source.values())if(l.core&&l.level!=='C1'&&!assigned.has(l.id))throw Error(`Base sem bloco: ${l.id}`);
const extraModuleMap={A1:[1,2,3,5,6,7,7,8],A2:[1,2,3,5,6,6,7,8],B1:[1,2,3,4,5,6,6,7,8,8],B2:[1,2,3,4,5,6,7,8,1,8]};
function stageOf(l){
 if(l.id.startsWith('lesson-sequence-')&&/-m\d$/.test(l.id))return 'consolidation';
 if(l.id.includes('1000-words')||l.id.includes('collocations')||l.id.includes('connected'))return 'practice';
 if(/lesson-(stories|paragraphs|routine|travel|social|shopping|health|survival|debate|street|themes|numbers)-/.test(l.id))return 'application';
 return 'introduction';
}
export const SEQUENCE_CURRICULUM=[];
let order=0;
for(const level of ['A1','A2','B1','B2','C1']){
 if(level==='C1'){
  for(const l of PEDAGOGY_CURRICULUM.filter(l=>l.level==='C1').sort((a,b)=>a.order-b.order))SEQUENCE_CURRICULUM.push({...l,order:++order*10,stage:stageOf(l),goal:'Interpretar linguagem complexa, nuances e registro em contextos avançados.'});
  continue;
 }
 let previous=null;
 for(const block of BLOCKS.filter(b=>b.level===level)){
  for(const id of block.ids){
   const l=source.get(id);const stage=stageOf(l);
   const requires=stage==='consolidation'?block.ids.slice(0,-1):[...new Set([...(previous?[previous]:[]),...(prerequisites[id.replace('lesson-','')]||[]).map(p=>`lesson-${p}`)])];
   SEQUENCE_CURRICULUM.push({...l,order:++order*10,module:block.title,moduleOrder:block.number,requires,stage,goal:block.goal});
  }
  previous=block.ids.at(-1);
  const extras=PEDAGOGY_CURRICULUM.filter(l=>l.level===level&&!l.core&&extraModuleMap[level][l.moduleOrder-1]===block.number);
  for(const l of extras)SEQUENCE_CURRICULUM.push({...l,order:++order*10,module:block.title,moduleOrder:block.number,requires:[previous],stage:stageOf(l),goal:block.goal});
 }
}
if(SEQUENCE_CURRICULUM.length!==449)throw Error('Cobertura curricular incompleta');
