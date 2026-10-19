"""The station window itself (Tkinter, D-059). It draws what the presenter says and hands work to
threads; it never waits on the camera, the model or the app, so it stays responsive.

Colours are DESIGN.md's tokens (converted from tokens.css): warm neutrals, ink for the primary
button, and the verdict colours only for the app's verdict on the last scan.
"""

from __future__ import annotations

import queue
import threading
import tkinter as tk
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path
from tkinter import font as tkfont
from tkinter import ttk
from typing import Any

from ..doctor import Check
from ..overlay import draw_boxes
from ..sources import camera_name
from .cameras import CameraOption, find_cameras
from .checks import DRIVER_NAMES, describe_camera, run_checks
from .presenter import (
    PREVIEW_BANNER,
    CameraChanged,
    ChecksDone,
    ChecksStarted,
    Phase,
    Presenter,
    Tone,
)
from .settings import CameraChoice, save_choice, validate_url
from .workers import RunDeps, StationRunner

# DESIGN.md tokens (src/styles/tokens.css, light theme) as sRGB.
COLOURS = {
    "background": "#faf9f5",
    "foreground": "#1b1812",
    "card": "#ffffff",
    "muted": "#f1f0eb",
    "muted_fg": "#5e5a52",
    "border": "#e0ded7",
    "primary": "#1b1812",
    "primary_fg": "#faf9f5",
    "secondary": "#eeede7",
    "pass": "#137738",
    "pass_soft": "#daf8df",
    "rework": "#ad4a00",
    "rework_soft": "#ffe8d1",
    "reject": "#c51e21",
    "reject_soft": "#ffe6e2",
    "review": "#2063b0",
    "review_soft": "#e1f0ff",
}
VERDICT_COLOURS = {
    "PASS": ("pass", "pass_soft", "✓"),
    "REWORK": ("rework", "rework_soft", "↻"),
    "REJECT": ("reject", "reject_soft", "✕"),
    "NEEDS_REVIEW": ("review", "review_soft", "?"),
}
NOTICE_COLOURS = {
    Tone.INFO: ("review", "review_soft"),
    Tone.WARNING: ("rework", "rework_soft"),
    Tone.DANGER: ("reject", "reject_soft"),
}
CHECK_MARKS = {"ok": ("✓", "pass"), "warn": ("!", "rework"), "fail": ("✕", "reject")}
NETWORK = "Network camera (address)"
DRIVERS = {"Default": "default", "DirectShow": "dshow"}
PUMP_MS = 50
DRAW_MS = 33


@dataclass(frozen=True)
class CamerasFound:
    options: tuple[CameraOption, ...]
    backend: str


