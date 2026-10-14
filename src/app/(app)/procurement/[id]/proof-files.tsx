"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ImageOff, LoaderCircle, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { POD_ACCEPT, POD_MAX_BYTES, POD_MAX_FILES } from "@/lib/procurement-rules";
import { refreshAfterDeliveryAction } from "../actions";

export type ProofFile = { id: string; mime: string; originalName: string };

const href = (id: string) => `/api/v1/procurement/attachments/${id}`;
const MB = 1024 * 1024;

/** One photo: a thumbnail that opens the full image, or a labelled placeholder if it can't load. */
function ProofImage({ file }: { file: ProofFile }) {
  const [failed, setFailed] = useState(false);
  return (
    <a
      href={href(file.id)}
      target="_blank"
      rel="noopener"
      title={file.originalName}
      className="block size-16 shrink-0 overflow-hidden rounded-sm border bg-muted"
    >
      {failed ? (
        <span className="flex size-full items-center justify-center text-muted-foreground">
          <ImageOff aria-hidden className="size-4" />
          <span className="sr-only">{file.originalName} (image unavailable)</span>
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- authenticated proof-of-delivery file
        <img
          src={href(file.id)}
          alt={`Proof of delivery: ${file.originalName}`}
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      )}
    </a>
  );
}

/**
 * A delivery's proof files (D-042): photos as thumbnails, PDFs as a named link with an icon. Each
 * opens in a new tab. A delivery recorded before proof was asked for says so instead.
 */
export function ProofFiles({ files }: { files: ProofFile[] }) {
  if (files.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Recorded before proof of delivery was added, so there is no file.
      </p>
    );
  const images = files.filter((f) => f.mime.startsWith("image/"));
  const documents = files.filter((f) => !f.mime.startsWith("image/"));
  return (
    <div className="flex flex-col gap-2">
      {images.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Proof photos">
          {images.map((file) => (
            <li key={file.id}>
              <ProofImage file={file} />
            </li>
          ))}
        </ul>
      )}
      {documents.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label="Proof documents">
          {documents.map((file) => (
            <li key={file.id}>
              <a
                href={href(file.id)}
                target="_blank"
                rel="noopener"
                className="inline-flex max-w-full items-center gap-1.5 text-sm underline-offset-4 hover:underline"
              >
                <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{file.originalName}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type ApiError = {
  error?: { code?: string; message?: string; details?: { message?: string }[] };
};

/**
 * Add proof files to a delivery that's already saved: how a wrong file is corrected, since proof
 * is never deleted. Choosing files uploads them.
 */
export function AddProof({ deliveryId, label }: { deliveryId: string; label: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = `add-proof-${deliveryId}-error`;

  async function upload(list: FileList | null) {
    const files = [...(list ?? [])];
    if (files.length === 0) return;
    setError(null);
    if (files.length > POD_MAX_FILES)
      return setError(
        `Attach at most ${POD_MAX_FILES} files at a time. Remove ${files.length - POD_MAX_FILES} and try again.`,
      );
    const big = files.find((f) => f.size > POD_MAX_BYTES);
    if (big)
      return setError(
        `“${big.name}” is larger than ${POD_MAX_BYTES / MB} MB. Attach a smaller photo or PDF.`,
      );

    setBusy(true);
    try {
      const body = new FormData();
      for (const file of files) body.append("files", file);
      const response = await fetch(`/api/v1/procurement/deliveries/${deliveryId}/attachments`, {
        method: "POST",
        body,
      });
      const json = (await response.json().catch(() => ({}))) as ApiError & {
        data?: { message?: string };
      };
      if (response.ok) {
        await refreshAfterDeliveryAction();
        toast.success(json.data?.message ?? "Proof file added.");
        router.refresh();
        return;
      }
      const details = (json.error?.details ?? []).flatMap((d) => (d.message ? [d.message] : []));
      setError(
        details.length
          ? details.join(" ")
          : (json.error?.message ??
              "The file couldn't be saved and nothing was changed. Try again in a moment."),
      );
    } catch {
      setError(
        "The upload didn't reach the server, so nothing was saved. Check the connection and try again.",
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <input
        ref={input}
        type="file"
        multiple
        accept={POD_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void upload(e.target.files)}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busy}
        aria-label={label}
        aria-describedby={error ? errorId : undefined}
        onClick={() => input.current?.click()}
      >
        {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <Paperclip aria-hidden />}
        {busy ? "Uploading…" : "Add a proof file"}
      </Button>
      <FieldError id={errorId} message={error} />
    </div>
  );
}
