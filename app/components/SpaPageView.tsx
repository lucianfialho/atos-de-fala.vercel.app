"use client";

// Fires spa_page_view on every client-side route change (docs/datalayer.md §3, §4 Nano).
// SPA navigations don't trigger a fresh pageload, so we can't rely on GTM's pageview.
// Consent is handled by Consent Mode at the GTM/GA4 layer — pushing to dataLayer is safe.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { dlPush, sectionFor } from "@/lib/dataLayer";

export default function SpaPageView() {
  const pathname = usePathname();
  useEffect(() => {
    dlPush({
      event: "spa_page_view",
      page_path: pathname,
      page_title: typeof document !== "undefined" ? document.title : "",
      section: sectionFor(pathname),
    });
  }, [pathname]);
  return null;
}
