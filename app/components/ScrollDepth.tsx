"use client";

// scroll_depth at 25/50/75/90% (docs/datalayer.md §4 Nano), once per threshold per route.
// Resets on navigation so each page gets its own depth signal.
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { dlPush } from "@/lib/dataLayer";

const STEPS = [25, 50, 75, 90];

export default function ScrollDepth() {
  const pathname = usePathname();
  const fired = useRef<Set<number>>(new Set());

  useEffect(() => {
    fired.current = new Set();
    function onScroll() {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      if (max <= 0) return;
      const pct = (doc.scrollTop / max) * 100;
      for (const s of STEPS) {
        if (pct >= s && !fired.current.has(s)) {
          fired.current.add(s);
          dlPush({ event: "scroll_depth", percent: s });
        }
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  return null;
}
