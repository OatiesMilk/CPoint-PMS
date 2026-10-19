import { describe, expect, it } from "vitest";
import { parseModelInfo, sidecarPath } from "@/server/lib/cv/model-info";
import { decodeEndToEnd, letterbox, PAD_GREY, toModelInput } from "@/server/lib/cv/yolo-output";

describe("letterbox (as the station's .pt model pads)", () => {
  it("shrinks a 1920 × 1080 webcam frame to 1536 × 864 with no padding", () => {
    expect(letterbox(1920, 1080, 1536)).toMatchObject({
      inputWidth: 1536,
      inputHeight: 864,
      width: 1536,
      height: 864,
      left: 0,
      top: 0,
      scale: 0.8,
    });
  });

  it("keeps a 1536 square photo as it is", () => {
    expect(letterbox(1536, 1536, 1536)).toMatchObject({ inputWidth: 1536, inputHeight: 1536 });
  });

  it("pads only up to the next multiple of 32, split between the sides", () => {
    // 1000 × 700 → 1536 × 1075; 1536 - 1075 = 461, 461 mod 32 = 13 → 6 on top, 7 below.
    const box = letterbox(1000, 700, 1536);
    expect(box).toMatchObject({ width: 1536, height: 1075, top: 6, inputHeight: 1088 });
    expect(box.inputHeight % 32).toBe(0);
  });

  it("refuses an image with no pixels", () => {
    expect(() => letterbox(0, 10, 1536)).toThrow(/no pixels/);
  });
});

describe("toModelInput", () => {
  it("copies a photo already at the model's size into planes of 0 to 1", () => {
    const rgb = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]); // 2 × 2
    const out = toModelInput(rgb, letterbox(2, 2, 2, 1));
    expect(Array.from(out.slice(0, 4))).toEqual([1, 0, 0, 1]); // red plane
    expect(Array.from(out.slice(4, 8))).toEqual([0, 1, 0, 1]); // green
    expect(Array.from(out.slice(8, 12))).toEqual([0, 0, 1, 1]); // blue
  });

  it("averages neighbours when halving, as OpenCV's bilinear resize does", () => {
    const rgb = new Uint8Array(4 * 3).fill(0);
    rgb.set([200, 200, 200], 0); // one bright pixel of four
    const out = toModelInput(rgb, letterbox(2, 2, 1, 1));
    expect(out[0]).toBeCloseTo(50 / 255, 6);
  });

  it("fills the padding with grey", () => {
    const rgb = new Uint8Array(4 * 2 * 3).fill(255); // 4 × 2 → padded to 4 × 4 at stride 4
    const box = letterbox(4, 2, 4, 4);
    expect(box).toMatchObject({ inputWidth: 4, inputHeight: 4, top: 1 });
    const out = toModelInput(rgb, box);
    expect(out[0]).toBeCloseTo(PAD_GREY / 255, 6); // first row is padding
    expect(out[4]).toBe(1); // second row is the photo
  });

  it("says when the bytes don't match the photo's size", () => {
    expect(() => toModelInput(new Uint8Array(5), letterbox(2, 2, 2))).toThrow(/Expected 12/);
  });
});

describe("decodeEndToEnd", () => {
  // Two rows of [x1, y1, x2, y2, score, class, …mask coefficients].
  const row = (box: number[], score: number, cls: number) => [...box, score, cls, 9, 9];
  const box = letterbox(1920, 1080, 1536);

  it("keeps rows at or above the floor and maps boxes back to the photo", () => {
    const data = [...row([0, 0, 768, 432], 0.9, 2), ...row([0, 0, 10, 10], 0.1, 1)];
    expect(decodeEndToEnd(data, 2, 8, 0.25, box)).toEqual([
      { classIndex: 2, confidence: 0.9, cx: 0.25, cy: 0.25, w: 0.5, h: 0.5 },
    ]);
  });

  it("undoes the padding", () => {
    const padded = letterbox(1000, 700, 1536);
    const [d] = decodeEndToEnd(
      row([0, padded.top, 1536, padded.top + padded.height], 0.5, 0),
      1,
      8,
      0.25,
      padded,
    );
    // Within the 0.0001 the 1075.2 → 1075 px rounding costs.
    expect(d.cy).toBeCloseTo(0.5, 3);
    expect(d.h).toBeCloseTo(1, 3);
  });

  it("refuses an output too short for its shape", () => {
    expect(() => decodeEndToEnd([1, 2, 3], 1, 8, 0.25, box)).toThrow(/shorter/);
  });
});

describe("the model's sidecar file", () => {
  const good = {
    modelVersion: "yolo-v1-1d729fb0",
    names: { "0": "crease", "1": "cut" },
    imgsz: 1536,
    onnxSha256: "a".repeat(64),
  };

  it("sits beside the ONNX file", () => {
    expect(sidecarPath("/app/models/yolo-v1.onnx")).toBe("/app/models/yolo-v1.json");
  });

  it("reads the names as indexes and fills the defaults", () => {
    expect(parseModelInfo(JSON.stringify(good), "yolo-v1.json")).toEqual({
      ...good,
      names: { 0: "crease", 1: "cut" },
      stride: 32,
      confidenceFloor: 0.25,
      overlapIou: 0.7,
      rename: {},
    });
  });

  it("names the file and the field that's wrong", () => {
    expect(() => parseModelInfo("{", "yolo-v1.json")).toThrow(/yolo-v1.json isn't valid JSON/);
    expect(() => parseModelInfo(JSON.stringify({ ...good, imgsz: "big" }), "yolo-v1.json")).toThrow(
      /wrong "imgsz"/,
    );
  });
});
