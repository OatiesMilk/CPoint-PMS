"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { defaultRollId } from "@/lib/roll-rules";
import { CalibrateDialog, saveCalibration, savedCalibration, type Frame } from "./calibration";
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
  /** The phone's calibration for this frame size, or null (Phase 30C). */
  widthIn: number | null;
};

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
  // Phase 30C: the frame size the camera gives, and this phone's calibration for it (A-18).
  const [frameSize, setFrameSize] = useState<{ width: number; height: number } | null>(null);
  const [calibrationVersion, setCalibrationVersion] = useState(0);
  const [calibrateFrame, setCalibrateFrame] = useState<Frame | null>(null);
  const calibration = useMemo(
    () =>
      frameSize && calibrationVersion >= 0
        ? savedCalibration(deviceId, frameSize.width, frameSize.height)
        : null,
    [frameSize, deviceId, calibrationVersion],
  );

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
        if (pending.widthIn !== null) form.set("widthIn", String(pending.widthIn));
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
  const canCapture = live && modelReady && !!roll && !sending && !waitingToResend;

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!canCapture || !video || !roll || busyRef.current) return;
    // No frame yet (the camera is starting, or Floor view's video just got the stream): say so
    // instead of sending an empty picture.
    if (video.videoWidth === 0 || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setSend({ kind: "failed", message: frameProblemMessage("not_ready", floor), pending: null });
      return;
    }
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
        widthIn: savedCalibration(deviceId, canvas.width, canvas.height)?.widthIn ?? null,
      });
    } finally {
      busyRef.current = false;
    }
  }, [roll, canCapture, deliver, floor, deviceId]);

  /** Freezes the live picture for tapping the sheet's corners (Phase 30C). */
  const openCalibrate = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) return;
    setCalibrateFrame({
      url: URL.createObjectURL(blob),
      width: canvas.width,
      height: canvas.height,
    });
  }, []);

  const closeCalibrate = useCallback(() => {
    setCalibrateFrame((f) => {
      if (f) URL.revokeObjectURL(f.url);
      return null;
    });
  }, []);

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
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (v.videoWidth) setFrameSize({ width: v.videoWidth, height: v.videoHeight });
            }}
            onResize={(e) => {
              const v = e.currentTarget;
              if (v.videoWidth) setFrameSize({ width: v.videoWidth, height: v.videoHeight });
            }}
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
          (calibration ? (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>
                <Ruler aria-hidden className="mr-1 inline size-4 align-text-bottom" />
                This phone is set up to measure cuts.
              </span>
              <Button variant="ghost" size="sm" onClick={() => void openCalibrate()}>
                Set up again
              </Button>
            </p>
          ) : (
            <div className="flex flex-col gap-3 rounded-md bg-caution-soft p-3 text-sm sm:flex-row sm:items-center">
              <p className="flex-1">
                <span className="font-medium">Set up this phone first.</span> It needs one photo of
                a paper sheet so it can measure cuts.
              </p>
              <Button variant="secondary" onClick={() => void openCalibrate()}>
                <Ruler aria-hidden />
                Set up this phone
              </Button>
            </div>
          ))}

        <CalibrateDialog
          open={calibrateFrame !== null}
          frame={calibrateFrame}
          onClose={closeCalibrate}
          onSave={(widthIn) => {
            if (calibrateFrame)
              saveCalibration(deviceId, {
                widthIn: Math.round(widthIn * 100) / 100,
                frameWidth: calibrateFrame.width,
                frameHeight: calibrateFrame.height,
                savedAt: new Date().toISOString(),
              });
            setCalibrationVersion((v) => v + 1);
            closeCalibrate();
          }}
        />

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
