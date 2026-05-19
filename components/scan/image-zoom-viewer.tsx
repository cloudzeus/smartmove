"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minus, Move, Plus, RotateCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { FurnitureItem } from "@/app/actions";

interface ImageZoomViewerProps {
  src: string;
  items?: FurnitureItem[];
  excluded?: Set<number>;
  onToggle?: (index: number) => void;
  /** Optional class for the outer container (controls aspect / max height). */
  className?: string;
}

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const STEP = 0.25;

/**
 * Pannable + zoomable image surface for the scan tool.
 * - Wheel = zoom centered on cursor (like a map)
 * - Drag = pan when zoomed in
 * - Bounding boxes are positioned in the same transformed space, so clicks
 *   still hit the correct item.
 */
export function ImageZoomViewer({
  src,
  items,
  excluded,
  onToggle,
  className,
}: ImageZoomViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startTx: number;
    startTy: number;
    moved: boolean;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    startTx: 0,
    startTy: 0,
    moved: false,
  });

  const clampPan = useCallback((newTx: number, newTy: number, s: number) => {
    const el = containerRef.current;
    if (!el) return { x: newTx, y: newTy };
    const w = el.clientWidth;
    const h = el.clientHeight;
    const overflowX = (w * (s - 1)) / 2;
    const overflowY = (h * (s - 1)) / 2;
    return {
      x: Math.max(-overflowX, Math.min(overflowX, newTx)),
      y: Math.max(-overflowY, Math.min(overflowY, newTy)),
    };
  }, []);

  const reset = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  // Wheel zoom centered on cursor
  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      const direction = e.deltaY < 0 ? 1 : -1;
      const factor = 1 + direction * 0.15;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor));
      if (newScale === scale) return;

      // Keep the cursor point stable: t' = (1 - newScale/oldScale)*c + t*(newScale/oldScale)
      const ratio = newScale / scale;
      const nextTx = (1 - ratio) * cx + tx * ratio;
      const nextTy = (1 - ratio) * cy + ty * ratio;
      const { x, y } = clampPan(nextTx, nextTy, newScale);
      setScale(newScale);
      setTx(x);
      setTy(y);
    },
    [scale, tx, ty, clampPan],
  );

  // Block native zoom (passive listener fix)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // Pan handlers
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (scale <= 1) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        startTx: tx,
        startTy: ty,
        moved: false,
      };
    },
    [scale, tx, ty],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d.active) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      const { x, y } = clampPan(d.startTx + dx, d.startTy + dy, scale);
      setTx(x);
      setTy(y);
    },
    [scale, clampPan],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const wasDrag = dragRef.current.moved;
      dragRef.current.active = false;
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      if (wasDrag) {
        // Swallow the next click that bubbles up from the drag end
        e.stopPropagation();
      }
    },
    [],
  );

  // Reset position if scale drops back to 1
  useEffect(() => {
    if (scale === 1 && (tx !== 0 || ty !== 0)) {
      setTx(0);
      setTy(0);
    }
  }, [scale, tx, ty]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={cn(
          "relative w-full overflow-hidden rounded-2xl border bg-muted select-none",
          scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
          className,
        )}
        style={{ touchAction: "none" }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="relative h-full w-full origin-center transition-transform duration-75 ease-out"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="Εικόνα για ανάλυση"
            className="block h-full w-full select-none object-contain"
            draggable={false}
          />

          {items?.map((item, i) => {
            const [ymin, xmin, ymax, xmax] = item.box_2d ?? [0, 0, 0, 0];
            const top = (ymin / 1000) * 100;
            const left = (xmin / 1000) * 100;
            const height = ((ymax - ymin) / 1000) * 100;
            const width = ((xmax - xmin) / 1000) * 100;
            const isExcluded = excluded?.has(i) ?? false;
            return (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  if (dragRef.current.moved) {
                    e.preventDefault();
                    return;
                  }
                  onToggle?.(i);
                }}
                title={
                  isExcluded
                    ? `Επανένταξη: "${item.name}"`
                    : `Εξαίρεση: "${item.name}"`
                }
                className={cn(
                  "absolute flex items-start justify-start rounded-md border-2 transition-all",
                  isExcluded
                    ? "border-dashed border-muted-foreground/60 bg-background/30"
                    : "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue)]/15 hover:bg-[var(--color-brand-blue)]/25",
                )}
                style={{
                  top: `${top}%`,
                  left: `${left}%`,
                  width: `${width}%`,
                  height: `${height}%`,
                }}
              >
                <span
                  className={cn(
                    "max-w-full truncate rounded-br-md rounded-tl-sm px-1.5 py-0.5 text-xs font-semibold shadow-sm sm:text-sm",
                    isExcluded
                      ? "bg-muted text-muted-foreground line-through"
                      : "bg-[var(--color-brand-blue)] text-white",
                  )}
                  style={{
                    transform: `scale(${1 / Math.max(scale, 1)})`,
                    transformOrigin: "top left",
                  }}
                >
                  {i + 1}. {item.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-white/95 px-2 py-1 shadow-[var(--shadow-card)] backdrop-blur">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              const ns = Math.max(MIN_SCALE, scale - STEP);
              const { x, y } = clampPan(tx, ty, ns);
              setScale(ns);
              setTx(x);
              setTy(y);
            }}
            disabled={scale <= MIN_SCALE}
            title="Σμίκρυνση"
          >
            <Minus className="size-3.5" />
          </Button>
          <span className="min-w-[3.5rem] text-center text-xs font-semibold text-foreground tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              const ns = Math.min(MAX_SCALE, scale + STEP);
              const { x, y } = clampPan(tx, ty, ns);
              setScale(ns);
              setTx(x);
              setTy(y);
            }}
            disabled={scale >= MAX_SCALE}
            title="Μεγέθυνση"
          >
            <Plus className="size-3.5" />
          </Button>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={reset}
            disabled={scale === 1 && tx === 0 && ty === 0}
            title="Επαναφορά"
          >
            <Maximize2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Hint */}
      <div className="pointer-events-none absolute right-3 top-3 hidden items-center gap-1 rounded-full bg-foreground/80 px-2.5 py-1 text-[10px] font-medium text-white shadow-sm sm:flex">
        <Move className="size-3" />
        Roll mouse για zoom · drag για μετακίνηση
      </div>

      {/* Mute icon (just decoration to imply rotation source) */}
      <span className="sr-only">
        <RotateCw />
      </span>
    </div>
  );
}
