"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Props = {
  targetType: "profile" | "job";
  targetId: string;
};

export function ReportDialog({ targetType, targetId }: Props) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (reason.trim().length < 3) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetType, targetId, reason: reason.trim() }),
      });
      if (!res.ok) {
        toast.error("Impossible d'envoyer le signalement.");
        return;
      }
      toast.success("Signalement envoyé, merci.");
      setReason("");
      setOpen(false);
    } catch {
      toast.error("Impossible d'envoyer le signalement.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Flag className="size-3.5" />
          Signaler
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Signaler ce contenu</AlertDialogTitle>
          <AlertDialogDescription>
            Expliquez brièvement le motif du signalement. Un administrateur examinera votre demande.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <textarea
          className="input-base min-h-24 resize-none"
          placeholder="Décrivez le problème…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={submitting}
        />

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={submitting || reason.trim().length < 3}
          >
            {submitting ? "Envoi…" : "Envoyer le signalement"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
