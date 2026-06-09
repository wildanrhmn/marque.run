export function adPoster(title: string, sub = "marque"): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='#1c1708'/><stop offset='1' stop-color='#08090b'/>
    </linearGradient>
    <radialGradient id='r' cx='50%' cy='40%' r='55%'>
      <stop offset='0' stop-color='rgba(201,164,92,0.32)'/><stop offset='1' stop-color='rgba(201,164,92,0)'/>
    </radialGradient>
  </defs>
  <rect width='640' height='360' fill='url(#g)'/>
  <rect width='640' height='360' fill='url(#r)'/>
  <circle cx='320' cy='140' r='46' fill='none' stroke='#c9a45c' stroke-width='2'/>
  <path d='M298 164 V118 L320 140 L342 118 V164' fill='none' stroke='#e2bd74' stroke-width='8'/>
  <text x='320' y='236' text-anchor='middle' fill='#ece6d8' font-family='sans-serif' font-size='20' font-weight='600'>${escapeXml(
    title,
  )}</text>
  <text x='320' y='262' text-anchor='middle' fill='#8b8d98' font-family='monospace' font-size='12'>${escapeXml(
    sub,
  )}</text>
</svg>`
  return "data:image/svg+xml," + encodeURIComponent(svg)
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
