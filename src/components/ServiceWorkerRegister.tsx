"use client";

import { useEffect, useSyncExternalStore } from "react";
import { CheckCircle2, Plane, RefreshCw } from "lucide-react";

function subscribeOnlineStatus(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getServerOnlineSnapshot() {
  return true;
}

let swReadyState = false;
const swListeners = new Set<() => void>();

function setSwReadyTrue() {
  if (swReadyState) return;
  swReadyState = true;
  swListeners.forEach((listener) => listener());
}

function subscribeSwReady(callback: () => void) {
  swListeners.add(callback);
  return () => {
    swListeners.delete(callback);
  };
}

function getSwReadySnapshot() {
  return swReadyState;
}

function getServerSwReadySnapshot() {
  return false;
}

function collectStaticAssetUrls(): string[] {
  const urls = new Set<string>(["/", "/manifest.webmanifest"]);
  if (typeof document !== "undefined") {
    document.querySelectorAll("script[src], link[href]").forEach((el) => {
      const attr = el.getAttribute("src") || el.getAttribute("href");
      if (attr && attr.startsWith("/")) {
        urls.add(attr);
      }
    });
  }
  return Array.from(urls);
}

export function ServiceWorkerRegister() {
  const swReady = useSyncExternalStore(
    subscribeSwReady,
    getSwReadySnapshot,
    getServerSwReadySnapshot
  );
  const isOnline = useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineSnapshot,
    getServerOnlineSnapshot
  );

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setSwReadyTrue();
      return;
    }

    // In development (next dev), unregister any stale SW so HMR/chunks never get stale-cached
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => {});
      if ("caches" in window) {
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .catch(() => {});
      }
      setSwReadyTrue();
      return;
    }

    const markReady = (worker: ServiceWorker | null) => {
      setSwReadyTrue();
      if (worker) {
        worker.postMessage({
          type: "CACHE_ASSETS",
          urls: collectStaticAssetUrls(),
        });
      }
    };

    if (navigator.serviceWorker.controller) {
      markReady(navigator.serviceWorker.controller);
    }

    const fallbackTimer = setTimeout(() => {
      markReady(navigator.serviceWorker.controller);
    }, 1000);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        const existingWorker =
          registration.active ||
          registration.waiting ||
          navigator.serviceWorker.controller;
        if (existingWorker) {
          markReady(existingWorker);
          return;
        }

        const trackWorker = (worker: ServiceWorker | null) => {
          if (!worker) return;
          if (worker.state === "installed" || worker.state === "activated") {
            markReady(worker);
            return;
          }
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" || worker.state === "activated") {
              markReady(worker);
            }
          });
        };

        if (registration.installing) {
          trackWorker(registration.installing);
        }

        registration.addEventListener("updatefound", () => {
          trackWorker(registration.installing);
        });
      })
      .catch(() => {
        markReady(null);
      });

    return () => clearTimeout(fallbackTimer);
  }, []);

  if (!isOnline) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300"
        title="Running completely offline from local cache"
      >
        <Plane className="h-3 w-3" />
        Offline Mode
      </span>
    );
  }

  if (swReady) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300"
        title="App shell cached for Airplane Mode"
      >
        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
        Offline Ready ✓
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-zinc-400">
      <RefreshCw className="h-3 w-3 animate-spin" />
      Caching…
    </span>
  );
}
