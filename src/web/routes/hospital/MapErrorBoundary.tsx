import { MapPin } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackSubtitle?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Isolates WebGL2 / MapLibre failures (e.g. GPU-disabled browsers or IDE preview panes)
 * so the rest of the Hospital View (charts, search results, forms, tracking) keeps working.
 */
export class MapErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Handled gracefully by the fallback surface below.
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-48 flex-col items-center justify-center bg-[#FAF9F6] p-6 text-center">
          <span className="grid size-10 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]" aria-hidden>
            <MapPin className="size-5" />
          </span>
          <p className="mt-3 text-sm font-semibold text-[#171717]">
            {this.props.fallbackTitle ?? "Interactive map unavailable in this browser context"}
          </p>
          <p className="mt-1 max-w-xs text-xs text-[#737373]">
            {this.props.fallbackSubtitle ??
              "WebGL2 is disabled or unavailable here. All ranked blood banks, ETAs, routes, and reservation actions remain fully active alongside."}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
