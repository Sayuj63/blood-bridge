import { app } from "./app";
import { hubStub } from "./deps";

export { CityHub } from "./hub";

export default {
  fetch: app.fetch,
  /** Cron backstop: make sure the hub's sweep alarm is armed even if an RPC was lost. */
  async scheduled(_controller, env) {
    await hubStub(env).scheduleSweep(Date.now());
  },
} satisfies ExportedHandler<Env>;
