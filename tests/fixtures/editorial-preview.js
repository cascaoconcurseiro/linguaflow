// Local-only visual fixture. Production Vercel configuration blocks /tests/.
// All database methods fail closed unless explicitly mocked below.
import { db } from '../../utils/db.js';
const originalFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.href);
  if (url.origin !== location.origin) return Promise.reject(new Error('External requests disabled in visual fixture'));
  return originalFetch(input, init);
};
for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(db))) {
  if (name !== 'constructor' && typeof db[name] === 'function') db[name] = async () => { throw new Error(`Fixture: ${name} is not mocked`); };
}
const sentence = 'Your mom works hard and she deserves a nice gift.';
const translation = 'Sua mãe trabalha duro e ela merece um presente legal.';
const words = [
  { id:'w1', word:'deserves', translation:'merece', context_sentence:sentence, explanation:'Ela merece receber um presente pelo esforço que faz.', category:'word', video_title:'Mother’s Day · Max', video_url:'https://play.hbomax.com/video/watch/demo?t=398', platform:'max', pronunciation_pt:'dizârvs', level:'A2',
    ai_chunks:[{eng:sentence,pt:translation,phon:'',is_context:true},{eng:'deserves',pt:'merece',phon:'dizârvs',is_learning_unit:true,is_word:true},{eng:'She deserves a break.',pt:'Ela merece uma pausa.',phon:''}] },
  { id:'w2',word:'come over',translation:'vir aqui',context_sentence:'You want him to come over again?',category:'phrasal',level:'A2', ai_chunks:[{eng:'You want him to come over again?',pt:'Você quer que ele venha aqui de novo?',is_context:true},{eng:'come over',pt:'vir aqui',is_word:true,is_learning_unit:true}] },
];
const cards=words.map((w,i)=>({id:`c${i}`,word_id:w.id,wordData:w,status:'review',due_date:'2026-09-21T10:00:00Z',reps:4,lapses:0,stability:4,difficulty:5,interval:3,added_at:'2026-09-20T10:00:00Z'}));
const story={id:'s1',title:'A small surprise',level:'A2',genre:'Dia a Dia',created_at:'2026-09-21T12:00:00Z',content:'On Saturday morning, Anna walked to the little shop near her home. She wanted to find something for her mother.\n\n“My mom works hard,” she thought. “She deserves a nice gift.” Inside the shop, Anna found a blue notebook. Her mother loved writing stories.\n\nWhen Anna got home, her mother was making tea. “Come over here,” Anna said. She gave her the notebook. Her mother smiled. It was a small gift, but it meant a lot.'};
Object.assign(db,{
 getSettings:async()=>({lf_reverse_cards:false,lf_varied_exercises:false,lf_audio_auto_front:false,lf_audio_auto_back:false,lf_card_flip_mode:'anki_flip'}),
 getSetting:async(k)=>k==='sourceLang'?'en':k==='lf_cefr_level'?'A2':null,
 getSRSSettings:async()=>({newPerDay:20,maxRevPerDay:200}), getTodayCounts:async()=>({newIntroducedToday:0,reviewsToday:0}),
 getStudyCards:async()=>structuredClone(cards),getAdaptiveProfiles:async()=>({}),getAllCards:async()=>structuredClone(cards),getAllWords:async()=>structuredClone(words),getAllKnownWords:async()=>[],
 getStories:async()=>[story],getFluencyCheckStatus:async()=>({fluencyDue:false}),
 getStats:async()=>({totalWords:2,dueCards:2,byStatus:{review:2},sessions:[],reviewLog:[],userStats:{xp_today:0,streak:0}}),
 getStudyStats:async()=>({summary:{totalHours:3.1},byActivity:{},today:{}}),
 getReaderTexts:async()=>[],getCurrentUserId:async()=> 'visual-fixture',
 predictNextState:async(_,grade)=>({interval:[1/1440,10/1440,4,14][grade-1]}),
 recordAdaptiveSignal:async()=>null, getLearningProfile:async()=>null,
 logReview:async()=>{throw new Error('Prévia: avaliações não são gravadas.');},
 _getToken:async()=>null,
});
const {renderHome}=await import('../../dashboard/js/ui/homeView.js?v=3.0.55');
const {renderStudy}=await import('../../dashboard/js/ui/studyView.js?v=3.0.55');
const {renderLearn}=await import('../../dashboard/js/ui/learnView.js');
const {renderProgress}=await import('../../dashboard/js/ui/progressView.js');
const {renderLibrary}=await import('../../dashboard/js/ui/libraryView.js');
const {renderStories}=await import('../../dashboard/js/ui/storiesView.js?v=3.0.55');
const {renderReader}=await import('../../dashboard/js/ui/readerView.js');
const {renderSettings}=await import('../../dashboard/js/ui/settingsView.js');
const views={home:renderHome,study:renderStudy,learn:renderLearn,progress:renderProgress,library:renderLibrary,stories:renderStories,reader:renderReader,settings:renderSettings};
let leaves=[],controller=new AbortController();
const root=document.getElementById('app-root');
const app={db,currentRoute:'home',renderSignal:controller.signal,
 onLeaveView(fn){leaves.push(fn);},showToast(message){const t=document.getElementById('toast-container');t.textContent=message;clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>t.textContent='',2200);},
 updateFocusStatus(p){document.getElementById('study-focus-status').textContent=p?.text||`${p?.completed||0} concluídos`;},
 async navigate(route,params={}){for(const fn of leaves)fn();leaves=[];controller.abort();controller=new AbortController();this.renderSignal=controller.signal;this.currentRoute=route;document.body.classList.toggle('lf-focus-mode',route==='study');document.getElementById('study-focus-header').hidden=route!=='study';root.scrollTop=0;root.innerHTML='';document.querySelectorAll('[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===route));await (views[route]||renderLearn)(root,this,params);},
};
document.body.classList.remove('lf-auth-pending');
document.querySelectorAll('[data-route]').forEach(b=>b.addEventListener('click',()=>app.navigate(b.dataset.route)));
document.getElementById('study-focus-exit').onclick=()=>app.navigate('home');
document.getElementById('topbar-search-btn').onclick=()=>app.navigate('library');
document.getElementById('profile-menu-toggle').onclick=()=>{const menu=document.getElementById('profile-menu');menu.hidden=!menu.hidden;};
document.getElementById('theme-toggle-btn').onclick=()=>{document.documentElement.toggleAttribute('data-preview-dark');if(document.documentElement.hasAttribute('data-preview-dark'))document.documentElement.dataset.theme='dark';else document.documentElement.removeAttribute('data-theme');};
const notice=document.createElement('div');notice.className='preview-notice';notice.textContent='Prévia de design · dados demonstrativos · sem gravações';notice.style.cssText='position:fixed;z-index:1000;bottom:0;left:0;right:0;font:10px system-ui;text-align:center;background:#e5ecfc;color:#183e96;pointer-events:none';document.body.append(notice);
await app.navigate(new URL(location.href).searchParams.get('view')||'home');
