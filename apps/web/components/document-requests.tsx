"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export type DocumentRequest = {
  id: string;
  label: string;
  note: string | null;
  source: "RECRUITER" | "DEVELOPER";
  status: "PENDING" | "FULFILLED";
  fileName: string | null;
  createdAt: string;
};

// Doit rester synchronisé avec MAX_DOCUMENT_FILE_SIZE_BYTES (@repo/contracts) —
// la vraie limite est imposée côté S3 via content-length-range, ceci n'est
// qu'un rejet anticipé côté client pour l'UX.
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_SIZE_LABEL = "10 Mo";

// Doit rester synchronisé avec ALLOWED_DOCUMENT_CONTENT_TYPES (@repo/contracts).
const ALLOWED_CONTENT_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const ACCEPT_ATTR = ".pdf,.png,.jpg,.jpeg";

// Même liste utilisée côté recruteur (demande) et côté développeur (document
// joint spontanément) — garantit un vocabulaire commun des deux côtés.
const OTHER_TYPE_OPTION = "Autre";
const DOCUMENT_TYPE_OPTIONS = [
  "CV",
  "Lettre de motivation",
  "Pièce d'identité",
  "Diplôme / certification",
  "Portfolio",
  OTHER_TYPE_OPTION,
] as const;

function DocumentRequestItem({
  request,
  apiUrl,
  role,
  readOnly,
  onUpdate,
  onRemove,
}: {
  request: DocumentRequest;
  apiUrl: string;
  role: "DEVELOPER" | "RECRUITER";
  readOnly: boolean;
  onUpdate: (updated: DocumentRequest) => void;
  onRemove: (requestId: string) => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function openFile(disposition: "inline" | "attachment") {
    const setLoading = disposition === "inline" ? setPreviewing : setDownloading;
    setLoading(true);
    try {
      const res = await fetch(
        `${apiUrl}/applications/document-requests/${request.id}/download-url?disposition=${disposition}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        toast.error("Impossible de récupérer le fichier");
        return;
      }
      const { downloadUrl } = (await res.json()) as { downloadUrl: string };
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(
        `${apiUrl}/applications/document-requests/${request.id}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        toast.error("Impossible de supprimer le document");
        return;
      }
      const result = (await res.json()) as
        | { removed: true; requestId: string }
        | DocumentRequest;
      if ("removed" in result) {
        onRemove(result.requestId);
      } else {
        onUpdate(result);
      }
      toast.success("Document supprimé");
    } finally {
      setDeleting(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`Fichier trop volumineux (max ${MAX_FILE_SIZE_LABEL})`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
      toast.error("Format non accepté (PDF, PNG ou JPEG uniquement)");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const contentType = file.type;
      const urlRes = await fetch(
        `${apiUrl}/applications/document-requests/${request.id}/upload-url`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            contentType,
            fileSize: file.size,
          }),
        },
      );
      if (!urlRes.ok) {
        toast.error("Impossible de préparer l'envoi du fichier");
        return;
      }
      const { uploadUrl, fields, fileKey } = (await urlRes.json()) as {
        uploadUrl: string;
        fields: Record<string, string>;
        fileKey: string;
      };

      // Presigned POST (pas PUT) : S3 impose la limite content-length-range
      // côté serveur via les champs de la policy — le champ "file" doit être
      // ajouté en dernier dans le FormData.
      const formData = new FormData();
      for (const [key, value] of Object.entries(fields)) {
        formData.append(key, value);
      }
      formData.append("file", file);

      const postRes = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });
      if (!postRes.ok) {
        toast.error("Échec de l'envoi du fichier (taille ou type refusé)");
        return;
      }

      const confirmRes = await fetch(
        `${apiUrl}/applications/document-requests/${request.id}/confirm`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileKey, fileName: file.name }),
        },
      );
      if (!confirmRes.ok) {
        toast.error("Échec de la confirmation du dépôt");
        return;
      }
      const updated = (await confirmRes.json()) as DocumentRequest;
      onUpdate(updated);
      toast.success("Document envoyé");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const awaitingUploadFromDeveloper =
    request.status === "PENDING" && role === "DEVELOPER";
  // Mise en avant orange réservée aux demandes du recruteur : pour un document
  // joint spontanément, l'upload est immédiat et il n'y a personne "en attente".
  const requestedByRecruiter =
    awaitingUploadFromDeveloper && request.source === "RECRUITER";

  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
        requestedByRecruiter
          ? "border-amber-500/40 bg-amber-500/10"
          : "border-border"
      }`}
    >
      <div className="min-w-0">
        <p
          className={`flex items-center gap-1.5 text-sm font-medium ${
            requestedByRecruiter
              ? "text-amber-700 dark:text-amber-400"
              : "text-foreground"
          }`}
        >
          {requestedByRecruiter ? (
            <AlertTriangle className="size-3.5 shrink-0" />
          ) : (
            <FileText className="size-3.5 shrink-0" />
          )}
          {requestedByRecruiter
            ? `Document demandé : ${request.label}`
            : request.label}
        </p>
        {request.note && (
          <p className="text-xs text-muted-foreground">{request.note}</p>
        )}
        {request.status === "FULFILLED" && request.fileName && (
          <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3" /> {request.fileName}
          </p>
        )}
        {awaitingUploadFromDeveloper && (
          <p className="text-xs text-muted-foreground">
            PDF, PNG ou JPEG — max {MAX_FILE_SIZE_LABEL}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {request.status === "FULFILLED" ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void openFile("inline")}
              disabled={previewing}
            >
              <Eye className="size-3.5" /> {previewing ? "…" : "Voir"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void openFile("attachment")}
              disabled={downloading}
            >
              <Download className="size-3.5" /> {downloading ? "…" : "Télécharger"}
            </Button>
            {role === "DEVELOPER" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={deleting}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {request.source === "DEVELOPER"
                        ? "Le fichier sera définitivement supprimé."
                        : "Le fichier sera supprimé et la demande repassera en attente : tu pourras déposer un nouveau document."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void handleDelete()}>
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        ) : role === "DEVELOPER" && !readOnly ? (
          <>
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="size-3.5" /> {uploading ? "Envoi…" : "Déposer un fichier"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTR}
              className="hidden"
              onChange={(e) => void handleFileChange(e)}
            />
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            {readOnly ? "Candidature terminée" : "En attente"}
          </span>
        )}
      </div>
    </li>
  );
}

function DocumentTypeSelect({
  value,
  onChange,
  options,
  customLabel,
  onCustomLabelChange,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  customLabel: string;
  onCustomLabelChange: (value: string) => void;
}) {
  return (
    <div className="min-w-[160px] flex-1">
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        Type de document
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-base"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {value === OTHER_TYPE_OPTION && (
        <input
          type="text"
          value={customLabel}
          onChange={(e) => onCustomLabelChange(e.target.value)}
          placeholder="Précisez le document…"
          className="input-base mt-2"
        />
      )}
    </div>
  );
}

export function DocumentRequestsPanel({
  applicationId,
  apiUrl,
  role,
  readOnly = false,
}: {
  applicationId: string;
  apiUrl: string;
  role: "DEVELOPER" | "RECRUITER";
  // Candidature terminée (acceptée/rejetée/retirée) : plus de nouvelle
  // demande ni de nouveau dépôt, mais les documents déjà fournis restent
  // consultables (voir/télécharger/supprimer).
  readOnly?: boolean;
}) {
  const [requests, setRequests] = useState<DocumentRequest[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [docType, setDocType] = useState<string>(DOCUMENT_TYPE_OPTIONS[0]);
  const [customLabel, setCustomLabel] = useState("");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch(`${apiUrl}/applications/${applicationId}/document-requests`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? (res.json() as Promise<DocumentRequest[]>) : []))
      .then(setRequests)
      .catch(() => setRequests([]));
  }, [apiUrl, applicationId]);

  function handleUpdate(updated: DocumentRequest) {
    setRequests((prev) =>
      prev ? prev.map((r) => (r.id === updated.id ? updated : r)) : prev,
    );
  }

  function handleRemove(requestId: string) {
    setRequests((prev) => (prev ? prev.filter((r) => r.id !== requestId) : prev));
  }

  const recruiterPendingCount =
    requests?.filter((r) => r.status === "PENDING" && r.source === "RECRUITER")
      .length ?? 0;

  // Empêche de proposer un type déjà utilisé (ex. deux "CV") — "Autre" reste
  // toujours disponible. Le backend revalide aussi (défense en profondeur).
  const usedLabels = new Set(
    (requests ?? []).map((r) => r.label.trim().toLowerCase()),
  );
  const availableTypeOptions = DOCUMENT_TYPE_OPTIONS.filter(
    (option) => option === OTHER_TYPE_OPTION || !usedLabels.has(option.toLowerCase()),
  );

  const effectiveLabel =
    docType === OTHER_TYPE_OPTION ? customLabel.trim() : docType;

  function resetForm() {
    setDocType(availableTypeOptions[0] ?? OTHER_TYPE_OPTION);
    setCustomLabel("");
    setNote("");
    setShowForm(false);
  }

  function openForm() {
    setDocType(availableTypeOptions[0] ?? OTHER_TYPE_OPTION);
    setShowForm(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveLabel) return;
    setCreating(true);
    try {
      const res = await fetch(
        `${apiUrl}/applications/${applicationId}/document-requests`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: effectiveLabel,
            note: role === "RECRUITER" ? note.trim() || undefined : undefined,
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        toast.error(body.message ?? "Impossible d'enregistrer le document");
        return;
      }
      const created = (await res.json()) as DocumentRequest;
      setRequests((prev) => [created, ...(prev ?? [])]);
      resetForm();
      toast.success(
        role === "RECRUITER"
          ? "Document demandé au candidat"
          : "Document ajouté à ta candidature",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mt-4">
      {recruiterPendingCount > 0 && role === "DEVELOPER" ? (
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400">
          <AlertTriangle className="size-4" />
          {recruiterPendingCount === 1
            ? "1 document demandé par le recruteur"
            : `${recruiterPendingCount} documents demandés par le recruteur`}
        </p>
      ) : (
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {role === "RECRUITER" ? "Pièces justificatives" : "Documents"}
        </p>
      )}

      {requests === null ? (
        <div className="flex justify-center py-3">
          <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : requests.length === 0 ? (
        role === "RECRUITER" && (
          <p className="text-xs text-muted-foreground">
            Aucune pièce justificative demandée pour le moment.
          </p>
        )
      ) : (
        <ul className="space-y-2">
          {requests.map((request) => (
            <DocumentRequestItem
              key={request.id}
              request={request}
              apiUrl={apiUrl}
              role={role}
              readOnly={readOnly}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
            />
          ))}
        </ul>
      )}

      {!readOnly &&
        (showForm ? (
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-muted/30 p-3"
          >
            <DocumentTypeSelect
              value={docType}
              onChange={setDocType}
              options={availableTypeOptions}
              customLabel={customLabel}
              onCustomLabelChange={setCustomLabel}
            />
            {role === "RECRUITER" && (
              <div className="min-w-[180px] flex-[2]">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Précision (optionnel)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="input-base"
                />
              </div>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={creating || !effectiveLabel}
            >
              {creating ? "…" : role === "RECRUITER" ? "Demander" : "Ajouter"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={resetForm}>
              Annuler
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={openForm}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Plus className="size-3.5" />
            {role === "RECRUITER"
              ? "Demander une pièce justificative"
              : "Joindre un document (optionnel)"}
          </button>
        ))}
    </div>
  );
}
