/**
 * Moves the keyboard focus to the first field marked `aria-invalid` inside `root`, once React has
 * painted the error messages. For forms that keep their own error state; forms on react-hook-form
 * get this from `shouldFocusError`. Call it right after setting the errors (D-038).
 */
export function focusFirstInvalid(root: ParentNode | null | undefined): void {
  if (!root || typeof requestAnimationFrame === "undefined") return;
  requestAnimationFrame(() => {
    root.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}
