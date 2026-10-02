import pino from "pino";

// Structured JSON logs (docker logs / log shippers parse them). Never log secrets or tokens.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "cpoint-pms" },
  redact: ["req.headers.authorization", "*.password", "*.token"],
});
