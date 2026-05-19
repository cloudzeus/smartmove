"use client";

import { ImageUploader } from "@/components/shared/image-uploader";

interface LogoUploadProps {
  value: string | null;
  onChange: (value: string | null) => void;
  name?: string;
  label?: string;
}

/**
 * Tenant logo uploader. Thin wrapper around the shared ImageUploader that
 * pre-configures the upload purpose / hint for branding artwork.
 */
export function LogoUpload({
  value,
  onChange,
  name = "logoUrl",
  label = "Λογότυπο",
}: LogoUploadProps) {
  return (
    <ImageUploader
      value={value}
      onChange={onChange}
      purpose="tenant-logo"
      name={name}
      label={label}
      hint="PNG, JPG, WebP, SVG · έως 5MB · ανεβαίνει στο BunnyCDN"
      preview="square"
    />
  );
}
