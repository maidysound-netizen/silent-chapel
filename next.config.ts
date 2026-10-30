import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 개발 서버를 같은 Wi-Fi의 휴대폰에서 열 때 허용할 주소 (개발 모드에서만 쓰임)
  allowedDevOrigins: ["172.30.1.4", "*.local"],
  // 보안 헤더 (Vercel 배포 시에도 그대로 적용)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
