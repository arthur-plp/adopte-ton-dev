"use client";

import { useState } from "react";

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
    <img
      src="https://github.com/arthur-plp.png"
      alt="Arthur Philippe"
      className="size-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}
