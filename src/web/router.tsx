import type { ComponentType } from "react";
import { createBrowserRouter } from "react-router";
import { AppShell } from "./layouts/AppShell";
import { RootLayout } from "./layouts/RootLayout";
import { RouteError, RouteLoading } from "./layouts/RouteFallbacks";
import type { RouteHandle } from "./layouts/routeHandle";

/** Route modules default-export their page component. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default });

const handle = (h: RouteHandle) => h;

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <RouteLoading />,
    children: [
      {
        index: true,
        lazy: page(() => import("./routes/landing")),
        handle: handle({ theme: "command", actor: "command", title: "Blood Bridge" }),
      },
      {
        path: "stage",
        lazy: page(() => import("./routes/stage")),
        handle: handle({ theme: "command", actor: "command", title: "Stage" }),
      },
      {
        element: <AppShell />,
        children: [
          {
            path: "hospital",
            lazy: page(() => import("./routes/hospital")),
            handle: handle({ theme: "clinical", actor: "hospital", title: "Hospital" }),
          },
          {
            path: "bank",
            lazy: page(() => import("./routes/bank")),
            handle: handle({ theme: "clinical", actor: "bank", title: "Blood bank" }),
          },
          {
            path: "donor",
            lazy: page(() => import("./routes/donor")),
            handle: handle({ theme: "clinical", actor: "donor", title: "Donor" }),
          },
          {
            path: "command",
            lazy: page(() => import("./routes/command")),
            handle: handle({ theme: "command", actor: "command", title: "Command", layout: "fill" }),
          },
          {
            path: "ledger",
            lazy: page(() => import("./routes/ledger")),
            handle: handle({ theme: "clinical", actor: "command", title: "Audit ledger" }),
          },
        ],
      },
    ],
  },
]);
