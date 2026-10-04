"use client";

import { darkTheme, RainbowKitProvider, type Theme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useAccount, useConnect, WagmiProvider } from "wagmi";
import { Toaster } from "@/components/tx/Toaster";
import { E2E_MODE, scriptedWallet, wagmiConfig } from "@/lib/wagmi";

const base = darkTheme({
  accentColor: "#9d8cff",
  accentColorForeground: "#000000",
  borderRadius: "large",
  fontStack: "system",
  overlayBlur: "small",
});

/** RainbowKit themed from Moneta tokens (black canvas, charcoal surfaces, violet accent). */
const monetaTheme: Theme = {
  ...base,
  colors: {
    ...base.colors,
    modalBackground: "#191919",
    modalBorder: "#2e2e2e",
    generalBorder: "#2e2e2e",
    menuItemBackground: "#222222",
    profileForeground: "#191919",
    closeButtonBackground: "#222222",
    actionButtonSecondaryBackground: "#222222",
    connectButtonBackground: "#191919",
    modalText: "#ffffff",
    modalTextSecondary: "#a3a3a3",
  },
  fonts: { body: "var(--font-geist-sans), system-ui, sans-serif" },
};

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 2_000, refetchOnWindowFocus: true, retry: 2 },
        },
      }),
  );
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={monetaTheme} modalSize="compact" appInfo={{ appName: "Moneta" }}>
          {E2E_MODE && <E2EAutoConnect />}
          {children}
          <Toaster />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/** E2E builds only: connect the scripted wallet (anvil dev key) on load so Playwright drives real transactions. */
function E2EAutoConnect() {
  const { isConnected, status } = useAccount();
  const { connect, connectors } = useConnect();
  useEffect(() => {
    const wallet = connectors.find((c) => c.type === scriptedWallet.type);
    if (!isConnected && status === "disconnected" && wallet) connect({ connector: wallet });
  }, [isConnected, status, connect, connectors]);
  return null;
}
