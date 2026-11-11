/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
}

/** Plain <img> so any backend-provided image host works without next/image domain config. */
export function ProductImage({ src, alt, className, imgClassName }: Props) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  return (
    <div className={cn("relative overflow-hidden bg-gradient-to-br from-brand-100 via-cream-200 to-brand-50", className)}>
      {showFallback ? (
        <div className="flex h-full w-full items-center justify-center text-brand-300">
          <ImageOff className="h-8 w-8" aria-hidden />
          <span className="sr-only">{alt}</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn("h-full w-full object-cover", imgClassName)}
        />
      )}
    </div>
  );
}
