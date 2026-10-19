"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, CameraOff, LoaderCircle, RefreshCw, Send } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  cameraProblemFor,
  cameraProblemMessage,
  isAppleMobile,
  isPhoneOrTablet,
  secureAddress,
  SEND_ATTEMPTS,
  sendFailureMessage,
  shouldRetry,
  spaceCaptures,
  type CameraProblem,
} from "@/lib/capture-rules";
import { LastScan, type ScanDetail } from "./last-scan";

type Batch = { batchId: string; batchCode: string; rollCode: string; shoeType: string } | null;
type ModelStatus = { state: "ready"; modelVersion: string } | { state: "missing"; message: string };

/** One press of Capture, kept until the app has it so "Send again" reuses its captureId. */
type Pending = {
  blob: Blob;
  frameUrl: string;
  captureId: string;
  capturedAt: string;
  batchId: string;
};

type CameraState =
  { kind: "starting" } | { kind: "live" } | { kind: "problem"; problem: CameraProblem };
type SendState =
  | { kind: "idle" }
  | { kind: "sending"; pending: Pending }
  | { kind: "failed"; message: string; pending: Pending | null };

const CAMERA_KEY = "cpoint.capture.camera";
const BATCH_REFRESH_MS = 20_000;
const JPEG_QUALITY = 0.92;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function savedCamera(): string | undefined {
  try {
    return localStorage.getItem(CAMERA_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function saveCamera(deviceId: string) {
  try {
    localStorage.setItem(CAMERA_KEY, deviceId);
  } catch {
    // Private mode: the choice just isn't remembered.
  }
}

/** The chosen camera at up to 1920 × 1080; with none chosen, a phone's back camera. */
function openCamera(deviceId: string | undefined): Promise<MediaStream> {
  const phone = isPhoneOrTablet(navigator.userAgent, navigator.maxTouchPoints);
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      ...(deviceId
        ? { deviceId: { exact: deviceId } }
        : phone
          ? { facingMode: { ideal: "environment" } }
          : {}),
    },
  });
}

type ApiError = { error?: { code?: string; message?: string; details?: unknown } };

