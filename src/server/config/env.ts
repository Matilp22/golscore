export function getFootballApiConfig() {
  const apiKey = process.env.FOOTBALL_API_KEY
  const baseUrl =
    process.env.FOOTBALL_API_BASE_URL || 'https://v3.football.api-sports.io'

  if (!apiKey) {
    throw new Error('Falta FOOTBALL_API_KEY en el entorno.')
  }

  return {
    apiKey,
    baseUrl: baseUrl.trim().replace(/\/+$/, ''),
  }
}
