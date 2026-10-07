// Catálogo simulado para navegação; não simula autenticação ou áudio real.
import { renderCurriculum } from '../../dashboard/js/ui/courses/courseCurriculum.js';
const navigations=[];
window.__preview={navigations};
const catalog=[{id:'mixed',title:'Tempos e situações',level:'B2',lessons:[
 {id:'base-a1',title:'Artigos básicos',level:'A1',lesson_role:'base',module_title:'Referência e nomes',module_order:2,unit_count:8},
 {id:'extra-a1',title:'Reforço de números',level:'A1',lesson_role:'extra',module_title:'Quantidades',module_order:4,unit_count:8},
 {id:'optional-b2',title:'Negociação profissional',level:'B2',lesson_role:'optional',module_title:'Trabalho',module_order:9,unit_count:8},
 {id:'unsafe',title:'<img src=x onerror=alert(1)>',level:'B2',lesson_role:'optional',module_title:'<script>invalid</script>',module_order:10,unit_count:8}
]}];
renderCurriculum(document.getElementById('panel'),{catalog,app:{navigate:(route,params)=>navigations.push({route,params})}});
document.documentElement.dataset.ready='true';
