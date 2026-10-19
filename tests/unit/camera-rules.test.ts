import { describe, expect, it } from "vitest";
import { modelName } from "@/lib/camera-rules";

describe("modelName", () => {
  it("drops the checksum the station appends", () => {
    expect(modelName("yolo-v1-1d729fb0")).toBe("yolo-v1");
    expect(modelName("yolo-v2-ABCDEF12")).toBe("yolo-v2");
  });

  it("keeps a version without a checksum, and handles none", () => {
    expect(modelName("simulator-1")).toBe("simulator-1");
    expect(modelName("  ")).toBeNull();
    expect(modelName(null)).toBeNull();
  });
});
