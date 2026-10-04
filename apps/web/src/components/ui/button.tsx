import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Buttons. Pill shape; white = marketing CTA, violet = anything that opens the wallet. */
export const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap select-none transition-[background-color,border-color,color,opacity,transform] duration-150 ease-[var(--ease-standard)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-fg-inverse hover:bg-primary-hover",
        accent: "bg-accent text-fg-inverse hover:bg-accent-hover active:bg-accent-active",
        secondary: "border border-line-contrast text-fg hover:bg-white/[0.08]",
        tertiary: "border border-line bg-surface-1 text-fg hover:bg-surface-2",
        pass: "bg-pass text-fg-inverse hover:brightness-110",
        fail: "bg-fail text-fg-inverse hover:brightness-110",
        ghost: "text-fg-2 hover:text-fg hover:bg-white/[0.06]",
        link: "mono-sm rounded-none px-0 text-fg-2 underline-offset-[3px] hover:text-fg hover:underline",
      },
      size: {
        sm: "h-8 px-3.5 body-sm",
        md: "h-10 px-5 body-sm",
        lg: "h-12 px-6 text-[15px]",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild, loading, children, disabled, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="invisible inline-flex items-center gap-2">{children}</span>
          <span
            className="absolute inset-0 grid place-items-center mono-sm tracking-[0.3em]"
            aria-label="Loading"
          >
            ···
          </span>
        </>
      ) : (
        children
      )}
    </Comp>
  );
});
