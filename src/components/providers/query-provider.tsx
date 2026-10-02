"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/** Client-side data cache for live widgets (polling). Server Components still fetch on the server. */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 2_000 } },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
