// CPoint PMS: HTTPS for the LAN (Phase 18, D-065). Browsers only open the camera on localhost or
// a trusted HTTPS address, so other PCs and phones use the Capture page through this listener.
// It runs inside the `app` container beside the Next.js server (still two containers, D-003),
// only when a certificate is mounted at /app/certs (made with mkcert; README "Capture from the
// website"). It passes every request to the app on 127.0.0.1 unchanged, adding the
// X-Forwarded-* headers so sign-in cookies are marked secure. No dependencies.
import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";

const certDir = process.env.CERTS_DIR ?? "/app/certs";
const httpsPort = Number(process.env.HTTPS_PORT ?? 3443);
const appPort = Number(process.env.PORT ?? 3000);

const server = https.createServer(
  {
    cert: readFileSync(`${certDir}/cert.pem`),
    key: readFileSync(`${certDir}/key.pem`),
  },
  (req, res) => {
    const headers = {
      ...req.headers,
      "x-forwarded-proto": "https",
      "x-forwarded-host": req.headers.host ?? "",
      "x-forwarded-port": String(httpsPort),
      "x-forwarded-for": [req.headers["x-forwarded-for"], req.socket.remoteAddress]
        .filter(Boolean)
        .join(", "),
    };
    const upstream = http.request(
      { host: "127.0.0.1", port: appPort, method: req.method, path: req.url, headers },
      (answer) => {
        res.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(res);
      },
    );
    upstream.on("error", () => {
      if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      res.end("The app isn't answering yet. Wait a moment, then reload the page.");
    });
    req.pipe(upstream);
  },
);

server.listen(httpsPort, "0.0.0.0", () => {
  console.log(`[https] Serving https on port ${httpsPort} with the certificate in ${certDir}`);
});
