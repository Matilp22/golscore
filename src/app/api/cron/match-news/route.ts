import { runMatchNews } from '@/server/editorial/match-news'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60
export async function GET(request:Request) {
 const secret=process.env.CRON_SECRET
 if(!secret||request.headers.get('authorization')!=='Bearer '+secret)return Response.json({error:'No autorizado'},{status:401})
 try{return Response.json(await runMatchNews(),{headers:{'Cache-Control':'no-store'}})}
 catch(err){console.error('[match-news]',err);return Response.json({ok:false,error:err instanceof Error?err.message:'Error inesperado'},{status:500})}
}
