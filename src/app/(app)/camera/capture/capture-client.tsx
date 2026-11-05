"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, LoaderCircle, Maximize2, RefreshCw, Ruler, Send } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  cameraProblemFor,
  cameraProblemMessage,
  frameProblemMessage,
  isAppleMobile,
  isPhoneOrTablet,
  SEND_ATTEMPTS,
  sendFailureMessage,
  shouldRetry,
  spaceCaptures,
  type CameraProblem,
} from "@/lib/capture-rules";
import { findMarkerQuads } from "@/lib/marker-detect";
import { defaultRollId } from "@/lib/roll-rules";
import {
  firstMarkedFrame,
  MARKER_MESSAGES,
  MARKER_READ_WIDTHS,
  scaleFromMarkers,
  worseProblem,
  type MarkerProblem,
  type MarkerScale,
  type Quad,
} from "@/lib/scale-marker";
import { FloorView, type FloorBand } from "./floor-view";
import { LastScanSummary, type ScanSummary } from "./last-scan";
import { PlanCounter, type CapturePlanView } from "./plan-counter";
import { RollBar, rollLine, type OpenRollView } from "./roll-bar";
import { PickRollForm, type ReadyRollView } from "./start-roll-form";

type ModelStatus = { state: "ready"; modelVersion: string } | { state: "missing"; message: string };

/** One press of Capture, kept until the app has it so "Send again" reuses its captureId. */
type Pending = {
  blob: Blob;
  frameUrl: string;
  captureId: string;
  capturedAt: string;
  rollId: string;
  rollCode: string;
  /** The marker cards on this frame, corners in fractions: the server reads the scale (D-120). */
  markerCorners: Quad[];
};

/** What the live picture shows of the marker card, read about 4 times a second (D-120). */
type MarkerView = { ok: true; widthIn: number } | { ok: false; problem: MarkerProblem };

/** The last result, as the capture returned it (a constructor can't open Scans, D-075). */
type Last = { summary: ScanSummary; repeat: boolean };

type CameraState =
  { kind: "starting" } | { kind: "live" } | { kind: "problem"; problem: CameraProblem };
type SendState =
  | { kind: "idle" }
  | { kind: "sending"; pending: Pending }
  | { kind: "failed"; message: string; pending: Pending | null };

const CAMERA_KEY = "cpoint.capture.camera";
const FLOOR_KEY = "cpoint.capture.floor";
/** The roll this browser last captured to, so the Roll dropdown starts on it (Phase 26). */
const ROLL_KEY = "cpoint.capture.roll";
const ROLL_REFRESH_MS = 20_000;
const JPEG_QUALITY = 0.92;
/** The live check for the marker card: how often (D-120). */
const MARKER_CHECK_MS = 250;
/** A card seen this recently still counts, so one missed read doesn't flicker the button. */
const MARKER_HOLD_MS = 1000;

/**
 * Reads the marker card on copies 960 and then 640 px wide, the first that gives a scale. The live
 * check and the press read the same sizes (QA run 1, F1: the full 1920 px frame missed a card the
 * preview had found), and a soft card often reads at one size only. The corners come back in
 * fractions, which hold for the full frame too.
 */
function readMarkerCard(
  source: CanvasImageSource,
  width: number,
  height: number,
  canvas: HTMLCanvasElement,
): MarkerScale | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || !width || !height) return null;
  let problem: MarkerProblem = "none";
  for (const size of MARKER_READ_WIDTHS) {
    const ratio = Math.min(1, size / width);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const read = scaleFromMarkers(findMarkerQuads(image), canvas.width, canvas.height);
    if (read.ok) return read;
    problem = worseProblem(problem, read.problem);
    if (ratio === 1) break; // the picture is already this small
  }
  return { ok: false, problem };
}

