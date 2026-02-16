import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',            // generates static HTML/CSS/JS
  distDir: 'out',               // default is 'out', but we'll be explicit
  trailingSlash: true,          // so /about becomes /about/index.html – good for ServeDir
  images: {
    unoptimized: true,          // required for static export if you use next/image
  },
};

export default nextConfig;
