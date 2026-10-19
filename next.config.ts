import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker runner stage (see Dockerfile).
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // `next dev` logs every Server Function call with its arguments, which printed sign-in
  // passwords in the terminal (QA report 2026-10-11). Development only, but keep it off.
  logging: { serverFunctions: false },
  // `npm run dev:https` opened from a phone or another PC: that address must be allowed, or the dev
  // server blocks the page's scripts. DEV_ORIGINS=172.20.10.2 in .env (development only).
  allowedDevOrigins: (process.env.DEV_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  // ONNX Runtime (the Capture page's model, D-064) loads its native build by a path worked out at
  // run time, so the bundle tracer can't see it. The Docker image is Linux x64: include that build
  // and leave the other platforms out.
  outputFileTracingIncludes: {
    "*": ["node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**"],
  },
  outputFileTracingExcludes: {
    "*": [
      "node_modules/onnxruntime-node/bin/napi-v6/win32/**",
      "node_modules/onnxruntime-node/bin/napi-v6/darwin/**",
      "node_modules/onnxruntime-node/bin/napi-v6/linux/arm64/**",
    ],
  },
};

export default nextConfig;
