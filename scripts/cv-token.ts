// `npm run cv:token -- --name "Preparation phone"`: create a camera device token from the terminal.
// The token is printed once; only its hash is stored. Revoke it under Admin → API tokens.
import "dotenv/config";
import { getPrisma } from "../src/server/lib/prisma";
import { createDeviceTokenAsAdmin } from "../src/server/services/api-token.service";

const i = process.argv.indexOf("--name");
const name = (i > -1 && process.argv[i + 1]) || "Simulator";

createDeviceTokenAsAdmin(name)
  .then(({ token, tokenPrefix }) => {
    console.log(
      `\nCreated device token "${name}" (${tokenPrefix}…). It is shown only this once:\n`,
    );
    console.log(`  ${token}\n`);
    console.log("For the simulator, add it to .env as:");
    console.log(`  CV_DEVICE_TOKEN=${token}\n`);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => getPrisma().$disconnect());
