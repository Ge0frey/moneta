"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during SSR and hydration, true afterwards. Gate wallet-dependent UI on it: the server never knows the
 * connected account, so rendering it during hydration would mismatch the server HTML.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
