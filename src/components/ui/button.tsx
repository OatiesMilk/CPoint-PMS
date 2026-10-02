import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Hierarchy (DESIGN.md): one primary per view; secondary = outline; tertiary = ghost/link;
// destructive is never styled like primary.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium " +
    "transition-[background-color,color,box-shadow,transform] duration-(--dur-press) ease-out " +
    "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 " +
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-1 hover:bg-primary/90",
        secondary: "border border-input bg-card text-foreground hover:bg-accent",
        ghost: "text-foreground hover:bg-accent",
        destructive: "border border-destructive/40 bg-card text-destructive hover:bg-reject-soft",
        link: "text-foreground underline underline-offset-4 hover:no-underline",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-9 px-4 text-base",
        lg: "h-11 px-5 text-lg",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { buttonVariants };
