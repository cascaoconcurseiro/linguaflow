// #535: player real com servidor simulado; não acessa contas nem grava produção.
import { db } from '../../utils/db.js';
import { renderCoursePractice } from '../../dashboard/js/ui/coursePracticeView.js';
localStorage.setItem('lf_course_prefs', JSON.stringify({ audio: false, sfx: false, reduceMotion: true }));
const units=[{id:'u535',text:'Hello.',kind:'sentence',translation_pt:'Olá.'}];
const state={commits:0,reads:0,navigations:[],release:null,leave:null};
const mode=new URLSearchParams(location.search).get('mode');
const returnLevel=new URLSearchParams(location.search).get('returnLevel');
db.courses={
 async getLesson(){return {id:'l535',title:'Aula atual',course_id:'c535',units,course_catalog:{title:'Curso atual'}};},
 async commitPractice(){state.commits++;if(mode==='save-error'&&state.commits===1)throw Error('offline');await new Promise(resolve=>{state.release=resolve;});return {percent_completed:100};},
 async getPath(){state.reads++;if(mode==='next-error'&&state.reads===1)throw Error('offline');return {next:mode==='done'?null:{lesson_id:'next535',course_id:'other535',title:'Aplicação no próximo curso',level:returnLevel?'A2':'A1',module_title:'Rotina'},blocked:false};},
};
window.__completion=state;
await renderCoursePractice(document.getElementById('panel'),{onLeaveView(fn){state.leave=fn;},navigate(route,params){state.navigations.push({route,params});state.leave();}}, {kind:'lesson',lessonId:'l535',courseId:'c535',difficulty:'hard',returnLevel});
document.documentElement.dataset.ready='true';
