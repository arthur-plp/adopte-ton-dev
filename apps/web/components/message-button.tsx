"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

type Props = {
  developerId: string;
  recruiterId: string;
  jobOfferId?: string;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
};

export function MessageButton({
  developerId,
  recruiterId,
  jobOfferId,
  label = "Envoyer un message",
  variant = "outline",
  size = "sm",
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/messaging/conversations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ developerId, recruiterId, jobOfferId }),
      });
      if (!res.ok) {
        toast.error("Impossible d'ouvrir la conversation");
        return;
      }
      const conversation = (await res.json()) as { id: string };
      router.push(`/messages?c=${conversation.id}`);
    } catch {
      toast.error("Impossible d'ouvrir la conversation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant={variant} size={size} onClick={handleClick} disabled={loading}>
      <MessageCircle className="size-4" /> {label}
    </Button>
  );
}
