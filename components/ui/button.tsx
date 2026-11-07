import { forwardRef, type ButtonHTMLAttributes } from "react";
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" };
export const Button = forwardRef<HTMLButtonElement, Props>(function Button({ variant = "primary", className = "", ...props }, ref) {
  return <button ref={ref} {...props} className={`button button--${variant} ${className}`} />;
});
// Small source-level button inspired by shadcn/ui; uses Alloc's prescribed design tokens.
