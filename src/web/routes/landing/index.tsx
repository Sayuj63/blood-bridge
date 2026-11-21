import { AnswerSection } from "./AnswerSection";
import { CityStory } from "./CityStory";
import { Finale } from "./Finale";
import { Hero } from "./hero/Hero";
import { ScaleSection } from "./ScaleSection";
import { ScrambleReplay } from "./ScrambleReplay";
import { TrustSection } from "./TrustSection";

/** `/` — hero, then the problem-first scroll story: the scale, the paradox, the flood, then the answer. */
export default function LandingPage() {
  return (
    <div data-theme="landing" className="min-h-dvh overflow-x-clip bg-canvas text-ink">
      <main>
        <Hero />
        <div id="info" className="scroll-mt-4">
          <ScaleSection />
        </div>
        <CityStory />
        <ScrambleReplay />
        <AnswerSection />
        <TrustSection />
        <div id="contact" className="scroll-mt-4">
          <Finale />
        </div>
      </main>
    </div>
  );
}
