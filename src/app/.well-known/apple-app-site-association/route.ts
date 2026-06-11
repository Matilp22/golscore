export const dynamic = 'force-dynamic'

function splitEnvList(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function GET() {
  const appIDs = splitEnvList(process.env.IOS_APP_IDS)
  const payload = {
    applinks: {
      apps: [],
      details: appIDs.length
        ? [
            {
              appIDs,
              components: [
                {
                  '/': '/*',
                  comment: 'Open Hay Fulbo links in the installed app.',
                },
              ],
            },
          ]
        : [],
    },
    webcredentials: {
      apps: appIDs,
    },
  }

  return Response.json(payload, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'application/json',
    },
  })
}
