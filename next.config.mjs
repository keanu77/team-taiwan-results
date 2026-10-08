// 網站不在網域根目錄時（例如 GitHub Pages 的 https://<帳號>.github.io/<repo>/），build 時要帶 BASE_PATH（例如 /team-taiwan-results）。
// GitHub Actions 由 actions/configure-pages 自動帶入；本機開發留空即可。
const basePath = process.env.BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
