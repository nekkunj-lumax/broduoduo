"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Don't hammer on client errors.
          if (isAxiosError(error) && error.response && error.response.status < 500) return false;
          return failureCount < 2;
        },
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <CartProvider>
          {children}
          <Toaster
            position="top-center"
            richColors
            toastOptions={{ className: "!rounded-2xl !font-sans" }}
          />
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
