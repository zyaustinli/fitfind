import { cn } from "@/lib/utils";

interface LoadingProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

export function Loading({ size = "md", className, text }: LoadingProps) {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2",
    lg: "w-8 h-8 border-2"
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "border-primary border-t-transparent rounded-full animate-spin",
          sizeClasses[size]
        )}
      />
      {text && (
        <span className="text-sm text-muted-foreground">{text}</span>
      )}
    </div>
  );
}

export function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse bg-muted rounded", className)} />
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <LoadingSkeleton className="aspect-square" />
      <div className="p-4 space-y-3">
        <LoadingSkeleton className="h-4 w-3/4" />
        <LoadingSkeleton className="h-3 w-1/2" />
        <div className="flex justify-between">
          <LoadingSkeleton className="h-5 w-16" />
          <LoadingSkeleton className="h-3 w-20" />
        </div>
        <div className="flex gap-2 pt-2">
          <LoadingSkeleton className="h-8 flex-1" />
          <LoadingSkeleton className="h-8 w-10" />
        </div>
      </div>
    </div>
  );
} 