export function CaptureClient({
  initialBatch,
  model,
  earlyModelNotice,
}: {
  initialBatch: Batch;
  model: ModelStatus;
  earlyModelNotice: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);

  const [camera, setCamera] = useState<CameraState>({ kind: "starting" });
  const [devices, setDevices] = useState<{ id: string; label: string }[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [batch, setBatch] = useState<Batch>(initialBatch);
  const batchRef = useRef<Batch>(initialBatch);
  useEffect(() => {
    batchRef.current = batch;
  }, [batch]);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);
  const [send, setSend] = useState<SendState>({ kind: "idle" });
  const [last, setLast] = useState<{ scan: ScanDetail; repeat: boolean } | null>(null);
  const [lastNote, setLastNote] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(
    async (wanted?: string): Promise<void> => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCamera({ kind: "problem", problem: "insecure" });
        return;
      }
      stopStream();
      setCamera({ kind: "starting" });
      try {
        let stream: MediaStream;
        try {
          stream = await openCamera(wanted);
        } catch (error) {
          // A remembered camera that's gone: fall back to the default one once.
          if (!wanted || cameraProblemFor((error as DOMException)?.name) !== "no_camera")
            throw error;
          stream = await openCamera(undefined);
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        const all = await navigator.mediaDevices.enumerateDevices();
        const cams = all
          .filter((d) => d.kind === "videoinput")
          .map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` }));
        const used = stream.getVideoTracks()[0]?.getSettings().deviceId ?? "";
        setDevices(cams);
        setDeviceId(used);
        if (used) saveCamera(used);
        setCamera({ kind: "live" });
      } catch (error) {
        setCamera({ kind: "problem", problem: cameraProblemFor((error as DOMException)?.name) });
      }
    },
    [stopStream],
  );

  useEffect(() => {
    // Started from a callback, after "Starting the camera…" has painted.
    const timer = setTimeout(() => void start(savedCamera()), 0);
    return () => {
      clearTimeout(timer);
      stopStream();
    };
  }, [start, stopStream]);

  // Keep "Next scan goes to" current: every 20 s and whenever the tab comes back.
  const refreshBatch = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/batches/current", { cache: "no-store" });
      if (res.status === 404) return setBatch(null);
      if (!res.ok) return;
      const body = (await res.json()) as { data: NonNullable<Batch> };
      const prev = batchRef.current;
      if (prev && prev.batchId !== body.data.batchId)
        setBatchNotice(
          `The batch at Preparation changed from ${prev.batchCode} to ${body.data.batchCode}. Your next capture goes to ${body.data.batchCode}.`,
        );
      setBatch(body.data);
    } catch {
      // Offline for a moment: keep showing the last batch; a capture still checks it.
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(refreshBatch, BATCH_REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && void refreshBatch();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshBatch]);

  const showResult = useCallback(async (scanId: string, repeat: boolean) => {
    setLastNote(null);
    try {
      const res = await fetch(`/api/v1/scans/${scanId}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { data: ScanDetail };
      setLast({ scan: body.data, repeat });
    } catch {
      setLastNote(
        "The scan was saved, but its details couldn’t be loaded here. Open it from Scans.",
      );
    }
  }, []);

  const deliver = useCallback(
    async (pending: Pending) => {
      setSend({ kind: "sending", pending });
      const phone = isPhoneOrTablet(navigator.userAgent, navigator.maxTouchPoints);
      let status: number | "network" = "network";
      let body: ApiError & { data?: { scanId: string; duplicate: boolean } } = {};
      for (let attempt = 1; attempt <= SEND_ATTEMPTS; attempt++) {
        const form = new FormData();
        form.set("image", pending.blob, "capture.jpg");
        form.set("captureId", pending.captureId);
        form.set("capturedAt", pending.capturedAt);
        form.set("batchId", pending.batchId);
        form.set("source", phone ? "PHONE" : "WEBCAM");
        try {
          const res = await fetch("/api/v1/scans/capture", { method: "POST", body: form });
          status = res.status;
          body = (await res.json().catch(() => ({}))) as typeof body;
        } catch {
          status = "network";
        }
        if (status !== "network" && status < 500) break;
        if (!shouldRetry(status) || attempt === SEND_ATTEMPTS) break;
        await sleep(1000 * 2 ** (attempt - 1));
      }

      if (status === 200 || status === 201) {
        URL.revokeObjectURL(pending.frameUrl);
        setSend({ kind: "idle" });
        await showResult(body.data!.scanId, body.data!.duplicate);
        return;
      }
      const code = body.error?.code;
      if (code === "BATCH_MOVED") {
        const details = body.error?.details as { current?: Batch } | undefined;
        setBatch(details?.current ?? null);
        setBatchNotice(body.error?.message ?? null);
        URL.revokeObjectURL(pending.frameUrl);
        setSend({ kind: "idle" });
        return;
      }
      if (code === "NO_BATCH_AT_PREPARATION") setBatch(null);
      const retryable = status === "network" || shouldRetry(status);
      if (!retryable) URL.revokeObjectURL(pending.frameUrl);
      setSend({
        kind: "failed",
        message: sendFailureMessage(status, body.error?.message),
        pending: retryable ? pending : null,
      });
    },
    [showResult],
  );

  const modelReady = model.state === "ready";
  const live = camera.kind === "live";
  const sending = send.kind === "sending";
  const waitingToResend = send.kind === "failed" && send.pending !== null;
  const canCapture = live && modelReady && !!batch && !sending && !waitingToResend;

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!canCapture || !video || !batch || busyRef.current) return;
    busyRef.current = true; // one press, one scan
    try {
      const capturedAt = new Date().toISOString();
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
      );
      if (!blob) {
        setSend({
          kind: "failed",
          message: "The picture couldn’t be taken from the camera. Press Capture again.",
          pending: null,
        });
        return;
      }
      setBatchNotice(null);
      await deliver({
        blob,
        frameUrl: URL.createObjectURL(blob),
        captureId: crypto.randomUUID(),
        capturedAt,
        batchId: batch.batchId,
      });
    } finally {
      busyRef.current = false;
    }
  }, [batch, canCapture, deliver]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || !spaceCaptures(e.target as HTMLElement | null)) return;
      e.preventDefault();
      void capture();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [capture]);

  const appleMobile =
    typeof navigator !== "undefined" &&
    isAppleMobile(navigator.userAgent, navigator.maxTouchPoints);
  const problem =
    camera.kind === "problem"
      ? cameraProblemMessage(camera.problem, {
          appleMobile,
          secureUrl: typeof window !== "undefined" ? secureAddress(window.location) : "",
        })
      : null;

  const offReason = !modelReady
    ? "Capture is off until the model is installed."
    : !batch
      ? "Capture is off until a batch is at Preparation."
      : !live
        ? "Capture is off until the camera shows a picture."
        : waitingToResend
          ? "Send the last capture again first, or discard it."
          : null;

  const frozen = send.kind === "sending" || send.kind === "failed" ? send.pending : null;

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
      <div className="flex flex-col gap-4 xl:col-span-2">
        <section aria-label="Next scan" className="rounded-lg border bg-card p-4 shadow-1">
          {batch ? (
            <p className="text-lg">
              Next scan goes to <span className="font-mono font-semibold">{batch.batchCode}</span>
              <span className="text-muted-foreground">
                {" "}
                · roll <span className="font-mono">{batch.rollCode}</span> · {batch.shoeType}
              </span>
            </p>
          ) : (
            <p className="text-lg">
              No batch is at Preparation, so Capture is off.{" "}
              <Link href="/batches?status=PLANNED" className="underline underline-offset-4">
                Start a batch
              </Link>{" "}
              first. This page picks it up within 20 seconds.
            </p>
          )}
          {batchNotice && (
            <p role="status" className="mt-2 rounded-md bg-rework-soft p-3 text-sm">
              {batchNotice}
            </p>
          )}
        </section>

        {!modelReady && <Alert tone="danger">{model.message}</Alert>}

        <div className="relative overflow-hidden rounded-lg border bg-muted">
          {/* The live picture; no boxes or verdict until the app has checked the capture (D-067). */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            aria-label="Live camera picture"
            className={live ? "block aspect-video w-full object-contain" : "hidden"}
          />
          {frozen && (
            // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an asset
            <img
              src={frozen.frameUrl}
              alt="The section being sent"
              className="absolute inset-0 size-full object-contain"
            />
          )}
          {sending && (
            <div
              role="status"
              className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-card/90 px-4 py-3 font-medium"
            >
              <LoaderCircle aria-hidden className="size-4 animate-spin" />
              Checking the section…
            </div>
          )}
          {camera.kind === "starting" && (
            <div
              role="status"
              className="flex aspect-video flex-col items-center justify-center gap-2 text-muted-foreground"
            >
              <Camera aria-hidden className="size-8" />
              Starting the camera… Allow the camera when your browser asks.
            </div>
          )}
          {problem && (
            <div className="flex aspect-video flex-col items-center justify-center gap-3 p-6 text-center">
              <CameraOff aria-hidden className="size-8 text-muted-foreground" />
              <p className="font-medium">{problem.title}</p>
              <p className="max-w-lg text-muted-foreground">{problem.fix}</p>
              {camera.kind === "problem" && camera.problem !== "insecure" && (
                <Button variant="secondary" onClick={() => void start(deviceId || undefined)}>
                  <RefreshCw aria-hidden />
                  Try again
                </Button>
              )}
            </div>
          )}
        </div>

        {send.kind === "failed" && (
          <Alert tone="danger">
            <span>{send.message}</span>
            {send.pending && (
              <span className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void deliver(send.pending!)}>
                  <Send aria-hidden />
                  Send again
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    URL.revokeObjectURL(send.pending!.frameUrl);
                    setSend({ kind: "idle" });
                  }}
                >
                  Discard this capture
                </Button>
              </span>
            )}
          </Alert>
        )}

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <Button
              size="lg"
              onClick={() => void capture()}
              disabled={!canCapture}
              aria-describedby={offReason ? "capture-off" : "capture-hint"}
            >
              {sending ? (
                <LoaderCircle aria-hidden className="animate-spin" />
              ) : (
                <Camera aria-hidden />
              )}
              {sending ? "Checking…" : "Capture"}
            </Button>
            {offReason ? (
              <p id="capture-off" className="text-sm text-muted-foreground">
                {offReason}
              </p>
            ) : (
              <p id="capture-hint" className="text-sm text-muted-foreground">
                Space also captures.
              </p>
            )}
          </div>
          {devices.length > 0 && (
            <div className="flex min-w-60 flex-col gap-1.5">
              <Label htmlFor="capture-camera">Camera</Label>
              <Select
                id="capture-camera"
                value={deviceId}
                disabled={sending}
                onChange={(e) => {
                  setDeviceId(e.target.value);
                  void start(e.target.value);
                }}
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Last scan</CardTitle>
            {!last && !lastNote && (
              <CardDescription>
                The app’s verdict for your next capture shows here, with each defect marked.
              </CardDescription>
            )}
          </CardHeader>
          {(last || lastNote) && (
            <CardContent>
              {last ? <LastScan scan={last.scan} repeat={last.repeat} /> : <p>{lastNote}</p>}
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model</CardTitle>
            <CardDescription>
              {model.state === "ready"
                ? `${model.modelVersion} runs on the server for every capture.`
                : "Not installed on the server yet."}
            </CardDescription>
          </CardHeader>
          {earlyModelNotice && model.state === "ready" && (
            <CardContent>
              <Alert tone="info">
                Early model. Results are for testing; the Quality Inspector checks every flagged
                section.
              </Alert>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
