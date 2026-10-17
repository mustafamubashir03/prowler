import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 isolate items-center justify-center overflow-hidden rounded-none border border-transparent bg-clip-padding text-xs font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground [--btn-label:var(--primary)] [--btn-sweep:var(--primary-foreground)]",
        outline:
          "border-control bg-background text-foreground hover:bg-muted aria-expanded:bg-muted aria-expanded:text-foreground dark:bg-transparent dark:hover:bg-input/50 [--btn-label:var(--background)] [--btn-sweep:var(--foreground)]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground [--btn-label:var(--secondary)] [--btn-sweep:var(--secondary-foreground)]",
        ghost:
          "text-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50 [--btn-label:var(--foreground)] [--btn-sweep:var(--muted)]",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40 [--btn-label:var(--background)] [--btn-sweep:var(--destructive)]",
        link: "text-primary underline-offset-4 hover:underline [--btn-label:var(--primary)] [--btn-sweep:transparent]",
      },
    size: {
        default:
          "h-10 gap-2 px-4 text-[13px] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-8 gap-1 rounded-none px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        sm: "h-9 gap-1.5 rounded-none px-3.5 text-[13px] has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        lg: "h-12 gap-2 px-6 text-sm has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-10",
        "icon-xs": "size-8 rounded-none [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 rounded-none",
        "icon-lg": "size-11 rounded-none",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * Hover sweep: a square grows out of the top-left corner to fill the button,
 * inverting the fill and label. The sweep colour and the hover label colour are
 * per-variant custom properties (`--btn-sweep` / `--btn-label`) so every variant
 * stays on the theme tokens instead of hardcoded values.
 *
 * `isolate` plus a negative z-index keeps the sweep pinned between the button's
 * own background and its label. Raising the label with `[&>*]:z-10` does not work
 * here because plain text nodes are not elements, so a positioned pseudo-element
 * would paint straight over the label once the square fills the button.
 */
const sweepClasses =
  "after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:origin-top-left after:scale-0 after:bg-[var(--btn-sweep)] after:content-[''] after:transition-transform after:duration-[420ms] after:ease-[var(--ease-out-strong)] hover:after:scale-100 focus-visible:after:scale-0 disabled:after:scale-0 motion-reduce:after:transition-none motion-reduce:after:scale-100 hover:text-[var(--btn-label)] focus-visible:text-[var(--btn-label)]"

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }), sweepClasses)}
      {...props}
    />
  )
}

export { Button, buttonVariants }
