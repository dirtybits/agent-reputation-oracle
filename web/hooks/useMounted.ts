"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
