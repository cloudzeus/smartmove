"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  ArrowRight,
  Camera,
  Download,
  Loader2,
  Plus,
  Sparkles,
  Upload,
} from "lucide-react";

import {
  analyzeImage,
  analyzeImageByUrl,
  type FurnitureItem,
} from "@/app/actions";
import { uploadImage } from "@/server/actions/upload.action";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CameraModal } from "@/components/camera-modal";
import { cn } from "@/lib/utils";
import { ImageThumbnail, type ScanImage } from "./image-thumbnail";
import { ImageZoomViewer } from "./image-zoom-viewer";
import { stitchImages } from "./stitch";
import type { JobItem } from "./wizard-types";

const MAX_IMAGES = 4;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per source image

interface ScanToolProps {
  /** Called when user clicks "Συνέχεια" after AI analysis. */
  onContinue?: (items: JobItem[]) => void;
  /** Optional back button (e.g. when used inside a wizard). */
  onBack?: () => void;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-α-ωά-ώϊϋΐΰ]+/giu, "")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "item"
  );
}

async function cropFromImage(
  imageUrl: string,
  box: [number, number, number, number],
): Promise<string> {
  const img = new Image();
  img.src = imageUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Image load failed"));
  });
  const [ymin, xmin, ymax, xmax] = box;
  const sx = (xmin / 1000) * img.naturalWidth;
  const sy = (ymin / 1000) * img.naturalHeight;
  const sw = ((xmax - xmin) / 1000) * img.naturalWidth;
  const sh = ((ymax - ymin) / 1000) * img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

