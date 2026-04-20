"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  variant?: "mark" | "horizontal";
  className?: string;
  imageClassName?: string;
  priority?: boolean;
};

const assets = {
  mark: {
    src: "/brand/logo-mark.png",
    width: 231,
    height: 130,
    alt: "ProcureChain logo mark",
  },
  horizontal: {
    src: "/brand/logo-horizontal.png",
    width: 466,
    height: 72,
    alt: "ProcureChain",
  },
} as const;

export function BrandLogo({
  variant = "horizontal",
  className,
  imageClassName,
  priority = false,
}: BrandLogoProps) {
  const asset = assets[variant];

  return (
    <div className={cn("flex items-center", className)}>
      <Image
        src={asset.src}
        alt={asset.alt}
        width={asset.width}
        height={asset.height}
        priority={priority}
        className={cn("h-auto w-full object-contain", imageClassName)}
      />
    </div>
  );
}
