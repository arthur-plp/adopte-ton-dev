// CSP "raisonnable" plutôt que stricte (cf. CLAUDE.md §31.4) : Next.js a besoin
// de 'unsafe-inline'/'unsafe-eval' pour son runtime client sans refactor en
// profondeur (nonces par requête) ; Stripe.js et les avatars OAuth (GitHub/
// Google) sont explicitement autorisés. Le reste (object-src, base-uri,
// frame-ancestors) reste strict pour limiter l'injection/le clickjacking.
//
// En prod, la Gateway (HTTP et WebSocket) est servie sous le même domaine via
// Nginx (/api/v1 et /socket.io/ → proxy_pass), donc 'self' suffit : la
// directive connect-src applique l'équivalence ws↔http/wss↔https à 'self'
// (CSP3), mais PAS à une origine explicite — d'où le besoin d'ajouter
// explicitement ws://localhost:4000 en dev (web et Gateway sont deux origines
// distinctes : localhost:3000 vs localhost:4000), en plus de http://localhost:4000
// déjà nécessaire pour les appels REST.
const isDev = process.env.NODE_ENV !== "production";
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://api.stripe.com https://photon.komoot.io${isDev ? " http://localhost:4000 ws://localhost:4000" : ""}`,
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["pg", "@prisma/client", "@prisma/adapter-pg"],

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "github.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
