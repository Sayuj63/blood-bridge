/** Messaging limits and timings. One place, so the safety story is easy to audit. */
export const MESSAGING_POLICY = {
  /** A claimed message returns to the pool if the gateway doesn't ack within this lease. */
  leaseMs: 30_000,
  /** Total delivery attempts per outbox row before it is marked failed. */
  maxAttempts: 3,
  /** Backoff before attempt n+1 (index = attempts so far − 1). */
  retryBackoffMs: [5_000, 30_000, 120_000],
  /** A WhatsApp alert that fails this many times is re-queued as SMS (when the number can take SMS). */
  whatsappFailuresBeforeSms: 2,
  /** Outbound cap per recipient per clock hour (alerts + replies + notices). Also breaks bot-to-bot loops. */
  perRecipientPerHour: 12,
  /** Inbound messages handled per sender per hour; beyond this we stay silent. */
  inboundPerSenderPerHour: 40,
  /** Replies only within this window after the person last messaged us (mirrors WhatsApp's 24 h service window). */
  replyWindowMs: 24 * 3_600_000,
  /** A gateway channel counts as online if it sent a heartbeat this recently. */
  onlineWithinMs: 45_000,
  /** Max rows handed to a gateway per claim. */
  claimBatchMax: 20,
  /** Don't deliver a donation alert after the need has gone stale. */
  alertTtlMs: { critical: 3 * 3_600_000, urgent: 12 * 3_600_000, routine: 48 * 3_600_000 },
  /** Conversation steps (JOIN, follow-up questions) reset after this much silence. */
  conversationTtlMs: 30 * 60_000,
  /** WhatsApp's own limit is 4096; SMS is split into parts by the phone. */
  maxBodyChars: { whatsapp: 4000, sms: 1200 },
} as const;
