import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    ok: false,
    error: 'Endpoint de prueba deshabilitado para no consumir API-Football en rutas publicas.',
    adminEndpoint: '/api/admin/test-football-api',
  })
}
