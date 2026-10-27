import { afterEach, describe, expect, it, vi } from "vitest";
import { focusFirstInvalid } from "@/lib/focus-first-invalid";

// Node has no DOM: a tiny stand-in for document.activeElement, focus() and one animation frame.
function setup(active: "button" | "body" | null) {
  const frames: (() => void)[] = [];
  const body = { name: "body" };
  const button = { name: "button" };
  const doc = {
    body,
    activeElement: active === "button" ? button : active === "body" ? body : null,
  };
  const invalid = { focus: vi.fn(() => (doc.activeElement = invalid as never)) };
  const root = { querySelector: vi.fn(() => invalid) } as unknown as ParentNode;
  vi.stubGlobal("document", doc);
  vi.stubGlobal("requestAnimationFrame", (cb: () => void) => frames.push(cb));
  return { doc, invalid, root, frame: () => frames.shift()?.() };
}

afterEach(() => vi.unstubAllGlobals());

describe("focusFirstInvalid", () => {
  it("moves focus from the submit button to the first invalid field", () => {
    const { invalid, root, frame } = setup("button");
    focusFirstInvalid(root);
    frame();
    expect(invalid.focus).toHaveBeenCalledOnce();
  });

  it("moves focus when nothing has it", () => {
    const { invalid, root, frame } = setup("body");
    focusFirstInvalid(root);
    frame();
    expect(invalid.focus).toHaveBeenCalledOnce();
  });

  it("leaves focus alone when the person moved to another field before the frame", () => {
    const { doc, invalid, root, frame } = setup("button");
    focusFirstInvalid(root);
    doc.activeElement = { name: "pairs" } as never;
    frame();
    expect(invalid.focus).not.toHaveBeenCalled();
  });
});
