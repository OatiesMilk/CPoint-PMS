"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, QrCode, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cameraProblemFor,
  cameraProblemMessage,
  isAppleMobile,
  type CameraProblem,
} from "@/lib/capture-rules";

/** The browser's own QR reader where it exists (Chrome on Android); jsQR everywhere else. */
type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (options: { formats: string[] }) => Detector;

/** How often a frame is read: often enough to feel instant, rare enough to spare the battery. */
const READ_EVERY_MS = 200;

type State =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "reading" }
  | { kind: "problem"; problem: CameraProblem };

/**
 * Scan label (Phase 32, D-128): opens the back camera in a dialog and reads the first QR code it
 * sees: a roll's code (LR-MLT-004) or a location's LOC:R1-B3 (A-80). The camera stops as soon as
 * a code is read, the dialog closes, or the page goes away.
 */
export function QrScanner({
  onCode,
  label = "Scan label",
  size = "lg",
  variant = "secondary",
  className,
}: {
  onCode: (text: string) => void;
  label?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  const stop = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setState({ kind: "problem", problem: "insecure" });
      return;
    }
    stop();
    setState({ kind: "starting" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return stop();
      video.srcObject = stream;
      await video.play();
      setState({ kind: "reading" });

      const Native = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
      const native = Native ? new Native({ formats: ["qr_code"] }) : null;
      const jsQR = native ? null : (await import("jsqr")).default;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      const read = async () => {
        if (!streamRef.current || !video.videoWidth) {
          timerRef.current = window.setTimeout(read, READ_EVERY_MS);
          return;
        }
        let text: string | null = null;
        try {
          if (native) {
            text = (await native.detect(video))[0]?.rawValue ?? null;
          } else if (jsQR && ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
            text = jsQR(frame.data, frame.width, frame.height)?.data ?? null;
          }
        } catch {
          text = null; // a frame that couldn't be read; try the next one
        }
        if (text && text.trim()) {
          stop();
          setOpen(false);
          setState({ kind: "idle" });
          onCodeRef.current(text.trim());
          return;
        }
        if (streamRef.current) timerRef.current = window.setTimeout(read, READ_EVERY_MS);
      };
      timerRef.current = window.setTimeout(read, READ_EVERY_MS);
    } catch (error) {
      stop();
      setState({ kind: "problem", problem: cameraProblemFor((error as DOMException)?.name) });
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  const problem =
    state.kind === "problem"
      ? cameraProblemMessage(state.problem, {
          appleMobile: isAppleMobile(navigator.userAgent, navigator.maxTouchPoints),
        })
      : null;

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        onClick={() => {
          setOpen(true);
          // After the dialog's video element exists.
          window.setTimeout(() => void start(), 0);
        }}
      >
        <QrCode aria-hidden />
        {label}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            stop();
            setState({ kind: "idle" });
          }
        }}
      >
        <DialogContent
          size="md"
          className="max-sm:top-auto max-sm:bottom-0 max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <DialogTitle>Scan a label</DialogTitle>
          <DialogDescription>
            Point the camera at the QR code on the roll or the rack. It reads by itself.
          </DialogDescription>
          <div className="relative overflow-hidden rounded-md bg-muted">
            <video
              ref={videoRef}
              muted
              playsInline
              aria-label="Camera picture"
              className="aspect-square w-full object-cover"
            />
            {state.kind === "starting" && (
              <p
                role="status"
                className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground"
              >
                <LoaderCircle aria-hidden className="size-4 animate-spin" />
                Starting the camera…
              </p>
            )}
            {state.kind === "reading" && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-ring"
              />
            )}
          </div>
          {state.kind === "reading" && (
            <p role="status" className="text-sm text-muted-foreground">
              Looking for a QR code…
            </p>
          )}
          {problem && (
            <Alert tone="danger">
              <p className="font-medium">{problem.title}</p>
              <p>{problem.fix}</p>
            </Alert>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="lg">
                <X aria-hidden />
                Close
              </Button>
            </DialogClose>
            {problem && (
              <Button type="button" size="lg" onClick={() => void start()}>
                Try again
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
