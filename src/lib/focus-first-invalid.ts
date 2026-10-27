/**
 * Moves the keyboard focus to the first field marked `aria-invalid` inside `root`, once React has
 * painted the error messages. For forms that keep their own error state; forms on react-hook-form
 * get this from `shouldFocusError`. Call it right after setting the errors (D-038).
 *
 * The move waits a frame, so it never takes focus from someone who has already gone on to a field
 * in that frame: it only moves focus that is still where it was when the errors were set (the
 * submit button, or nothing). Phase 30A run 6: typing "12" right after the error landed in the
 * next field, and the batch was saved with the old 3 pairs.
 */
export function focusFirstInvalid(root: ParentNode | null | undefined): void {
  if (!root || typeof requestAnimationFrame === "undefined") return;
  const before = typeof document === "undefined" ? null : document.activeElement;
  requestAnimationFrame(() => {
    const now = document.activeElement;
    if (now !== before && now !== null && now !== document.body) return;
    root.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}
