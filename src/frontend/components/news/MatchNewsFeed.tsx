import Link from 'next/link'
import { publishedMatchNews } from '@/server/editorial/match-news'
export default async function MatchNewsFeed() {
 const articles=await publishedMatchNews(24)
 if(!articles.length)return null
 return <section className="space-y-4" aria-label="Crónicas automáticas">
 <div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-[#70ff9d]"/><h2 className="text-xl font-black text-white">Los partidos que terminaron</h2><span className="rounded-full border border-[#70ff9d]/30 px-2 py-1 text-[10px] font-black uppercase text-[#70ff9d]">Postpartido</span></div>
 <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{articles.map(a=><Link key={a.id} href={'/noticias/partido/'+a.fixture_id} className="hf-card-hover rounded-2xl border border-white/10 bg-[#12211b] p-4 text-white transition hover:border-[#70ff9d]/50">
  <div className="flex items-center justify-between text-xs text-[#b5c9bc]"><span>{a.league}</span><span>FINAL</span></div>
  <div className="my-3 flex items-center justify-center gap-3 rounded-xl bg-black/20 p-3">{a.home_logo?<img src={a.home_logo} alt="" className="h-9 w-9 object-contain"/>:null}<strong className="text-2xl tabular-nums">{a.home_goals} - {a.away_goals}</strong>{a.away_logo?<img src={a.away_logo} alt="" className="h-9 w-9 object-contain"/>:null}</div>
  <h3 className="text-lg font-black leading-tight">{a.title}</h3><p className="mt-2 line-clamp-3 text-sm text-[#b5c9bc]">{a.summary}</p><span className="mt-3 block text-xs font-black text-[#70ff9d]">LEER CRÓNICA →</span>
 </Link>)}</div></section>
}
