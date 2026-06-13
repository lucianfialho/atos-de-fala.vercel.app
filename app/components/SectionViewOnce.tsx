"use client";

// Fires section_view once when a main section scrolls into view (docs/datalayer.md §4 Nano).
// Used for the landing "participar" section (conversion intent); route-level sections
// (anotar/sobre/painel) are covered by SpaPageView.
import { useEffect, useRef } from "react";
import { dlPush } from "@/lib/dataLayer";

export default function SectionViewOnce({ section }: { section: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !fired.current) {
          fired.current = true;
          dlPush({ event: "section_view", section });
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [section]);

  return <span ref={ref} aria-hidden style={{ display: "block", height: 0 }} />;
}
