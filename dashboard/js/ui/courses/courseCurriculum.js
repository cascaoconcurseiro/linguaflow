// #533: navegação por módulos de conteúdo; abre o mesmo preparo/player de sempre.
import { escapeHTML } from '../../../../utils/html.js';
import { startLesson } from './courseUi.js';
const ROLE_LABEL={base:'Base do nível',extra:'Prática extra',optional:'Opcional por objetivo'};
export function lessonRole(lesson){return lesson.lesson_role || (lesson.is_core===false?'extra':'base');}
export function lessonRoleLabel(lesson){return ROLE_LABEL[lessonRole(lesson)] || 'Conteúdo';}
export function matchesCurriculumFilter(course,level='',role=''){
  return (course.lessons || []).some(l=>(!level||(l.level||course.level)===level)&&(!role||lessonRole(l)===role));
}
export function renderCurriculum(container,{catalog,app,level='A1'}){
  const items=catalog.flatMap(course=>course.lessons.map(lesson=>({course,lesson})));
  let chosen=level;
  let role='base';
  container.innerHTML=`<div class="course-section-head"><h2 class="course-section-title">Conteúdos por nível</h2></div>
    <p class="course-hub-subtitle">Siga a base na trilha. Prática extra e opcionais ficam disponíveis sem bloquear seu avanço.</p>
    <div class="course-filter-row">
      <label>Nível <select data-curriculum-level aria-label="Nível dos conteúdos">${['A1','A2','B1','B2','C1'].map(l=>`<option ${l===chosen?'selected':''}>${l}</option>`).join('')}</select></label>
      <label>Conteúdo <select data-curriculum-role aria-label="Tipo de conteúdo"><option value="base">Base do nível</option><option value="extra">Prática extra</option><option value="optional">Opcional por objetivo</option><option value="">Todos os conteúdos</option></select></label>
    </div><div data-curriculum-modules role="region" aria-label="Módulos de conteúdo"></div>`;
  const region=container.querySelector('[data-curriculum-modules]');
  function paint(){
    const filtered=items.filter(({course,lesson})=>(lesson.level||course.level)===chosen&&(!role||lessonRole(lesson)===role));
    const groups=new Map();
    for(const item of filtered.sort((a,b)=>(a.lesson.module_order||99)-(b.lesson.module_order||99)||(a.lesson.curriculum_order||0)-(b.lesson.curriculum_order||0))){
      const title=item.lesson.module_title||item.course.title;
      if(!groups.has(title))groups.set(title,[]);
      groups.get(title).push(item);
    }
    region.innerHTML=groups.size?[...groups].map(([title,list])=>`<details class="course-curriculum-module">
      <summary><strong>${escapeHTML(title)}</strong><span class="course-card-stats">${list.length} aulas</span></summary>
      ${list[0]?.lesson.learning_objective?`<p class="course-hub-subtitle">Objetivo: ${escapeHTML(list[0].lesson.learning_objective)}</p>`:''}
      <ol class="course-curriculum-lessons">${list.map(({course,lesson})=>`<li>
        <div><strong>${escapeHTML(lesson.title)}</strong><span class="course-card-stats">${escapeHTML(lessonRoleLabel(lesson))}${lesson.lesson_stage?` · ${escapeHTML({introduction:'Introdução',practice:'Prática',application:'Aplicação',consolidation:'Consolidação'}[lesson.lesson_stage]||'')}`:''} · ${escapeHTML(course.title)}</span>
          ${lesson.prerequisite_titles?.length?`<span class="course-card-stats">Antes: ${escapeHTML(lesson.prerequisite_titles.join(' · '))}</span>`:''}</div>
        <button class="course-btn-continue" type="button" data-curriculum-lesson="${escapeHTML(lesson.id)}">Praticar aula</button></li>`).join('')}</ol></details>`).join(''):
      '<p class="course-hub-subtitle" role="status">Nenhuma aula desta categoria neste nível.</p>';
    region.querySelectorAll('[data-curriculum-lesson]').forEach(b=>b.addEventListener('click',()=>{
      const item=items.find(x=>x.lesson.id===b.dataset.curriculumLesson);
      if(item)startLesson(app,item.course,item.lesson);
    }));
  }
  container.querySelector('[data-curriculum-level]').addEventListener('change',e=>{chosen=e.target.value;paint();});
  container.querySelector('[data-curriculum-role]').addEventListener('change',e=>{role=e.target.value;paint();});
  paint();
}
