import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";
const api = process.env.STORE_API_INTERNAL_URL ?? "http://localhost:8001";

// المتجر لا يحمّل أي سكربت أو خط أو صورة من نطاق آخر: كل شيء من نفس العنوان.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${dev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
  // التطوير: طلبات المتصفح للواجهة العامة تمر لسيرفر الفروع. في الإنتاج يوجّهها Caddy مباشرة
  // (بعنوان IP الحقيقي للعميل لحدود الطلبات).
  async rewrites() {
    if (!process.env.STORE_DEV_PROXY) return [];
    return [
      {
        source: "/v1/store/public/:path*",
        destination: `${api}/v1/store/public/:path*`,
      },
    ];
  },
};

export default nextConfig;