export function ScanTool({ onContinue, onBack }: ScanToolProps = {}) {
  const [images, setImages] = useState<ScanImage[]>([]);
  const [stitched, setStitched] = useState<{
    dataUrl: string;
    file: File;
    cdnUrl?: string | null;
  } | null>(null);
  const [analyzeStage, setAnalyzeStage] = useState<
    "idle" | "stitch" | "upload" | "analyze"
  >("idle");
  const [items, setItems] = useState<FurnitureItem[] | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [crops, setCrops] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalVolume = useMemo(() => {
    if (!items) return 0;
    return items.reduce(
      (sum, item, i) => (excluded.has(i) ? sum : sum + item.volume_m3),
      0,
    );
  }, [items, excluded]);

  const includedCount = items ? items.length - excluded.size : 0;
  const suggestedVehicle = suggestVehicle(totalVolume);
  const canAddMore = images.length < MAX_IMAGES;

  function addImageFromFile(file: File) {
    if (file.size > MAX_FILE_SIZE) {
      setError(`Η εικόνα ξεπερνά τα ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB.`);
      return;
    }
    const dataUrl = URL.createObjectURL(file);
    setImages((prev) => {
      if (prev.length >= MAX_IMAGES) return prev;
      return [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          dataUrl,
          rotation: 0,
        },
      ];
    });
    setStitched(null);
    setItems(null);
    setExcluded(new Set());
    setError(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const slotsLeft = MAX_IMAGES - images.length;
    for (const f of files.slice(0, slotsLeft)) addImageFromFile(f);
    e.target.value = "";
  }

  function handleCameraCapture(file: File) {
    addImageFromFile(file);
  }

  function handleRotate(id: string) {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id
          ? {
              ...img,
              rotation: (((img.rotation + 90) % 360) as 0 | 90 | 180 | 270),
            }
          : img,
      ),
    );
    setStitched(null);
    setItems(null);
  }

  function handleRemove(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id));
    setStitched(null);
    setItems(null);
  }

  function handleClearAll() {
    setImages([]);
    setStitched(null);
    setItems(null);
    setExcluded(new Set());
    setError(null);
  }

  function handleAnalyze() {
    if (images.length === 0) return;

    startTransition(async () => {
      try {
        setError(null);

        // 1. Stitch (client-side panorama)
        setAnalyzeStage("stitch");
        const stitch = await stitchImages(images, { targetHeight: 1024 });
        setStitched({ dataUrl: stitch.dataUrl, file: stitch.file });

        // 2. Try to upload to BunnyCDN — faster + permanent URL.
        //    If upload fails (no BunnyCDN, network), fall back to FormData path.
        setAnalyzeStage("upload");
        let cdnUrl: string | null = null;
        try {
          const fd = new FormData();
          fd.append("file", stitch.file);
          fd.append("purpose", "scan-stitched");
          const uploadRes = await uploadImage(fd);
          if (uploadRes.ok) {
            cdnUrl = uploadRes.url;
            setStitched({
              dataUrl: stitch.dataUrl,
              file: stitch.file,
              cdnUrl,
            });
          }
        } catch (e) {
          // non-fatal — we'll fall back below
          console.warn("[scan] Bunny upload skipped:", e);
        }

        // 3. Analyze (URL path preferred, FormData fallback)
        setAnalyzeStage("analyze");
        const result = cdnUrl
          ? await analyzeImageByUrl(cdnUrl)
          : await analyzeImage(formDataFromFile(stitch.file));

        if (result.error) {
          setError(result.error);
          setItems(null);
          return;
        }
        if (result.items.length === 0) {
          setError(
            "Δεν εντοπίστηκαν έπιπλα ή κουτιά. Δοκίμασε με καλύτερο φωτισμό.",
          );
          setItems(null);
          return;
        }

        setItems(result.items);
        setExcluded(new Set());

        // Generate crops in parallel
        const cropResults = await Promise.all(
          result.items.map((item) =>
            cropFromImage(stitch.dataUrl, item.box_2d).catch(() => ""),
          ),
        );
        setCrops(cropResults);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Κάτι πήγε στραβά κατά την ανάλυση.",
        );
      } finally {
        setAnalyzeStage("idle");
      }
    });
  }

  function formDataFromFile(file: File): FormData {
    const fd = new FormData();
    fd.append("image", file);
    return fd;
  }

  function toggleExclude(index: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function downloadCrop(index: number) {
    const url = crops[index];
    if (!url || !items) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${String(index + 1).padStart(2, "0")}-${slugify(items[index].name)}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function downloadAll() {
    if (!items) return;
    items.forEach((_, i) => {
      if (excluded.has(i)) return;
      setTimeout(() => downloadCrop(i), i * 150);
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ανέβασε εικόνες</CardTitle>
          <CardDescription>
            Έως {MAX_IMAGES} φωτογραφίες — τις συγχωνεύουμε αυτόματα σε μία
            πανοραμική εικόνα για ακριβέστερη εκτίμηση. Περιστροφή 90° με το
            κουμπί ↻ σε κάθε thumbnail.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Image gallery */}
          {images.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {images.map((img, i) => (
                  <ImageThumbnail
                    key={img.id}
                    image={img}
                    index={i}
                    onRotate={handleRotate}
                    onRemove={handleRemove}
                  />
                ))}
                {canAddMore && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="grid aspect-square w-full place-items-center rounded-xl border-2 border-dashed border-border bg-secondary/40 text-muted-foreground transition-colors hover:border-[var(--color-brand-blue)]/50 hover:bg-[var(--color-brand-blue-light)] hover:text-[var(--color-brand-blue-deep)]"
                    title="Προσθήκη εικόνας"
                  >
                    <span className="flex flex-col items-center gap-1.5">
                      <span className="grid size-10 place-items-center rounded-full bg-white text-foreground shadow-sm">
                        <Plus className="size-5" />
                      </span>
                      <span className="text-xs font-medium">
                        {images.length}/{MAX_IMAGES}
                      </span>
                    </span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  {images.length} {images.length === 1 ? "φωτογραφία" : "φωτογραφίες"}{" "}
                  · χωρητικότητα {MAX_IMAGES}
                </span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-destructive transition-colors hover:underline"
                >
                  Καθαρισμός όλων
                </button>
              </div>
            </>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-11 w-full text-sm"
              onClick={() => setCameraOpen(true)}
              disabled={isPending || !canAddMore}
            >
              <Camera className="mr-2 size-4" />
              {images.length === 0 ? "Φωτογραφία" : "Νέα φωτογραφία"}
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full text-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending || !canAddMore}
            >
              <Upload className="mr-2 size-4" />
              Ανέβασμα {!canAddMore && "(γεμάτο)"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <Button
            className="h-12 w-full text-base shadow-[var(--shadow-cta)]"
            disabled={isPending || images.length === 0}
            onClick={handleAnalyze}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {analyzeStage === "stitch"
                  ? "Συγχώνευση φωτογραφιών…"
                  : analyzeStage === "upload"
                    ? "Ανέβασμα στο CDN…"
                    : analyzeStage === "analyze"
                      ? "Ανάλυση με AI…"
                      : "Επεξεργασία…"}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" />
                {images.length > 1
                  ? `Συγχώνευσε ${images.length} φωτογραφίες & υπολόγισε όγκο`
                  : "Υπολογισμός όγκου"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {stitched && items && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Πανοραμική προβολή</CardTitle>
            <CardDescription>
              Roll mouse για μεγέθυνση, drag για μετακίνηση. Πάτα ένα αντικείμενο
              για εξαίρεση από το σύνολο.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImageZoomViewer
              src={stitched.dataUrl}
              items={items}
              excluded={excluded}
              onToggle={toggleExclude}
              className="aspect-[16/9] max-h-[640px]"
            />
          </CardContent>
        </Card>
      )}

      {items && items.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">
                Αναφορά όγκου μεταφοράς
              </CardTitle>
              <CardDescription>
                {includedCount} από {items.length} αντικείμενα στο σύνολο
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadAll}
              disabled={includedCount === 0 || crops.length === 0}
            >
              <Download className="mr-2 size-4" />
              Όλες οι εικόνες
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item, i) => {
                const isExcluded = excluded.has(i);
                const crop = crops[i];
                return (
                  <li key={i}>
                    <article
                      className={cn(
                        "group flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)] transition-all",
                        isExcluded
                          ? "border-dashed border-muted-foreground/40 opacity-60"
                          : "border-border hover:border-[var(--color-brand-blue)]/40 hover:shadow-[var(--shadow-pop)]",
                      )}
                    >
                      {/* Larger crop image */}
                      <button
                        type="button"
                        onClick={() => toggleExclude(i)}
                        className="relative block aspect-[4/3] w-full overflow-hidden bg-muted"
                        title={
                          isExcluded
                            ? `Επανένταξη: "${item.name}"`
                            : `Εξαίρεση: "${item.name}"`
                        }
                      >
                        {crop ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={crop}
                            alt={item.name}
                            className="size-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="size-full animate-pulse bg-muted" />
                        )}
                        <span className="absolute left-2 top-2 rounded-md bg-foreground/85 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          #{i + 1}
                        </span>
                        {isExcluded && (
                          <span className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-sm">
                            <span className="rounded-full bg-foreground/80 px-3 py-1 text-xs font-bold text-white">
                              Εξαιρείται
                            </span>
                          </span>
                        )}
                      </button>

                      <div className="flex flex-1 flex-col gap-3 p-4">
                        <h3
                          className={cn(
                            "font-display text-base font-semibold leading-snug",
                            isExcluded
                              ? "text-muted-foreground line-through"
                              : "text-foreground",
                          )}
                        >
                          {item.name}
                        </h3>

                        <dl className="grid grid-cols-3 gap-1.5 text-center text-xs">
                          <div className="rounded-lg bg-secondary/60 px-2 py-1.5">
                            <dt className="text-[10px] uppercase text-muted-foreground">
                              Μήκος
                            </dt>
                            <dd className="font-semibold text-foreground">
                              {item.length_cm}cm
                            </dd>
                          </div>
                          <div className="rounded-lg bg-secondary/60 px-2 py-1.5">
                            <dt className="text-[10px] uppercase text-muted-foreground">
                              Πλάτος
                            </dt>
                            <dd className="font-semibold text-foreground">
                              {item.width_cm}cm
                            </dd>
                          </div>
                          <div className="rounded-lg bg-secondary/60 px-2 py-1.5">
                            <dt className="text-[10px] uppercase text-muted-foreground">
                              Ύψος
                            </dt>
                            <dd className="font-semibold text-foreground">
                              {item.height_cm}cm
                            </dd>
                          </div>
                        </dl>

                        <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
                          <span className="flex items-baseline gap-1">
                            <span className="font-display text-lg font-bold text-foreground">
                              {item.volume_m3.toFixed(3)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              m³
                            </span>
                          </span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadCrop(i);
                              }}
                              disabled={!crop}
                              title="Αποθήκευση"
                            >
                              <Download className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExclude(i);
                              }}
                              className="text-xs"
                            >
                              {isExcluded ? "Επανένταξη" : "Εξαίρεση"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-gradient-to-br from-[var(--color-brand-blue-light)] to-card p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Συνολικός όγκος
                </p>
                <p className="font-display text-3xl font-bold text-[var(--color-brand-blue-deep)]">
                  {totalVolume.toFixed(3)} m³
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Προτεινόμενο όχημα:{" "}
                  <span className="font-semibold text-foreground">
                    {suggestedVehicle}
                  </span>
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                {onBack && (
                  <Button
                    variant="ghost"
                    className="h-12 text-sm sm:px-4"
                    onClick={onBack}
                  >
                    Πίσω
                  </Button>
                )}
                <Button
                  className="h-12 text-base shadow-[var(--shadow-cta)] sm:px-6"
                  onClick={() => {
                    if (!items || !onContinue) return;
                    const jobItems: JobItem[] = items
                      .filter((_, i) => !excluded.has(i))
                      .map((it, idx) => ({
                        id: `ai-${idx}-${Date.now()}`,
                        name: it.name,
                        quantity: 1,
                        length_cm: it.length_cm,
                        width_cm: it.width_cm,
                        height_cm: it.height_cm,
                        volume_m3: it.volume_m3,
                        source: "ai",
                        photoDataUrl: crops[idx] || undefined,
                      }));
                    onContinue(jobItems);
                  }}
                  disabled={includedCount === 0}
                >
                  Συνέχεια με {includedCount} αντικείμενα
                  <ArrowRight className="ml-1 size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <CameraModal
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={handleCameraCapture}
      />
    </div>
  );
}

function suggestVehicle(volumeCubicM: number): string {
  if (volumeCubicM === 0) return "—";
  if (volumeCubicM <= 4) return "Μικρό βαν (έως 4 m³)";
  if (volumeCubicM <= 12) return "Βαν 3.5T (έως 12 m³)";
  if (volumeCubicM <= 22) return "Φορτηγό 5T (έως 22 m³)";
  if (volumeCubicM <= 35) return "Φορτηγό 7.5T (έως 35 m³)";
  return "Φορτηγό 12T (35+ m³)";
}
