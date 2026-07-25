import { forwardRef } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost";

// Boutons brutalistes : carrés, francs, sans ombre. Mouvement sobre.
const base =
  "inline-flex items-center justify-center gap-2 min-h-[3rem] px-7 text-[0.95rem] font-semibold tracking-tight " +
  "rounded-none transition-colors duration-200 select-none active:translate-y-px disabled:opacity-45 disabled:pointer-events-none";

const styles: Record<Variant, string> = {
  primary:
    "bg-ink text-paper hover:bg-anthracite",
  secondary:
    "border border-ink text-ink hover:bg-ink hover:text-paper",
  ghost:
    "text-ink-soft hover:text-ink underline-offset-4 hover:underline px-0 min-h-0",
};

interface CommonProps {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}

type ButtonProps = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = "primary", className = "", children, ...props }, ref) {
    return (
      <button
        ref={ref}
        className={`${base} ${styles[variant]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

type LinkButtonProps = CommonProps &
  Omit<React.ComponentProps<typeof Link>, "className">;

export function LinkButton({
  variant = "primary",
  className = "",
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link className={`${base} ${styles[variant]} ${className}`} {...props}>
      {children}
    </Link>
  );
}
