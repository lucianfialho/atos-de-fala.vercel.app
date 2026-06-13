"use client";

// HuggingFace "testar o modelo" link that fires model_test_click (docs/datalayer.md §4 Micro).
// Client component so it can carry onClick even when rendered inside server components.
import { dlPush } from "@/lib/dataLayer";

export default function ModelTestLink({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={style}
      onClick={() => dlPush({ event: "model_test_click", destination: "huggingface", link_url: href })}
    >
      {children}
    </a>
  );
}
