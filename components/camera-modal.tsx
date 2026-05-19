"use client";

import { useRef, useState } from "react";
import { Camera as CameraPro } from "react-camera-pro";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AlertCircle, Camera, RefreshCw } from "lucide-react";

interface CameraModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File, dataUrl: string) => void;
}

interface CameraHandle {
  takePhoto: () => string;
  switchCamera: () => string;
  getNumberOfCameras: () => number;
}

function dataUrlToFile(dataUrl: string, name: string): File {
  const [meta, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "image/jpeg";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

export function CameraModal({
  open,
  onOpenChange,
  onCapture,
}: CameraModalProps) {
  const cameraRef = useRef<CameraHandle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [numCameras, setNumCameras] = useState(0);

  function handleCapture() {
    const dataUrl = cameraRef.current?.takePhoto();
    if (!dataUrl || typeof dataUrl !== "string") {
      setError("Η λήψη απέτυχε.");
      return;
    }
    const file = dataUrlToFile(dataUrl, `capture-${Date.now()}.jpg`);
    onCapture(file, dataUrl);
    onOpenChange(false);
  }

  function handleSwitch() {
    cameraRef.current?.switchCamera();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden p-0">
        <DialogHeader className="px-4 pb-2 pt-4">
          <DialogTitle>Λήψη φωτογραφίας</DialogTitle>
          <DialogDescription>
            Τοποθέτησε τα αντικείμενα στο πλαίσιο και πάτησε λήψη.
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-[4/3] w-full bg-black">
          {open && (
            <CameraPro
              ref={cameraRef as never}
              facingMode="environment"
              aspectRatio={4 / 3}
              numberOfCamerasCallback={setNumCameras}
              errorMessages={{
                noCameraAccessible:
                  "Δεν εντοπίστηκε κάμερα. Σύνδεσε κάμερα και ξαναπροσπάθησε.",
                permissionDenied:
                  "Άρνηση πρόσβασης στην κάμερα. Δώσε άδεια από τις ρυθμίσεις του browser.",
                switchCamera:
                  "Δεν είναι δυνατή η εναλλαγή — υπάρχει μόνο μία κάμερα.",
                canvas: "Το canvas δεν υποστηρίζεται.",
              }}
            />
          )}

          {error && (
            <div className="absolute inset-x-3 bottom-3 flex items-start gap-2 rounded-md bg-destructive/90 p-2 text-xs text-destructive-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t bg-background p-3">
          <Button
            variant="outline"
            onClick={handleSwitch}
            disabled={numCameras < 2}
          >
            <RefreshCw className="mr-2 size-4" />
            Εναλλαγή
          </Button>
          <Button onClick={handleCapture}>
            <Camera className="mr-2 size-4" />
            Λήψη
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
