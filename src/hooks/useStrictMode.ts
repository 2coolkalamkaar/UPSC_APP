import { useEffect, useState, useSyncExternalStore } from "react";

const KEY = "neeti:strict-mode";

function subscribe(cb: () => void) {
  const handler = () => cb();
  window.addEventListener("storage", handler);
  window.addEventListener("neeti-strict-change", handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("neeti-strict-change", handler);
  };
}

function getSnapshot() {
  return window.localStorage.getItem(KEY) === "1";
}

function getServerSnapshot() {
  return false;
}

export function useStrictMode(): [boolean, (v: boolean) => void] {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const set = (v: boolean) => {
    window.localStorage.setItem(KEY, v ? "1" : "0");
    window.dispatchEvent(new Event("neeti-strict-change"));
  };
  return [value, set];
}

// Non-hook helper for imperative code paths.
export function readStrictMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}

// Avoid unused import warning when React strict mode is applied.
void useEffect;
void useState;