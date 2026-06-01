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

  // iOS Safari は date/time 系の input に独自のフォーム装飾（二重枠・余白）を付ける。
  // appearance を消し、値を左寄せにして枠の被りや崩れを防ぐ。
  const isDateLike =
    type === "date" || type === "time" || type === "datetime-local" || type === "month";

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base
        "w-full min-w-0 h-10 px-3.5 py-2 text-sm rounded-xl",
        "bg-input border border-border",
        "text-foreground placeholder:text-muted-foreground/50",
        "transition-[border-color,box-shadow] duration-150 outline-none",
        // Focus
        "focus:border-primary/70",
        "focus:shadow-[0_0_0_3px_oklch(0.62_0.18_220/0.15)]",
        // Disabled
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        // File input
        "file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        // Date / time (iOS) — remove native chrome that causes double borders & misalignment
        isDateLike &&
          "appearance-none [&::-webkit-date-and-time-value]:text-left [&::-webkit-date-and-time-value]:m-0 [&::-webkit-calendar-picker-indicator]:opacity-70",
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
