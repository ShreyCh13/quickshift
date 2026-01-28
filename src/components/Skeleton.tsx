"use client";

import { ReactNode } from "react";

interface SkeletonProps {
  className?: string;
  children?: ReactNode;
  style?: React.CSSProperties;
}

/**
 * Basic skeleton loading element with pulse animation.
 */
export function Skeleton({ className = "", style }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200 ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton for text content.
 */
export function SkeletonText({ width = "100%", height = "1rem" }: { width?: string; height?: string }) {
  return (
    <Skeleton
      className="rounded"
      style={{ width, height }}
    />
  );
}

/**
 * Skeleton for a card-like container.
 */
export function SkeletonCard({ className = "" }: SkeletonProps) {
  return (
    <div className={`rounded-xl border-2 border-slate-100 bg-white p-4 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  );
}

/**
 * Skeleton for vehicle card.
 */
export function VehicleCardSkeleton() {
  return (
    <div className="rounded-xl border-2 border-slate-100 bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for maintenance/inspection card.
 */
export function EventCardSkeleton() {
  return (
    <div className="rounded-xl border-2 border-slate-100 bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="text-right space-y-1">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-6" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for list of items.
 */
export function ListSkeleton({ count = 5, card = "event" }: { count?: number; card?: "event" | "vehicle" }) {
  const CardComponent = card === "vehicle" ? VehicleCardSkeleton : EventCardSkeleton;
  
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardComponent key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for filter panel.
 */
export function FilterSkeleton() {
  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <Skeleton className="mb-4 h-5 w-16" />
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      </div>
    </div>
  );
}

/**
 * Full page loading skeleton.
 */
export function PageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-14 w-full rounded-xl" />
      <FilterSkeleton />
      <ListSkeleton count={5} />
    </div>
  );
}

/**
 * Loading spinner with optional text.
 */
export function Spinner({ size = "md", text }: { size?: "sm" | "md" | "lg"; text?: string }) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div className="flex items-center justify-center gap-2">
      <svg
        className={`animate-spin text-slate-600 ${sizeClasses[size]}`}
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {text && <span className="text-sm text-slate-600">{text}</span>}
    </div>
  );
}

/**
 * Loading overlay for full sections.
 */
export function LoadingOverlay({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm font-medium text-slate-600">{text}</p>
      </div>
    </div>
  );
}

export default Skeleton;
