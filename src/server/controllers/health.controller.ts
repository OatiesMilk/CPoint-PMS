import { handle, json } from "@/server/lib/http";
import { getHealth } from "@/server/services/health.service";

export const healthController = {
  // 503 when degraded so Docker / load balancers treat the container as unhealthy.
  show: handle(async () => {
    const health = await getHealth();
    return json(health, health.status === "ok" ? 200 : 503);
  }),
};
