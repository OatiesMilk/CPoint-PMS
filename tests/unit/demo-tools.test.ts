import { beforeEach, describe, expect, it, vi } from "vitest";

// The demo tools on the login page (Phase 28, D-101, A-23).
const env = {
  NODE_ENV: "production",
  DEMO_LOGIN_TOOLS: true,
  SEED_DEMO_USERS: true,
  DEMO_USER_PASSWORD: "demo-password",
  CV_DEVICE_TOKEN: undefined as string | undefined,
};
const signIn = vi.fn();
const findUserByEmail = vi.fn();
const resetDemoData = vi.fn();
const resetKeep = vi.fn((tokens: string[]) => ({ tokens }));

vi.mock("next-auth", () => {
  class AuthError extends Error {}
  class CredentialsSignin extends AuthError {
    code = "credentials";
  }
  return { AuthError, CredentialsSignin };
});
vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/lib/env", () => ({ getEnv: () => env }));
vi.mock("@/server/lib/auth", () => ({ signIn }));
vi.mock("@/server/models/user.model", () => ({ findUserByEmail }));
vi.mock("@/server/services/demo-reset.service", () => ({ resetDemoData, resetKeep }));
vi.mock("@/server/services/bootstrap.service", () => ({
  DEMO_USERS: [
    { email: "manager@cpoint.local", name: "Rodel Pascual", role: "FLOOR_MANAGER" },
    { email: "inspector@cpoint.local", name: "Maricel Dizon", role: "QUALITY_INSPECTOR" },
    { email: "admin@cpoint.local", name: "Jerome Salazar", role: "SYSTEM_ADMIN" },
    { email: "constructor@cpoint.local", name: "Noel Manalo", role: "SHOE_CONSTRUCTOR" },
  ],
}));

const { CredentialsSignin } = await import("next-auth");
const { POST: signInRoute } = await import("@/app/api/v1/demo/sign-in/route");
const { POST: resetRoute } = await import("@/app/api/v1/demo/reset/route");
const { DEMO_SIGN_INS, demoToolsEnabled, isDemoSignIn } =
  await import("@/server/services/demo-tools.service");

const post = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(env, {
    DEMO_LOGIN_TOOLS: true,
    SEED_DEMO_USERS: true,
    DEMO_USER_PASSWORD: "demo-password",
    CV_DEVICE_TOKEN: undefined,
  });
  findUserByEmail.mockResolvedValue({ id: "u1" });
  signIn.mockResolvedValue("/");
  resetDemoData.mockResolvedValue({ removed: { scans: 3 }, demoWeek: { seeded: true } });
});

describe("the demo accounts", () => {
  it("are four buttons, in the brief's order and words", () => {
    expect(DEMO_SIGN_INS.map((d) => d.label)).toEqual([
      "Floor Manager · Rodel Pascual",
      "Quality Inspector · Maricel Dizon",
      "System Admin · Jerome Salazar",
      "Shoe Constructor · Noel Manalo",
    ]);
  });

  it("need both flags (A-23)", () => {
    expect(demoToolsEnabled()).toBe(true);
    env.SEED_DEMO_USERS = false;
    expect(demoToolsEnabled()).toBe(false);
    env.SEED_DEMO_USERS = true;
    env.DEMO_LOGIN_TOOLS = false;
    expect(demoToolsEnabled()).toBe(false);
  });

  it("label only a demo account's sign-in as a demo, and only with the tools on", () => {
    expect(isDemoSignIn(" Manager@CPoint.local ")).toBe(true);
    expect(isDemoSignIn("someone@cpoint.local")).toBe(false);
    env.DEMO_LOGIN_TOOLS = false;
    expect(isDemoSignIn("manager@cpoint.local")).toBe(false);
  });
});

describe("with the flag off", () => {
  for (const [name, route, path, body] of [
    ["sign-in", signInRoute, "/api/v1/demo/sign-in", { role: "FLOOR_MANAGER" }],
    ["reset", resetRoute, "/api/v1/demo/reset", { confirm: "RESET" }],
  ] as const) {
    it(`${name} answers 404 and nothing runs`, async () => {
      env.DEMO_LOGIN_TOOLS = false;
      const res = await route(post(path, body));
      expect(res.status).toBe(404);
      expect(signIn).not.toHaveBeenCalled();
      expect(resetDemoData).not.toHaveBeenCalled();
    });

    it(`${name} answers 404 without the demo accounts`, async () => {
      env.SEED_DEMO_USERS = false;
      expect((await route(post(path, body))).status).toBe(404);
      expect(signIn).not.toHaveBeenCalled();
      expect(resetDemoData).not.toHaveBeenCalled();
    });
  }
});

describe("POST /api/v1/demo/sign-in", () => {
  it("signs in through the normal credentials path with the server's password", async () => {
    const res = await signInRoute(post("/api/v1/demo/sign-in", { role: "QUALITY_INSPECTOR" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { redirectTo: "/batches" } });
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "inspector@cpoint.local",
      password: "demo-password",
      method: "demo",
      redirect: false,
    });
  });

  it("refuses a role that isn't one of the four", async () => {
    const res = await signInRoute(post("/api/v1/demo/sign-in", { role: "OWNER" }));
    expect(res.status).toBe(422);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("names the account that isn't on the database", async () => {
    findUserByEmail.mockResolvedValue(null);
    const res = await signInRoute(post("/api/v1/demo/sign-in", { role: "FLOOR_MANAGER" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.message).toMatch(/Rodel Pascual's account/);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("says when the server has no demo password", async () => {
    env.DEMO_USER_PASSWORD = undefined as unknown as string;
    const res = await signInRoute(post("/api/v1/demo/sign-in", { role: "FLOOR_MANAGER" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("DEMO_PASSWORD_MISSING");
  });

  it("passes on a refused sign-in in the login form's words", async () => {
    const locked = new CredentialsSignin();
    locked.code = "locked:7";
    signIn.mockRejectedValue(locked);
    const res = await signInRoute(post("/api/v1/demo/sign-in", { role: "SYSTEM_ADMIN" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.message).toMatch(/locked for 7 more minutes/);
  });
});

describe("POST /api/v1/demo/reset", () => {
  it("needs RESET typed exactly", async () => {
    const res = await resetRoute(post("/api/v1/demo/reset", { confirm: "reset" }));
    expect(res.status).toBe(422);
    expect(resetDemoData).not.toHaveBeenCalled();
  });

  it("runs the demo:reset from the login page, keeping the simulator's token", async () => {
    env.CV_DEVICE_TOKEN = "cpt_sim";
    const res = await resetRoute(post("/api/v1/demo/reset", { confirm: "RESET" }));
    expect(res.status).toBe(200);
    expect(resetKeep).toHaveBeenCalledWith(["cpt_sim"]);
    expect(resetDemoData).toHaveBeenCalledWith(
      { tokens: ["cpt_sim"] },
      { origin: "login page", allowInProduction: true },
    );
  });

  it("runs one at a time", async () => {
    let finish: (v: unknown) => void = () => {};
    resetDemoData.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    const first = resetRoute(post("/api/v1/demo/reset", { confirm: "RESET" }));
    await vi.waitFor(() => expect(resetDemoData).toHaveBeenCalledTimes(1));
    const second = await resetRoute(post("/api/v1/demo/reset", { confirm: "RESET" }));
    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe("RESET_RUNNING");
    finish({ removed: {}, demoWeek: null });
    expect((await first).status).toBe(200);
    // Free again once it ends.
    expect((await resetRoute(post("/api/v1/demo/reset", { confirm: "RESET" }))).status).toBe(200);
  });
});