/** Until the video shows a new frame (or 60 ms where the browser can't say). */
function nextFrame(video: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    if (typeof video.requestVideoFrameCallback === "function") {
      const timer = setTimeout(resolve, 120);
      video.requestVideoFrameCallback(() => {
        clearTimeout(timer);
        resolve();
      });
    } else setTimeout(resolve, 60);
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function savedCamera(): string | undefined {
  try {
    return localStorage.getItem(CAMERA_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Floor view is remembered per browser, so a station PC opens straight into it (D-074). */
function savedFloor(): boolean {
  try {
    return localStorage.getItem(FLOOR_KEY) === "on";
  } catch {
    return false;
  }
}

function saveFloor(on: boolean) {
  try {
    if (on) localStorage.setItem(FLOOR_KEY, "on");
    else localStorage.removeItem(FLOOR_KEY);
  } catch {
    // Private mode: the choice just isn't remembered.
  }
}

function savedRoll(): string | null {
  try {
    return localStorage.getItem(ROLL_KEY);
  } catch {
    return null;
  }
}

function saveRoll(id: string) {
  try {
    localStorage.setItem(ROLL_KEY, id);
  } catch {
    // Private mode: the choice just isn't remembered.
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
  initialRolls,
  initialPlan,
  ready,
  model,
  earlyModelNotice,
}: {
  /** Every open roll (Phase 26: several may be open; the Roll dropdown chooses). */
  initialRolls: OpenRollView[];
  /** Today and the next planned days, with the rolls planned and scanned (D-118). */
  initialPlan: CapturePlanView[];
  /** Rolls in stock, not scanned yet (Phase 30A): the constructor picks one. */
  ready: ReadyRollView[];
  model: ModelStatus;
  earlyModelNotice: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);

  const [camera, setCamera] = useState<CameraState>({ kind: "starting" });
  // Recounts the plan counter when this phone finishes or puts back a roll (D-118).
  const planRefresh = useRef<(() => Promise<void>) | null>(null);
  const [devices, setDevices] = useState<{ id: string; label: string }[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [rolls, setRolls] = useState<OpenRollView[]>(initialRolls);
  const [chosenId, setChosenId] = useState<string | null>(() =>
    defaultRollId(initialRolls, { lastUsedId: null }),
  );
  const [startOpen, setStartOpen] = useState(false);
  const roll = rolls.find((r) => r.id === chosenId) ?? null;
  const chosenRef = useRef<string | null>(chosenId);
  const rollsRef = useRef<OpenRollView[]>(initialRolls);
  useEffect(() => {
    chosenRef.current = chosenId;
    rollsRef.current = rolls;
  }, [chosenId, rolls]);
  const [rollNotice, setRollNotice] = useState<string | null>(null);
  const [send, setSend] = useState<SendState>({ kind: "idle" });
  const [last, setLast] = useState<Last | null>(null);
  const [floor, setFloor] = useState(false);
  const fullscreenRef = useRef(false);
  // D-120: is the marker card in the live picture? Capture stays off until it is.
  const [marker, setMarker] = useState<MarkerView>({ ok: false, problem: "none" });

  useEffect(() => {
    // Read after mount: localStorage isn't there on the server.
    const timer = setTimeout(() => {
      setFloor(savedFloor());
      const last = savedRoll();
      setChosenId((current) => defaultRollId(initialRolls, { lastUsedId: last }) ?? current);
    }, 0);
    return () => clearTimeout(timer);
  }, [initialRolls]);

  const choose = useCallback((id: string) => {
    setChosenId(id || null);
    setRollNotice(null);
    if (id) saveRoll(id);
  }, []);

  /** A roll left the list (finished, cancelled, or refused as closed): move to another one. */
  const dropRoll = useCallback((id: string, notice: string | null) => {
    const rest = rollsRef.current.filter((r) => r.id !== id);
    setRolls(rest);
    if (chosenRef.current === id) setChosenId(defaultRollId(rest, { lastUsedId: null }));
    setRollNotice(notice);
  }, []);

  // Floor view and the page each render their own <video>; give the new one the running stream.
  useEffect(() => {
    const video = videoRef.current;
    if (video && streamRef.current && video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current;
      void video.play().catch(() => undefined);
    }
  }, [floor, camera.kind]);

  const enterFloor = useCallback(() => {
    setFloor(true);
    saveFloor(true);
    // Full screen needs this click; a station that opens in Floor view uses F11 instead.
    void document.documentElement
      .requestFullscreen?.()
      .then(() => {
        fullscreenRef.current = true;
      })
      .catch(() => undefined);
  }, []);

  const leaveFloor = useCallback(() => {
    setFloor(false);
    saveFloor(false);
    fullscreenRef.current = false;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!floor) return;
    // Esc leaves: in full screen the browser takes the key, so watch full screen ending too.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && leaveFloor();
    const onFullscreen = () => {
      if (!document.fullscreenElement && fullscreenRef.current) leaveFloor();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [floor, leaveFloor]);

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

  // Keep the Roll dropdown current (others start and finish rolls): every 20 s and on return.
  const refreshRolls = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/rolls/open", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { data: OpenRollView[] };
      const id = chosenRef.current;
      const was = rollsRef.current.find((r) => r.id === id);
      setRolls(body.data);
      if (id && was && !body.data.some((r) => r.id === id)) {
        setRollNotice(
          `${was.code} was finished or put back. Choose another roll, or scan a new one.`,
        );
        setChosenId(defaultRollId(body.data, { lastUsedId: null }));
      }
    } catch {
      // Offline for a moment: keep the list; a capture still checks its roll.
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(refreshRolls, ROLL_REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && void refreshRolls();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshRolls]);

  const deliver = useCallback(
    async (pending: Pending) => {
      setSend({ kind: "sending", pending });
      const phone = isPhoneOrTablet(navigator.userAgent, navigator.maxTouchPoints);
      let status: number | "network" = "network";
      let body: ApiError & {
        data?: {
          scanId: string;
          duplicate: boolean;
          sequence: number;
          verdict: ScanSummary["verdict"];
          defects: ScanSummary["defects"];
        };
      } = {};
      for (let attempt = 1; attempt <= SEND_ATTEMPTS; attempt++) {
        const form = new FormData();
        form.set("image", pending.blob, "capture.jpg");
        form.set("captureId", pending.captureId);
        form.set("capturedAt", pending.capturedAt);
        form.set("rollId", pending.rollId);
        form.set("source", phone ? "PHONE" : "WEBCAM");
        form.set("markerCorners", JSON.stringify(pending.markerCorners));
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
        const data = body.data!;
        if (!data.duplicate)
          setRolls((list) =>
            list.map((r) =>
              r.id === pending.rollId ? { ...r, shots: Math.max(r.shots, data.sequence) } : r,
            ),
          );
        saveRoll(pending.rollId);
        setLast({
          summary: {
            verdict: data.verdict,
            sequence: data.sequence,
            rollCode: pending.rollCode,
            defects: data.defects ?? [],
          },
          repeat: data.duplicate,
        });
        return;
      }
      const code = body.error?.code;
      if (code === "ROLL_CLOSED") {
        // Finished or cancelled on another phone: nothing was saved; choose another roll.
        dropRoll(pending.rollId, body.error?.message ?? null);
        URL.revokeObjectURL(pending.frameUrl);
        setSend({ kind: "idle" });
        return;
      }
      const retryable = status === "network" || shouldRetry(status);
      if (!retryable) URL.revokeObjectURL(pending.frameUrl);
      setSend({
        kind: "failed",
        message: sendFailureMessage(status, body.error?.message),
        pending: retryable ? pending : null,
      });
    },
    [dropRoll],
  );

  const modelReady = model.state === "ready";
  const live = camera.kind === "live";
  const sending = send.kind === "sending";
  const waitingToResend = send.kind === "failed" && send.pending !== null;
  // Space may be pressed without the card, to be told why nothing was sent; the button waits.
  const canPress = live && modelReady && !!roll && !sending && !waitingToResend;
  const canCapture = canPress && marker.ok;

  // The live check for the marker card, on a small copy of the picture (D-120).
  useEffect(() => {
    if (!live) return;
    const canvas = document.createElement("canvas");
    let lastSeen = 0;
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || document.visibilityState !== "visible") return;
      if (busyRef.current) return;
      const read = readMarkerCard(video, video.videoWidth, video.videoHeight, canvas);
      if (!read) return;
      const now = Date.now();
      if (read.ok) {
        lastSeen = now;
        setMarker((m) =>
          m.ok && m.widthIn === read.widthIn ? m : { ok: true, widthIn: read.widthIn },
        );
      } else if (now - lastSeen > MARKER_HOLD_MS) {
        setMarker((m) =>
          !m.ok && m.problem === read.problem ? m : { ok: false, problem: read.problem },
        );
      }
    }, MARKER_CHECK_MS);
    return () => clearInterval(timer);
  }, [live]);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!canPress || !video || !roll || busyRef.current) return;
    // No frame yet (the camera is starting, or Floor view's video just got the stream): say so
    // instead of sending an empty picture.
    if (video.videoWidth === 0 || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setSend({ kind: "failed", message: frameProblemMessage("not_ready", floor), pending: null });
      return;
    }
    busyRef.current = true; // one press, one scan
    try {
      // The card is read again on the frame being sent: its corners must be on this very
      // picture. The detector finds a card on some frames, not every one, so a few frames are
      // tried (about half a second) and the first with the card is sent (QA run 2, F1).
      const scratch = document.createElement("canvas");
      let capturedAt = new Date().toISOString();
      const found = await firstMarkedFrame(
        () => {
          if (video.videoWidth === 0) return null;
          capturedAt = new Date().toISOString();
          const frame = document.createElement("canvas");
          frame.width = video.videoWidth;
          frame.height = video.videoHeight;
          frame.getContext("2d")?.drawImage(video, 0, 0, frame.width, frame.height);
          return frame;
        },
        (frame) => readMarkerCard(frame, frame.width, frame.height, scratch),
        () => nextFrame(video),
      );
      if (!found.ok) {
        setMarker({ ok: false, problem: found.problem });
        setSend({ kind: "failed", message: MARKER_MESSAGES[found.problem], pending: null });
        return;
      }
      const canvas = found.frame;
      const read = found.scale;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
      );
      if (!blob) {
        setSend({
          kind: "failed",
          message: frameProblemMessage("no_image", floor),
          pending: null,
        });
        return;
      }
      setRollNotice(null);
      await deliver({
        blob,
        frameUrl: URL.createObjectURL(blob),
        captureId: crypto.randomUUID(),
        capturedAt,
        rollId: roll.id,
        rollCode: roll.code,
        markerCorners: read.quads,
      });
    } finally {
      busyRef.current = false;
    }
  }, [roll, canPress, deliver, floor]);

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
    camera.kind === "problem" ? cameraProblemMessage(camera.problem, { appleMobile }) : null;

  const offReason = !modelReady
    ? "Capture is off until the model is installed."
    : rolls.length === 0
      ? "Start a roll first."
      : !roll
        ? "Choose the roll this shot belongs to."
        : !live
          ? "Capture is off until the camera shows a picture."
          : waitingToResend
            ? "Send the last capture again first, or discard it."
            : !marker.ok
              ? MARKER_MESSAGES[marker.problem]
              : null;

  const frozen = send.kind === "sending" || send.kind === "failed" ? send.pending : null;

  if (floor) {
    const retryCamera =
      camera.kind === "problem" && camera.problem !== "insecure"
        ? () => void start(deviceId || undefined)
        : undefined;
    const band: FloorBand =
      send.kind === "sending"
        ? { kind: "checking" }
        : send.kind === "failed"
          ? {
              kind: "failed",
              message: send.message,
              resend: send.pending ? () => void deliver(send.pending!) : undefined,
              discard: send.pending
                ? () => {
                    URL.revokeObjectURL(send.pending!.frameUrl);
                    setSend({ kind: "idle" });
                  }
                : undefined,
            }
          : problem
            ? { kind: "problem", title: problem.title, fix: problem.fix, retry: retryCamera }
            : !modelReady
              ? { kind: "problem", title: "Capture is off.", fix: model.message }
              : !roll
                ? {
                    kind: "problem",
                    title: "Capture is off.",
                    fix: "Choose or start a roll first. Press Esc to leave Floor view and do it there.",
                  }
                : last
                  ? { kind: "result", result: { ...last.summary, repeat: last.repeat } }
                  : !marker.ok
                    ? {
                        kind: "problem",
                        title: "Capture is off.",
                        fix: MARKER_MESSAGES[marker.problem],
                      }
                    : { kind: "ready" };
    return (
      <FloorView
        videoRef={videoRef}
        live={live}
        frozenUrl={frozen?.frameUrl ?? null}
        rollLine={roll ? rollLine(roll) : "No roll chosen"}
        rollNotice={rollNotice}
        band={band}
        onLeave={leaveFloor}
      />
    );
  }

  return (
    // Room at the bottom on a phone for the fixed Capture button.
    <div className="grid grid-cols-1 items-start gap-6 pb-28 sm:pb-0 xl:grid-cols-3">
      <div className="flex flex-col gap-4 xl:col-span-2">
        <PlanCounter initial={initialPlan} refreshRef={planRefresh} />
        {rolls.length === 0 || startOpen ? (
          <section
            aria-labelledby="start-roll-title"
            className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-1"
          >
            <h2 id="start-roll-title" className="text-xl font-semibold">
              Start a roll
            </h2>
            {rollNotice && (
              <p role="status" className="rounded-md bg-caution-soft p-3 text-sm">
                {rollNotice}
              </p>
            )}
            <PickRollForm
              initialReady={ready}
              onCancel={rolls.length > 0 ? () => setStartOpen(false) : undefined}
              onStarted={(started) => {
                setRolls((list) => [started, ...list.filter((r) => r.id !== started.id)]);
                choose(started.id);
                setStartOpen(false);
                setLast(null);
              }}
            />
          </section>
        ) : (
          <>
            <RollBar
              rolls={rolls}
              chosen={roll}
              onChoose={choose}
              onStartAnother={() => {
                setRollNotice(null);
                setStartOpen(true);
              }}
              onClosed={(id, message) => {
                dropRoll(id, message);
                setLast(null);
                void planRefresh.current?.();
              }}
              disabled={sending}
            />
            {rollNotice && (
              <p role="status" className="rounded-md bg-caution-soft p-3 text-sm">
                {rollNotice}
              </p>
            )}
          </>
        )}

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

        {live &&
          (marker.ok ? (
            <p
              data-testid="marker-status"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Ruler aria-hidden className="size-4 text-pass" />
              Marker card found. This shot will be measured ({marker.widthIn.toFixed(1)} in across).
            </p>
          ) : (
            <div
              data-testid="marker-status"
              className="flex flex-col gap-1 rounded-md bg-caution-soft p-3 text-sm"
            >
              <p className="font-medium">{MARKER_MESSAGES[marker.problem]}</p>
              <p>
                Lay the printed marker card flat on the leather, fully in the picture.{" "}
                <a
                  href="/cpoint-scale-marker-2in.pdf"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline underline-offset-2"
                >
                  Print the marker card
                </a>{" "}
                at 100% if you don’t have one.
              </p>
            </div>
          ))}

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
          {/* On a phone the Capture button sits at the bottom of the screen, above the safe area. */}
          <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-1 border-t bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2 sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            <Button
              size="lg"
              className="h-14 w-full text-xl sm:h-11 sm:w-auto sm:text-lg"
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
          <div className="flex flex-col gap-1">
            <Button
              size="lg"
              variant="secondary"
              onClick={enterFloor}
              aria-describedby="floor-hint"
            >
              <Maximize2 aria-hidden />
              Floor view
            </Button>
            <p id="floor-hint" className="text-sm text-muted-foreground">
              Full screen for a monitor facing the operator.
            </p>
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
            {!last && (
              <CardDescription>
                The app’s verdict for your next capture shows here, with each defect marked.
              </CardDescription>
            )}
          </CardHeader>
          {last && (
            <CardContent>
              <LastScanSummary summary={last.summary} repeat={last.repeat} />
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
                Early model. It is still being trained, so some verdicts may be wrong.
              </Alert>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
