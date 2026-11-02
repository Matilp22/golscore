import Link from 'next/link'
import { notFound } from 'next/navigation'
import { publishedMatchNewsByFixture } from '@/server/editorial/match-news'
export const dynamic='force-dynamic'
type Props={params:Promise<{id:string}>}
export async function generateMetadata({params}:Props){const {id}=await params;const news=/^\d+$/.test(id)?await publishedMatchNewsByFixture(Number(id)):null;return {title:news?news.title+' | Hay Fulbo':'Crónica | Hay Fulbo',description:news?.summary||'Resultado y crónica del encuentro.'}}
export default async function Page({params}:Props){
 const {id}=await params
 if(!/^\d+$/.test(id))notFound()
 const news=await publishedMatchNewsByFixture(Number(id))
 if(!news)notFound()
 return <main className="min-w-0 text-[#071B2F]"><article className="overflow-hidden rounded-2xl bg-white shadow-lg"><header className="hf-section-head p-5 text-white sm:p-8"><Link className="text-xs font-bold text-[#70ff9d]" href="/noticias">← VOLVER A NOTICIAS</Link><p className="mt-5 text-xs font-black uppercase tracking-widest text-[#70ff9d]">{news.league} · Final</p><h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">{news.title}</h1><p className="mt-3 text-base leading-7 text-[#c8d3cf]">{news.summary}</p></header><div className="flex items-center justify-center gap-5 border-b p-6"><strong>{news.home_team}</strong><span className="text-3xl font-black">{news.home_goals} - {news.away_goals}</span><strong>{news.away_team}</strong></div><div className="space-y-5 p-5 sm:p-8">{news.body.split(/\n\n+/).map((p,i)=><p key={i} className="text-base leading-8 text-[#223344]">{p}</p>)}<Link href={'/partido/'+news.fixture_id} className="inline-block rounded-xl bg-[#0F6B26] px-4 py-3 text-sm font-bold text-white">Ver detalle del partido →</Link></div></article></main>
}
