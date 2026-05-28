import { useDialogComposition } from "@/components/ui/dialog";
import { useComposition } from "@/hooks/useComposition";
import { cn } from "@/lib/utils";
import * as React from "react";

function Input({
  className,
  type,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  ...props
}: React.ComponentProps<"input">) {
  const dialogComposition = useDialogComposition();
  const {
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
    onKeyDown: handleKeyDown,
  } = useComposition<HTMLInputElement>({
    onKeyDown: (e) => {
      const isComposing = (e.nativeEvent as any).isComposing || dialogComposition.justEndedComposing();
      if (e.key === "Enter" && isComposing) return;
      onKeyDown?.(e);
    },
    onCompositionStart: (e) => {
      dialogComposition.setComposing(true);
      onCompositionStart?.(e);
    },
    onCompositionEnd: (e) => {
      dialogComposition.markCompositionEnd();
      setTimeout(() => { dialogComposition.setComposing(false); }, 100);
      onCompositionEnd?.(e);
    },
  });

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base
        "w-full min-w-0 h-10 px-3.5 py-2 text-sm rounded-xl",
        "bg-white/60 border border-border/60",
        "text-foreground placeholder:text-muted-foreground/60",
        "backdrop-blur-sm",
        "shadow-[0_1px_2px_oklch(0.35_0.08_290/0.04),inset_0_1px_0_oklch(1_0_0/0.8)]",
        "transition-[border-color,box-shadow] duration-150 outline-none",
        // Focus
        "focus:bg-white/80 focus:border-primary/50",
        "focus:shadow-[0_1px_2px_oklch(0.35_0.08_290/0.06),0_0_0_3px_oklch(0.55_0.1_290/0.12),inset_0_1px_0_oklch(1_0_0/0.9)]",
        // Disabled
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        // File input
        "file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        // Invalid
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className
      )}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

export { Input };