class StationWindow:
    def __init__(
        self,
        root: tk.Tk,
        *,
        config_path: Path | None,
        env: Mapping[str, str],
        choice: CameraChoice,
        run_deps: Callable[[], RunDeps],
    ) -> None:
        self.root = root
        self.config_path = config_path
        self.env = env
        self.choice = choice
        self.run_deps = run_deps
        self.presenter = Presenter()
        self.events: queue.Queue[object] = queue.Queue()
        self.runner: StationRunner | None = None
        self.options: tuple[CameraOption, ...] = ()
        self._photo: Any = None
        self._drawn: tuple[int, int, int, int] | None = None
        self._closing = False
        self._searching = False

        self._fonts()
        self._build()
        self._show_choice()
        self.refresh()
        self.root.after(PUMP_MS, self._pump)
        self.root.after(DRAW_MS, self._draw)
        self.find_cameras()

    # ───────────── layout ─────────────

    def _fonts(self) -> None:
        family = "Segoe UI" if "Segoe UI" in tkfont.families(self.root) else "TkDefaultFont"
        for name in ("TkDefaultFont", "TkTextFont", "TkMenuFont", "TkHeadingFont"):
            tkfont.nametofont(name).configure(family=family, size=11)
        self.font_heading = tkfont.Font(self.root, family=family, size=13, weight="bold")
        self.font_verdict = tkfont.Font(self.root, family=family, size=20, weight="bold")
        self.font_small = tkfont.Font(self.root, family=family, size=10)

    def _build(self) -> None:
        c = COLOURS
        root = self.root
        root.title("CPoint Camera")
        root.configure(background=c["background"])
        root.minsize(980, 640)
        style = ttk.Style(root)
        if "clam" in style.theme_names():
            style.theme_use("clam")
        style.configure(".", background=c["background"], foreground=c["foreground"])
        style.configure("TLabelframe", background=c["background"], bordercolor=c["border"])
        style.configure("TLabelframe.Label", background=c["background"], font=self.font_heading)
        style.configure("TButton", padding=(14, 6))
        style.configure(
            "Primary.TButton", background=c["primary"], foreground=c["primary_fg"], padding=(18, 8)
        )
        style.map(
            "Primary.TButton",
            background=[("disabled", c["secondary"]), ("active", "#3a352c")],
            foreground=[("disabled", c["muted_fg"])],
        )
        root.columnconfigure(0, weight=1)
        root.rowconfigure(3, weight=1)

        # camera picker and the check
        top = ttk.Frame(root, padding=(16, 12, 16, 4))
        top.grid(row=0, column=0, sticky="ew")
        top.columnconfigure(5, weight=1)
        ttk.Label(top, text="Camera").grid(row=0, column=0, padx=(0, 6))
        self.camera_var = tk.StringVar()
        self.camera_box = ttk.Combobox(
            top, textvariable=self.camera_var, state="readonly", width=30
        )
        self.camera_box.grid(row=0, column=1)
        self.camera_box.bind("<<ComboboxSelected>>", lambda _e: self._camera_picked())
        self.find_button = ttk.Button(top, text="Find cameras", command=self.find_cameras)
        self.find_button.grid(row=0, column=2, padx=(6, 16))
        ttk.Label(top, text="Driver").grid(row=0, column=3, padx=(0, 6))
        self.driver_var = tk.StringVar()
        self.driver_box = ttk.Combobox(
            top, textvariable=self.driver_var, values=list(DRIVERS), state="readonly", width=11
        )
        self.driver_box.grid(row=0, column=4, sticky="w")
        self.driver_box.bind("<<ComboboxSelected>>", lambda _e: self._driver_picked())
        self.check_button = ttk.Button(top, text="Check this machine", command=self.check)
        self.check_button.grid(row=0, column=6, sticky="e")

        self.address_row = ttk.Frame(top)
        self.address_row.grid(row=1, column=0, columnspan=7, sticky="ew", pady=(8, 0))
        ttk.Label(self.address_row, text="Address").pack(side="left", padx=(0, 6))
        self.address_var = tk.StringVar()
        self.address_entry = ttk.Entry(self.address_row, textvariable=self.address_var, width=48)
        self.address_entry.pack(side="left")
        self.address_entry.bind("<Return>", lambda _e: self._address_entered())
        self.address_entry.bind("<FocusOut>", lambda _e: self._address_entered())
        ttk.Label(
            self.address_row,
            text="DroidCam on an iPhone: http://<the IP the app shows>:4747/video",
            font=self.font_small,
            foreground=c["muted_fg"],
        ).pack(side="left", padx=(10, 0))

        # the batch and the notice bar
        self.batch_label = ttk.Label(root, font=self.font_heading, padding=(16, 8, 16, 4))
        self.batch_label.grid(row=1, column=0, sticky="ew")
        self.notice_label = tk.Label(
            root, anchor="w", justify="left", padx=12, pady=8, wraplength=900
        )
        self.notice_label.grid(row=2, column=0, sticky="ew", padx=16, pady=(0, 8))

        # preview on the left; checks and last scan on the right
        body = ttk.Frame(root, padding=(16, 0, 16, 0))
        body.grid(row=3, column=0, sticky="nsew")
        body.columnconfigure(0, weight=1)
        body.rowconfigure(1, weight=1)
        tk.Label(
            body,
            text=PREVIEW_BANNER,
            anchor="w",
            padx=10,
            pady=6,
            background=c["muted"],
            foreground=c["foreground"],
        ).grid(row=0, column=0, sticky="ew")
        self.preview_label = tk.Label(
            body,
            background=c["foreground"],
            foreground=c["primary_fg"],
            text="The camera picture shows here after Start.",
        )
        self.preview_label.grid(row=1, column=0, sticky="nsew")
        self.preview_note = ttk.Label(body, font=self.font_small, foreground=c["muted_fg"])
        self.preview_note.grid(row=2, column=0, sticky="w", pady=(4, 0))

        side = ttk.Frame(body, width=380)
        side.grid(row=0, column=1, rowspan=3, sticky="ns", padx=(16, 0))
        side.grid_propagate(False)
        side.columnconfigure(0, weight=1)
        side.rowconfigure(0, weight=1)
        checks = ttk.LabelFrame(side, text="Checks", padding=8)
        checks.grid(row=0, column=0, sticky="nsew")
        checks.columnconfigure(0, weight=1)
        checks.rowconfigure(0, weight=1)
        self.checks_text = tk.Text(
            checks,
            wrap="word",
            height=12,
            relief="flat",
            background=c["card"],
            foreground=c["foreground"],
            padx=8,
            pady=6,
            cursor="arrow",
            font=tkfont.nametofont("TkDefaultFont"),
        )
        self.checks_text.grid(row=0, column=0, sticky="nsew")
        checks_scroll = ttk.Scrollbar(checks, orient="vertical", command=self.checks_text.yview)
        checks_scroll.grid(row=0, column=1, sticky="ns")
        self.checks_text.configure(yscrollcommand=checks_scroll.set)
        for status, (_mark, colour) in CHECK_MARKS.items():
            self.checks_text.tag_configure(status, foreground=c[colour], font=self.font_heading)
        self.checks_text.tag_configure("name", font=self.font_heading)
        self.checks_text.tag_configure("detail", lmargin1=24, lmargin2=24, spacing3=6)
        self.checks_text.tag_configure("muted", foreground=c["muted_fg"], spacing1=6)

        scan = ttk.LabelFrame(side, text="Last scan", padding=8)
        scan.grid(row=1, column=0, sticky="ew", pady=(12, 0))
        scan.columnconfigure(0, weight=1)
        self.verdict_label = tk.Label(scan, font=self.font_verdict, anchor="w", padx=10, pady=6)
        self.verdict_label.grid(row=0, column=0, sticky="ew")
        self.scan_line = ttk.Label(scan, font=self.font_heading)
        self.scan_line.grid(row=1, column=0, sticky="w", pady=(6, 0))
        self.scan_found = ttk.Label(scan, wraplength=340)
        self.scan_found.grid(row=2, column=0, sticky="w")
        self.pending_label = ttk.Label(scan, wraplength=340, foreground=c["muted_fg"])
        self.pending_label.grid(row=3, column=0, sticky="w", pady=(6, 0))

        # buttons
        bar = ttk.Frame(root, padding=(16, 12, 16, 6))
        bar.grid(row=4, column=0, sticky="ew")
        bar.columnconfigure(3, weight=1)
        self.start_button = ttk.Button(bar, text="Start", command=self.start)
        self.start_button.grid(row=0, column=0)
        self.capture_button = ttk.Button(
            bar, text="Capture (Space)", style="Primary.TButton", command=self.capture
        )
        self.capture_button.grid(row=0, column=1, padx=8)
        self.stop_button = ttk.Button(bar, text="Stop", command=self.stop)
        self.stop_button.grid(row=0, column=2)
        self.status_label = ttk.Label(bar, padding=(16, 0, 0, 0))
        self.status_label.grid(row=0, column=3, sticky="w")

        # messages
        log = ttk.LabelFrame(root, text="Messages (newest first)", padding=6)
        log.grid(row=5, column=0, sticky="ew", padx=16, pady=(0, 12))
        log.columnconfigure(0, weight=1)
        self.messages = tk.Listbox(
            log,
            height=5,
            relief="flat",
            activestyle="none",
            background=c["card"],
            foreground=c["foreground"],
            selectbackground=c["muted"],
            selectforeground=c["foreground"],
        )
        self.messages.grid(row=0, column=0, sticky="ew")
        scroll = ttk.Scrollbar(log, orient="vertical", command=self.messages.yview)
        scroll.grid(row=0, column=1, sticky="ns")
        self.messages.configure(yscrollcommand=scroll.set)

        root.bind("<space>", self._space)
        root.protocol("WM_DELETE_WINDOW", self.close)

    # ───────────── camera choice ─────────────

    def _camera_values(self) -> list[str]:
        values = [o.label for o in self.options]
        if not isinstance(self.choice.device, str) and not any(
            o.index == self.choice.index for o in self.options
        ):
            values.insert(0, f"Camera {self.choice.index}")
        return [*values, NETWORK]

    def _show_choice(self) -> None:
        self.camera_box.configure(values=self._camera_values())
        if self.choice.url:
            self.camera_var.set(NETWORK)
            # Never show a password: the box shows the address without it.
            self.address_var.set(camera_name(self.choice.url).removeprefix("IP camera "))
            self.address_row.grid()
        else:
            label = next(
                (o.label for o in self.options if o.index == self.choice.index),
                f"Camera {self.choice.index}",
            )
            self.camera_var.set(label)
            self.address_row.grid_remove()
        names = {v: k for k, v in DRIVERS.items()}
        self.driver_var.set(names.get(self.choice.backend, "Default"))

    def _choose(self, choice: CameraChoice) -> None:
        if choice == self.choice:
            return
        self.choice = choice
        note = save_choice(choice)
        if note:
            self.presenter.note(note, Tone.WARNING)
        self.presenter.handle(CameraChanged())
        self.presenter.note(f"Camera: {describe_camera(choice)}.")
        self._show_choice()
        self.refresh()

    def _camera_picked(self) -> None:
        picked = self.camera_var.get()
        if picked == NETWORK:
            self.address_row.grid()
            self.address_entry.focus_set()
            if self.choice.url:
                return
            self.address_var.set("")
            return
        for option in self.options:
            if option.label == picked:
                self._choose(CameraChoice(option.index, None, self.choice.backend))
                return
        if picked.startswith("Camera "):
            self._choose(CameraChoice(int(picked.split()[1]), None, self.choice.backend))

    def _address_entered(self) -> None:
        if self.camera_var.get() != NETWORK:
            return
        text = self.address_var.get().strip()
        if not text:
            return
        if self.choice.url and text == camera_name(self.choice.url).removeprefix("IP camera "):
            return  # unchanged (it may be the hidden-password address from cv/.env)
        problem = validate_url(text)
        if problem:
            self.presenter.note(problem, Tone.DANGER)
            self.refresh()
            return
        self._choose(CameraChoice(self.choice.index, text, self.choice.backend))

    def _driver_picked(self) -> None:
        backend = DRIVERS.get(self.driver_var.get(), "default")
        self._choose(CameraChoice(self.choice.index, self.choice.url, backend))
        self.find_cameras()
        self.refresh()

    def find_cameras(self) -> None:
        if self._searching or not self.presenter.can_pick_camera:
            return
        backend = self.choice.backend
        self._searching = True
        self.presenter.note(f"Looking for cameras ({DRIVER_NAMES[backend]})...")
        self.refresh()

        def work() -> None:
            try:
                found = tuple(find_cameras(backend))
            except Exception as error:  # OpenCV missing or a driver fault
                self.events.put(f"The camera search failed: {error}")
                found = ()
            self.events.put(CamerasFound(found, backend))

        threading.Thread(target=work, name="find-cameras", daemon=True).start()

    def _cameras_found(self, event: CamerasFound) -> None:
        self._searching = False
        if event.backend != self.choice.backend:
            self.find_cameras()  # the driver changed while it looked
            return
        self.options = event.options
        if event.options:
            names = ", ".join(o.label for o in event.options)
            self.presenter.note(f"Cameras that give a picture: {names}.")
        else:
            other = "DirectShow" if event.backend == "default" else "Default"
            self.presenter.note(
                f"No camera gave a picture with the {DRIVER_NAMES[event.backend]}. Check it's "
                f"connected and not open in another app (for DroidCam, that the Windows client "
                f"is connected), or try the {other} driver.",
                Tone.WARNING,
            )
        self._show_choice()

    # ───────────── actions ─────────────

    def check(self) -> None:
        if not self.presenter.can_check:
            return
        self.presenter.handle(ChecksStarted())
        self.refresh()
        choice = self.choice

        def work() -> None:
            self.events.put(ChecksDone(run_checks(self.config_path, self.env, choice)))

        threading.Thread(target=work, name="checks", daemon=True).start()

    def start(self) -> None:
        report = self.presenter.report
        config = report.config_for_run() if report else None
        if config is None or not self.presenter.start_pressed():
            return
        self.runner = StationRunner(
            config,
            self.env,
            self.choice,
            describe_camera(self.choice),
            self.events.put,
            self.run_deps(),
        )
        self.runner.start()
        self.refresh()

    def capture(self) -> None:
        if self.runner is None or not self.presenter.capture_pressed():
            return
        if not self.runner.capture():
            self.presenter.capture_had_no_picture()
        self.refresh()

    def stop(self) -> None:
        if self.runner is not None and self.presenter.stop_pressed():
            self.runner.request_stop()
            self.refresh()

    def _space(self, event: Any) -> str | None:
        if isinstance(event.widget, ttk.Entry | tk.Entry):
            return None  # typing an address
        self.capture()
        return "break"

    def close(self) -> None:
        if self.runner is not None and self.runner.is_alive():
            if not self._closing:
                self._closing = True
                self.presenter.stop_pressed()
                self.runner.request_stop()
                self.refresh()
            self.root.after(100, self.close)
            return
        self.root.destroy()

    # ───────────── the loops ─────────────

    def _pump(self) -> None:
        changed = False
        while True:
            try:
                event = self.events.get_nowait()
            except queue.Empty:
                break
            changed = True
            if isinstance(event, CamerasFound):
                self._cameras_found(event)
            elif isinstance(event, str):
                self.presenter.note(event, Tone.WARNING)
            else:
                self.presenter.handle(event)
        if changed:
            self.refresh()
        self.root.after(PUMP_MS, self._pump)

    def _draw(self) -> None:
        try:
            self._draw_preview()
        finally:
            self.root.after(DRAW_MS, self._draw)

    def _draw_preview(self) -> None:
        runner = self.runner
        snap = runner.box.latest() if runner is not None and self.presenter.running else None
        if snap is None:
            if self._photo is not None:
                self._photo = None
                self._drawn = None
                self.preview_label.configure(
                    image="", text="The camera picture shows here after Start."
                )
            return
        assert runner is not None
        preview = runner.box.preview()
        width = max(self.preview_label.winfo_width(), 160)
        height = max(self.preview_label.winfo_height(), 120)
        key = (snap.seq, preview.seq if preview else 0, width, height)
        if key == self._drawn:
            return
        self._drawn = key

        import cv2
        from PIL import Image, ImageTk

        h, w = snap.image.shape[:2]
        scale = min(width / w, height / h)
        size = (max(1, int(w * scale)), max(1, int(h * scale)))
        frame = cv2.resize(snap.image, size, interpolation=cv2.INTER_AREA)
        if preview is not None:
            draw_boxes(frame, preview.detections)
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        self._photo = ImageTk.PhotoImage(Image.fromarray(rgb))
        self.preview_label.configure(image=self._photo, text="")
        if preview is not None and not self.presenter.preview_note:
            found = len(preview.detections)
            self.preview_note.configure(
                text=f"Preview: {found} box{'es' if found != 1 else ''} at "
                f"{runner.config.window.preview_imgsz} px, {preview.inference_ms:.0f} ms. "
                "Captures run at full size."
            )

    # ───────────── drawing the state ─────────────

    def refresh(self) -> None:
        p = self.presenter
        c = COLOURS

        def enable(widget: ttk.Widget, on: bool) -> None:
            widget.state(["!disabled"] if on else ["disabled"])

        enable(self.check_button, p.can_check)
        enable(self.start_button, p.can_start)
        enable(self.capture_button, p.can_capture)
        enable(self.stop_button, p.can_stop)
        self.camera_box.configure(state="readonly" if p.can_pick_camera else "disabled")
        self.driver_box.configure(state="readonly" if p.can_pick_camera else "disabled")
        self.address_entry.configure(state="normal" if p.can_pick_camera else "disabled")
        enable(self.find_button, p.can_pick_camera and not self._searching)

        self.batch_label.configure(
            text=p.batch_line, foreground=c["foreground"] if p.batch_ready else c["muted_fg"]
        )
        if p.notice is None:
            self.notice_label.grid_remove()
        else:
            fg, bg = NOTICE_COLOURS[p.notice.tone]
            self.notice_label.configure(text=p.notice.text, foreground=c[fg], background=c[bg])
            self.notice_label.grid()
        self.status_label.configure(text=p.status)
        if p.preview_note:
            self.preview_note.configure(text=p.preview_note)
        elif not p.running:
            self.preview_note.configure(text=p.camera_line)

        self._draw_checks(p.report.checks if p.report else (), p.phase)
        self._draw_last_scan()
        self.messages.delete(0, "end")
        for line in p.messages:
            self.messages.insert("end", line)

    def _draw_checks(self, checks: tuple[Check, ...], phase: Phase) -> None:
        text = self.checks_text
        text.configure(state="normal")
        text.delete("1.0", "end")
        if phase is Phase.CHECKING:
            text.insert("end", "Checking the model, packages, GPU, camera and app...")
        elif not checks:
            text.insert(
                "end",
                "Press Check this machine. It tests the model, packages, GPU, camera, the app "
                "and the device token, and says how to fix anything that fails.",
            )
        # What needs fixing first, then warnings, then the passes, so a failure is never below the
        # fold.
        order = {"fail": 0, "warn": 1, "ok": 2}
        shown = sorted(checks, key=lambda c: order[c.status])
        passed = [c for c in shown if c.status == "ok"]
        for check in shown:
            if check.status == "ok" and check is passed[0] and len(passed) < len(shown):
                text.insert("end", "Passed\n", "muted")
            mark, _colour = CHECK_MARKS[check.status]
            text.insert("end", f"{mark} ", check.status)
            text.insert("end", f"{check.name}\n", "name")
            text.insert("end", f"{check.detail}\n", "detail")
        text.configure(state="disabled")
        text.yview_moveto(0)

    def _draw_last_scan(self) -> None:
        p = self.presenter
        c = COLOURS
        scan = p.last_scan
        if scan is None:
            self.verdict_label.configure(
                text="No scan yet", foreground=c["muted_fg"], background=c["muted"]
            )
            self.scan_line.configure(text="")
            self.scan_found.configure(text="The app's verdict shows here after each capture.")
        else:
            fg, bg, icon = VERDICT_COLOURS.get(scan.verdict, ("review", "review_soft", "?"))
            self.verdict_label.configure(
                text=f"{icon}  {scan.verdict_label}", foreground=c[fg], background=c[bg]
            )
            self.scan_line.configure(text=scan.line)
            self.scan_found.configure(text=f"The model found {scan.found}. Verdict from the app.")
        self.pending_label.configure(text=p.pending_line)
