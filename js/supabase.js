// Conexão com o Supabase. A chave "publishable" pode ser pública; a proteção vem do RLS + login.
const SUPABASE_URL='https://esdwjlemqjjlfvvqoxbu.supabase.co';
const SUPABASE_KEY='sb_publishable_ARN7SSE72dmILrr7kHzXiQ_nsuGMbFK';
const LOGIN_DOMAIN='lumanoids.app'; // usuário "presidente" => presidente@lumanoids.app (criado no painel do Supabase)
const SB=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
const Auth={
 login:(u,p)=>SB.auth.signInWithPassword({email:u.trim().toLowerCase()+'@'+LOGIN_DOMAIN,password:p}),
 logout:()=>SB.auth.signOut(),
 session:async()=>(await SB.auth.getSession()).data.session};
