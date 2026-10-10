import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker runner stage (see Dockerfile).
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // `next dev` logs every Server Function call with its arguments, which printed sign-in
  // passwords in the terminal (QA report 2026-10-11). Development only, but keep it off.
  logging: { serverFunctions: false },
};

export default nextConfig;
