import { Outlet, useLocation } from "react-router";
import { Toaster } from "sonner";
import { RealtimeProvider } from "../lib/realtime";
import { useRouteHandle } from "./routeHandle";

/** Paths whose page should not raise realtime toasts (the stage host shows the views' own toasts). */
const QUIET_PATHS = new Set(["/", "/stage"]);

/** Root of every route: realtime connection and toasts. */
export function RootLayout() {
  const { pathname } = useLocation();
  const { theme } = useRouteHandle();
  const quiet = QUIET_PATHS.has(pathname);
  return (
    <RealtimeProvider toastFilter={quiet ? null : undefined}>
      <Outlet />
      <Toaster
        theme={theme === "command" ? "dark" : "light"}
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{ style: { fontFamily: "var(--font-sans)" } }}
      />
    </RealtimeProvider>
  );
}
