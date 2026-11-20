import type { MessageChannel } from "../shared/domain";
import type { Db } from "./db/client";
import type { AuditInput, PublishInput } from "./hub";

/** The realtime + ledger surface services depend on. Implemented by the CityHub DO. */
export interface Hub {
  publish(event: PublishInput): Promise<void>;
  audit(entries: AuditInput[]): Promise<void>;
  scheduleSweep(at: number): Promise<void>;
}

/** Everything a service needs, passed explicitly — no globals, easy to test. */
export interface Deps {
  db: Db;
  env: Env;
  hub: Hub;
  now: number;
  /**
   * Called after a row lands in the outbox. Request handlers use it to drain WhatsApp
   * through the Cloud API in ctx.waitUntil once the response is on its way.
   */
  onQueued?: (channel: MessageChannel) => void;
}

export const HUB_NAME = "mumbai";

export function hubStub(env: Env) {
  return env.CITY_HUB.get(env.CITY_HUB.idFromName(HUB_NAME));
}

export function remoteHub(env: Env): Hub {
  const stub = hubStub(env);
  return {
    publish: (e) => stub.publish(e),
    audit: (e) => stub.audit(e),
    scheduleSweep: (at) => stub.scheduleSweep(at),
  };
}
