import Script from 'next/script'

const ADSENSE_PUBLISHER_ID = 'ca-pub-9918770947892784'

export default function GoogleAdSense() {
  return (
    // This component is mounted from the App Router root layout so AdSense is available site-wide for verification.
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
    <Script
      id="google-adsense"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`}
      crossOrigin="anonymous"
      strategy="beforeInteractive"
    />
  )
}
