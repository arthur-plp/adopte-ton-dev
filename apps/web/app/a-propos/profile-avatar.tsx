"use client";

import { useState } from "react";
import Image from "next/image";

export function ProfileAvatar() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex size-full items-center justify-center bg-primary/10 text-5xl font-bold text-primary">
        AP
      </div>
    );
  }

  return (
    <div className="relative size-full">
      <Image
        src="https://github.com/arthur-plp.png"
        alt="Arthur Philippe"
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        className="object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
