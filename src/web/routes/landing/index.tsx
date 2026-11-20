import { Play } from "lucide-react";
import { Link } from "react-router";
import { Logo } from "../../brand/Logo";
import { LinkButton } from "../../components/ui/Button";
import { SimulatedBadge } from "../../components/ui/SimulatedBadge";
import { AnswerSection } from "./AnswerSection";
import { CityStory } from "./CityStory";
import { ColdOpen } from "./ColdOpen";
import { Finale } from "./Finale";
import { ScaleSection } from "./ScaleSection";
import { ScrambleReplay } from "./ScrambleReplay";
import { TrustSection } from "./TrustSection";

/** `/` — problem-first scroll story: the night, the scale, the paradox, the flood, then the answer. */
export default function LandingPage() {
  return (
    <div data-theme="command" className="min-h-dvh overflow-x-clip bg-canvas text-ink">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-line/60 bg-canvas/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-8">
          <Link to="/" className="focus-ring rounded-md" aria-label="Blood Bridge home">
            <Logo size={26} />
          </Link>
          <div className="flex-1" />
          <span className="sm:hidden">
            <SimulatedBadge compact />
          </span>
          <span className="hidden sm:inline-flex">
            <SimulatedBadge />
          </span>
          <LinkButton to="/stage" variant="primary" size="sm" icon={<Play className="size-3.5" aria-hidden />}>
            <span className="hidden sm:inline">Live demo</span>
            <span className="sm:hidden">Demo</span>
          </LinkButton>
        </div>
      </header>
      <main>
        <ColdOpen />
        <ScaleSection />
        <CityStory />
        <ScrambleReplay />
        <AnswerSection />
        <TrustSection />
        <Finale />
      </main>
    </div>
  );
}
