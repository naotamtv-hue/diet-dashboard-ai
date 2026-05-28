import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium",
    "transition-all duration-150 ease-out",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
    "outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1",
    "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
    "active:scale-[0.97]",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-primary text-primary-foreground rounded-lg",
          "shadow-[0_1px_2px_oklch(0.35_0.08_290/0.15),0_3px_8px_oklch(0.35_0.08_290/0.12)]",
          "hover:bg-primary/92 hover:shadow-[0_2px_4px_oklch(0.35_0.08_290/0.18),0_6px_16px_oklch(0.35_0.08_290/0.14)]",
        ].join(" "),
        destructive: [
          "bg-destructive text-white rounded-lg",
          "shadow-[0_1px_2px_oklch(0.577_0.245_27/0.2)]",
          "hover:bg-destructive/90",
        ].join(" "),
        outline: [
          "border border-border/70 bg-white/50 text-foreground rounded-lg",
          "shadow-[0_1px_2px_oklch(0.35_0.08_290/0.06)]",
          "hover:bg-white/80 hover:border-border",
          "backdrop-blur-sm",
        ].join(" "),
        secondary: [
          "bg-secondary text-secondary-foreground rounded-lg",
          "shadow-[0_1px_2px_oklch(0.35_0.08_290/0.06)]",
          "hover:bg-secondary/80",
        ].join(" "),
        ghost: "hover:bg-primary/8 rounded-lg text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-11 rounded-xl px-7 text-sm has-[>svg]:px-5",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
