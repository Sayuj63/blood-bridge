import { Link, isRouteErrorResponse, useRouteError } from "react-router";
import { LogoMark } from "../brand/Logo";
import { buttonVariants } from "../components/ui/Button";

/** Shown while a lazily loaded view downloads on first visit. */
export function RouteLoading() {
  return (
    <div data-theme="command" className="grid min-h-dvh place-items-center bg-canvas" aria-busy="true">
      <div className="flex flex-col items-center gap-3 text-ink-muted">
        <LogoMark size={40} className="motion-safe:animate-pulse" />
        <span className="font-label text-sm">Loading Blood Bridge…</span>
      </div>
    </div>
  );
}

/** Route-level error boundary and 404. */
export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div data-theme="command" className="grid min-h-dvh place-items-center bg-canvas px-4 text-ink">
      <div className="max-w-md text-center">
        <LogoMark size={44} className="mx-auto" />
        <h1 className="font-display mt-5 text-3xl">{notFound ? "No page here" : "This view stopped working"}</h1>
        <p className="mt-3 text-ink-muted">
          {notFound
            ? "Check the address, or go back to the start."
            : error instanceof Error
              ? error.message
              : "Reload the page. If it keeps happening, reset the demo from the stage."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/" className={buttonVariants({ variant: "primary" })}>
            Go to start
          </Link>
          <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
