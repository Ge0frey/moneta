"use client";

import { create } from "zustand";

/** Transaction activity center. */
export type ToastState =
  "signing" | "pending" | "confirmed" | "final" | "reverted" | "error" | "info";

export type Toast = {
  id: string;
  state: ToastState;
  title: string;
  detail?: string;
  hash?: `0x${string}`;
};

type Store = {
  toasts: Toast[];
  push: (t: Omit<Toast, "id"> & { id?: string }) => string;
  update: (id: string, patch: Partial<Toast>) => void;
  dismiss: (id: string) => void;
};

let seq = 0;

export const useToasts = create<Store>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = t.id ?? `t${++seq}`;
    set({ toasts: [...get().toasts.filter((x) => x.id !== id), { ...t, id }].slice(-4) });
    return id;
  },
  update: (id, patch) =>
    set({ toasts: get().toasts.map((t) => (t.id === id ? { ...t, ...patch } : t)) }),
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
