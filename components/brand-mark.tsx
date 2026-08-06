import { cn } from "@/lib/utils";

type BrandMarkProps = {
  inverse?: boolean;
  compact?: boolean;
  className?: string;
};

export function BrandMark({
  inverse = false,
  compact = false,
  className,
}: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "grid size-11 place-items-center rounded-xl border font-heading text-xl font-bold",
          inverse
            ? "border-ticket/40 bg-ticket text-primary-foreground"
            : "border-primary/40 bg-primary text-primary-foreground",
        )}
      >
        G
      </span>
      <span className="min-w-0">
        <span className="block font-heading text-xl leading-none font-semibold tracking-tight">
          Glutong
        </span>
        {!compact && (
          <span
            className={cn(
              "mt-1 block font-mono text-xs tracking-widest uppercase",
              inverse ? "text-white/65" : "text-muted-foreground",
            )}
          >
            Point of service
          </span>
        )}
      </span>
    </div>
  );
}
