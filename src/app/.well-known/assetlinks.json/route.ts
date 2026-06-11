export const dynamic = 'force-dynamic'

function splitEnvList(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function GET() {
  const packageName = process.env.ANDROID_APP_PACKAGE_NAME?.trim()
  const fingerprints = splitEnvList(process.env.ANDROID_APP_SHA256_CERT_FINGERPRINTS)
  const statements =
    packageName && fingerprints.length
      ? [
          {
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
              namespace: 'android_app',
              package_name: packageName,
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ]
      : []

  return Response.json(statements, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'application/json',
    },
  })
}
