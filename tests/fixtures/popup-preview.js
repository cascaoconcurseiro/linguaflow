// Local-only browser fixture: real popup code, synthetic account, no network writes.
import {db} from '../../utils/db.js';
window.fetch=async()=>{throw new Error('Network disabled in fixture');};
for(const name of Object.getOwnPropertyNames(Object.getPrototypeOf(db))) {
 if(name!=='constructor' && typeof db[name]==='function') db[name]=async()=>{throw new Error(`Unmocked: ${name}`);};
}
Object.assign(db,{
 _readSession:async()=>({access_token:'fixture-only'}),checkSession:async()=>true,
 getSetting:async()=> 'en',getStudyStats:async()=>({listening:{todayFormatted:'27m',totalFormatted:'2h 14m'}}),
 getUserStats:async()=>({streak:3}),getCardsDueCount:async()=>31,logout:async()=>{},
 login:async()=>({ok:false,error:'Prévia: não há autenticação real.'}),
});
window.chrome={storage:{local:{get:(_,callback)=>callback({lf_supabase_session:JSON.stringify({session:{user:{email:'aluno@example.invalid'}}})})}},runtime:{sendMessage:async()=>({ok:false})}};
await import('../../popup/popup.js');
