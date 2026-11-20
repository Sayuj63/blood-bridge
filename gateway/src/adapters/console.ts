/**
 * Test adapter: no phone needed. Outbound messages print to stdout; each line typed on
 * stdin is an inbound message. Lines look like `+919800000002: JOIN` (any sender) or just
 * `JOIN` (from CONSOLE_FROM). Stands in for WhatsApp or SMS via CONSOLE_CHANNEL.
 */
import { createInterface, type Interface } from "node:readline";
import { BaseAdapter, type AdapterHooks, type Channel, type OutboundMessage, type SendResult } from "./types.ts";

const LINE = /^\s*(\+?\d[\d\s-]{7,}\d|[\d-]{6,40}@g\.us)\s*[:>]\s*(.+)$/;

export class ConsoleAdapter extends BaseAdapter {
  readonly name = "console";
  private rl: Interface | null = null;
  private seq = 0;

  constructor(
    readonly channel: Channel,
    private readonly defaultFrom: string,
  ) {
    super();
  }

  async start(hooks: AdapterHooks): Promise<void> {
    this.hooks = hooks;
    this.rl = createInterface({ input: process.stdin, terminal: false });
    this.rl.on("line", (line) => {
      if (!line.trim()) return;
      const m = LINE.exec(line);
      const from = m ? m[1].replace(/[\s-]/g, "") : this.defaultFrom;
      const text = (m ? m[2] : line).trim();
      process.stdout.write(`\n← [${this.channel} ${from}] ${text}\n`);
      hooks.onInbound({ channel: this.channel, from, text, messageId: `console-${process.pid}-${Date.now()}-${++this.seq}`, at: Date.now() });
    });
    // stdin closing (e.g. piped input ended) doesn't stop the gateway: outbound keeps flowing.
    this.rl.on("close", () => (this.rl = null));
    process.stdout.write(`Console ${this.channel} adapter ready. Type a message (or "+91…: text") and press Enter.\n`);
    this.setState("online", "console (test)");
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    const indented = message.body.split("\n").map((l) => `   ${l}`).join("\n");
    process.stdout.write(`\n→ [${this.channel} ${message.to}] (${message.id})\n${indented}\n`);
    return { providerMessageId: `console-${message.id}` };
  }

  async stop(): Promise<void> {
    this.rl?.close();
    this.setState("offline");
  }
}
