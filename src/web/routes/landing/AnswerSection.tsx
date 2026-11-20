import { motion, useReducedMotion } from "motion/react";
import { ArrowLeftRight, BellRing, Hand, MonitorSmartphone } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

interface Capability {
  icon: ReactNode;
  title: string;
  body: string;
  view: { to: string; label: string };
}

const CAPABILITIES: Capability[] = [
  {
    icon: <MonitorSmartphone aria-hidden />,
    title: "One screen for the whole city",
    body: "A ward nurse picks the group, component and units. Every compatible, in-date unit nearby appears ranked by travel time, freshness and shelf life.",
    view: { to: "/hospital", label: "Open the hospital view" },
  },
  {
    icon: <Hand aria-hidden />,
    title: "Reserve in one tap",
    body: "The blood bank confirms within a set window, or the next-best option is offered automatically. Stale stock asks for a phone check first.",
    view: { to: "/bank", label: "Open the blood bank view" },
  },
  {
    icon: <ArrowLeftRight aria-hidden />,
    title: "Move blood before it expires",
    body: "When the forecast shows one site running dry while another holds units that will expire unused, the system proposes the transfer. An operator approves it.",
    view: { to: "/command", label: "Open command" },
  },
  {
    icon: <BellRing aria-hidden />,
    title: "Ask the right donors, only",
    body: "Alerts go to donors who match the group, are eligible, are nearby and said yes to alerts. Quiet hours and weekly limits are theirs to set.",
    view: { to: "/donor", label: "Open the donor phone" },
  },
];

/** (e) The answer, in four capabilities, each linking to the view that does it. */
export function AnswerSection() {
  const reduced = useReducedMotion();
  return (
    <section aria-labelledby="answer-title" className="mx-auto max-w-7xl px-4 py-24 sm:px-8 sm:py-32">
      <h2 id="answer-title" className="max-w-3xl font-display text-[clamp(1.9rem,1rem+3vw,3.6rem)] leading-[1.02] text-balance">
        Three people, one shared picture.
      </h2>
      <p className="mt-5 max-w-2xl text-lg text-ink-muted">
        The hospital asks, the blood bank answers, the donor decides. Command sees the city and steps in when it's under stress.
      </p>
      <ul className="mt-14 grid overflow-hidden rounded-(--radius-panel) border-t border-l border-line sm:grid-cols-2">
        {CAPABILITIES.map((c, i) => (
          <motion.li
            key={c.title}
            initial={reduced ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6, delay: (i % 2) * 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col border-r border-b border-line bg-surface p-6 sm:p-8"
          >
            <span className="text-bridge [&_svg]:size-6">{c.icon}</span>
            <h3 className="mt-4 text-xl font-semibold">{c.title}</h3>
            <p className="mt-2 flex-1 text-ink-muted">{c.body}</p>
            <Link to={c.view.to} className="focus-ring mt-5 self-start rounded-sm text-sm font-semibold text-bridge underline-offset-4 hover:underline">
              {c.view.label}
            </Link>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
