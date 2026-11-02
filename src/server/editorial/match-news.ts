import { getSupabaseAdminClient } from '@/lib/supabase/admin'
type Fixture = { fixture:{id:number;date:string;status:{short:string}};league:{id:number;name:string};teams:{home:{name:string;logo?:string};away:{name:string;logo?:string}};goals:{home:number|null;away:number|null};score?:{penalty?:{home:number|null;away:number|null}} }
type Event = {type?:string;detail?:string;time?:{elapsed?:number;extra?:number};team?:{name?:string};player?:{name?:string}}
const finals = new Set(['FT','AET','PEN'])
function config() { return {enabled:process.env.HF_MATCH_NEWS_ENABLED==='true',auto:process.env.HF_MATCH_NEWS_AUTO_PUBLISH==='true',leagues:new Set((process.env.HF_MATCH_NEWS_LEAGUES||'128,130,13,11,2,1').split(',').map(Number))} }
async function api<T>(path:string):Promise<T[]> {
 const key=process.env.FOOTBALL_API_KEY||process.env.API_FOOTBALL_KEY
 if(!key) throw new Error('Falta FOOTBALL_API_KEY')
 const base=(process.env.FOOTBALL_API_BASE_URL||'https://v3.football.api-sports.io').replace(/\/$/,'')
 const res=await fetch(base+path,{headers:{'x-apisports-key':key},cache:'no-store',signal:AbortSignal.timeout(14000)})
 if(!res.ok) throw new Error('API-Football HTTP '+res.status)
 const payload=await res.json()
 if(!Array.isArray(payload.response)||Object.keys(payload.errors||{}).length) throw new Error('Respuesta inválida de API-Football')
 return payload.response as T[]
}
function dateBA(d:Date) {return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
function slug(f:Fixture) {return [f.teams.home.name,f.teams.away.name,f.fixture.id].join('-').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function factsFor(f:Fixture,events:Event[]) {
 const goals=events.filter(e=>e.type==='Goal'&&e.player?.name&&e.time?.elapsed!=null).map(e=>({player:e.player!.name,team:e.team?.name||'',minute:e.time!.elapsed,extra:e.time?.extra||null,kind:e.detail||''}))
 return {id:f.fixture.id,league:f.league.name,date:f.fixture.date,home:f.teams.home.name,away:f.teams.away.name,homeGoals:f.goals.home,awayGoals:f.goals.away,penalty:f.fixture.status.short==='PEN'?f.score?.penalty:null,goals}
}
function factual(f:ReturnType<typeof factsFor>) {
 const win=f.homeGoals===f.awayGoals?null:(f.homeGoals!>f.awayGoals!?f.home:f.away)
 const score=f.homeGoals+'-'+f.awayGoals
 const title=win?win+' ganó: '+f.home+' '+score+' '+f.away:f.home+' y '+f.away+' empataron '+score
 const intro=f.home+' y '+f.away+' jugaron por '+f.league+'. El encuentro terminó '+score+'.'
 const detail=f.goals.length?'Los goles registrados fueron: '+f.goals.map(g=>g.player+' ('+g.team+', '+g.minute+(g.extra?'+'+g.extra:'')+"')").join('; ')+'.':''
 const pens=f.penalty?.home!=null&&f.penalty?.away!=null?' La definición por penales fue '+f.penalty.home+'-'+f.penalty.away+'.':''
 return {title,summary:f.home+' '+score+' '+f.away+': resultado final por '+f.league+'.',body:[intro,detail,pens].filter(Boolean).join('\n\n')}
}
async function write(f:ReturnType<typeof factsFor>) {
 const base=factual(f),key=process.env.OPENAI_API_KEY
 if(!key)return {...base,origin:'datos-verificados'}
 const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.HF_MATCH_NEWS_MODEL||'gpt-4.1-mini',input:'Sos periodista de Hay Fulbo. Redactá una crónica argentina de 130 a 220 palabras. SOLO hechos del JSON. No inventes desarrollo, jugadas, declaraciones ni tabla. Incluí marcador local-visitante '+f.homeGoals+'-'+f.awayGoals+' y nombres exactos de ambos clubes. Mantené el marcador de penales separado. Respondé SOLO JSON con title,summary,body. Datos: '+JSON.stringify(f),text:{format:{type:'json_schema',name:'match_news',strict:true,schema:{type:'object',additionalProperties:false,required:['title','summary','body'],properties:{title:{type:'string'},summary:{type:'string'},body:{type:'string'}}}}},max_output_tokens:1000}),signal:AbortSignal.timeout(35000)})
 if(!response.ok)throw new Error('OpenAI HTTP '+response.status)
 const data=await response.json()
 const raw=(data.output||[]).flatMap((x:{content?:Array<{type:string;text?:string}>})=>x.content||[]).filter((x:{type:string})=>x.type==='output_text').map((x:{text:string})=>x.text).join('')
 const parsed=JSON.parse(raw) as typeof base
 const combined=[parsed.title,parsed.summary,parsed.body].join(' ')
 if(!combined.includes(f.home)||!combined.includes(f.away)||!combined.includes(f.homeGoals+'-'+f.awayGoals)||parsed.body.length<120)throw new Error('Crónica rechazada: faltan datos verificados')
 return {title:parsed.title.slice(0,155),summary:parsed.summary.slice(0,400),body:parsed.body.slice(0,6000),origin:'openai'}
}
export async function runMatchNews() {
 const c=config();if(!c.enabled)return {ok:true,enabled:false,reason:'Activar HF_MATCH_NEWS_ENABLED'}
 const db=getSupabaseAdminClient(),now=Date.now()
 const dates=[dateBA(new Date(now)),dateBA(new Date(now-24*3600_000))]
 const fixtures=(await Promise.all(dates.map(d=>api<Fixture>('/fixtures?date='+d+'&timezone=America%2FArgentina%2FBuenos_Aires')))).flat()
 const candidates=[...new Map(fixtures.filter(f=>c.leagues.has(f.league.id)&&finals.has(f.fixture.status.short)&&Number.isInteger(f.goals.home)&&Number.isInteger(f.goals.away)).map(f=>[f.fixture.id,f])).values()]
 if(candidates.length) { const {error}=await db.from('hf_match_news_jobs').upsert(candidates.map(f=>({fixture_id:f.fixture.id,league_id:f.league.id})),{onConflict:'fixture_id',ignoreDuplicates:true});if(error)throw error }
 const {data:jobs,error:claimError}=await db.rpc('hf_claim_match_news',{p_limit:2});if(claimError)throw claimError
 const result=[]
 for(const job of jobs||[]) {
  try {
   const list=await api<Fixture>('/fixtures?id='+job.fixture_id);const fixture=list[0]
   if(!fixture||!finals.has(fixture.fixture.status.short)||fixture.goals.home==null||fixture.goals.away==null)throw new Error('Final aún no confirmado')
   const ev=await api<Event>('/fixtures/events?fixture='+job.fixture_id).catch(()=>[])
   const facts=factsFor(fixture,ev),copy=await write(facts)
   const {error}=await db.from('hf_match_news_articles').upsert({fixture_id:job.fixture_id,league_id:fixture.league.id,slug:slug(fixture),title:copy.title,summary:copy.summary,body:copy.body,league:fixture.league.name,home_team:fixture.teams.home.name,away_team:fixture.teams.away.name,home_logo:fixture.teams.home.logo||null,away_logo:fixture.teams.away.logo||null,home_goals:fixture.goals.home,away_goals:fixture.goals.away,kickoff_at:fixture.fixture.date,facts,origin:copy.origin,status:c.auto?'published':'draft',published_at:c.auto?new Date().toISOString():null},{onConflict:'fixture_id',ignoreDuplicates:true})
   if(error)throw error
   const {error:doneError}=await db.from('hf_match_news_jobs').update({state:'done',leased_at:null,last_error:null}).eq('fixture_id',job.fixture_id);if(doneError)throw doneError
   result.push({fixture:job.fixture_id,state:'done'})
  } catch(err) {
   const message=err instanceof Error?err.message:'Error inesperado'
   const {error:retryError}=await db.from('hf_match_news_jobs').update({state:job.attempts>=5?'failed':'retry',leased_at:null,last_error:message.slice(0,450),next_attempt_at:new Date(Date.now()+Math.min(120,5*2**job.attempts)*60_000).toISOString()}).eq('fixture_id',job.fixture_id)
   result.push({fixture:job.fixture_id,state:retryError?'failed-update':'retry',error:message})
  }
 }
 return {ok:true,enabled:true,scanned:fixtures.length,eligible:candidates.length,processed:result}
}
export type MatchNewsArticle={id:string;fixture_id:number;slug:string;title:string;summary:string;body:string;league:string;home_team:string;away_team:string;home_logo:string|null;away_logo:string|null;home_goals:number;away_goals:number;published_at:string|null}
export async function publishedMatchNews(limit=24):Promise<MatchNewsArticle[]> {
 try {const db=getSupabaseAdminClient();const {data,error}=await db.from('hf_match_news_articles').select('id,fixture_id,slug,title,summary,body,league,home_team,away_team,home_logo,away_logo,home_goals,away_goals,published_at').eq('status','published').order('published_at',{ascending:false}).limit(limit);if(error)throw error;return data||[]}
 catch(err){console.error('[match-news] public read unavailable',err);return []}
}
export async function publishedMatchNewsByFixture(id:number):Promise<MatchNewsArticle|null> {
 const news=await publishedMatchNews(100);return news.find(a=>a.fixture_id===id)||null
}
