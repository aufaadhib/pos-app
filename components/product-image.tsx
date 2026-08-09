"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

import { getProductMonogram } from "@/lib/catalog/normalization";
import { cn } from "@/lib/utils";

type ProductImageProps = {
  imageUrl: string | null;
  name: string;
  positionX: number;
  positionY: number;
  sizes: string;
  loading?: ImageProps["loading"];
  className?: string;
  fallbackClassName?: string;
};

/** Renders a stable product image slot and resets its failure fallback when the URL changes. */
export function ProductImage(props: ProductImageProps) {
  return <ProductImageSource key={props.imageUrl ?? "monogram"} {...props} />;
}

/** Uses next/image for a stored cover and falls back to the product monogram on load failure. */
function ProductImageSource({
  className,
  fallbackClassName,
  imageUrl,
  loading,
  name,
  positionX,
  positionY,
  sizes,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={cn("relative block shrink-0 overflow-hidden", className)}>
      {imageUrl && !failed ? (
        <Image
          alt={`Foto produk ${name}`}
          className="object-cover"
          fill
          loading={loading}
          onError={() => setFailed(true)}
          quality={95}
          sizes={sizes}
          src={imageUrl}
          style={{ objectPosition: `${positionX}% ${positionY}%` }}
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "grid size-full place-items-center bg-accent font-heading font-bold text-accent-foreground",
            fallbackClassName,
          )}
        >
          {getProductMonogram(name)}
        </span>
      )}
    </span>
  );
}
