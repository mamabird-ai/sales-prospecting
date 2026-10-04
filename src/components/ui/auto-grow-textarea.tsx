"use client";

import * as React from "react";
import { useEffect, useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type AutoGrowTextareaProps = Omit<React.ComponentProps<"textarea">, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
};

/**
 * A textarea that grows with its text, so everything written stays visible.
 * Put it in a scroll container with `scrollbar-gutter: stable`: measuring
 * briefly shrinks it, and a scrollbar that comes and goes would change the
 * width and leave the last line hidden.
 */
function AutoGrowTextarea({ value, onChange, className, ...props }: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    // scrollHeight excludes the border, but a border-box height includes it
    const border = el.offsetHeight - el.clientHeight;
    el.style.height = `${el.scrollHeight + border}px`;
  };

  useLayoutEffect(fit, [value]);

  // Wrapping depends on width, which can still be settling on first render or
  // change with the window, so refit when the width changes
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // The observer reports once on start; -1 makes that first report refit
    let lastWidth = -1;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== lastWidth) {
        lastWidth = el.clientWidth;
        fit();
      }
    });
    observer.observe(el);
    // Text wraps differently once the web font has loaded
    void document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, []);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn("block resize-none overflow-hidden", className)}
      {...props}
    />
  );
}

export { AutoGrowTextarea };
