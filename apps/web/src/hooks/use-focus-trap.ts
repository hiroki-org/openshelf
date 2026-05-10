import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'button:not([tabindex="-1"]), [href]:not([tabindex="-1"]), input:not([tabindex="-1"]), textarea:not([tabindex="-1"]), select:not([tabindex="-1"]), [contenteditable]:not([contenteditable="false"]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

type UseFocusTrapProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  containerRef: RefObject<HTMLElement | null>;
  triggerRef: RefObject<HTMLElement | null>;
  dialogRef: RefObject<HTMLElement | null>;
};

export function useFocusTrap({
  open,
  setOpen,
  containerRef,
  triggerRef,
  dialogRef,
}: UseFocusTrapProps) {
  useEffect(() => {
    if (!open) return;

    const getFocusableElements = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ??
          [],
      ).filter(
        (element) =>
          !element.hasAttribute("disabled") &&
          element.getAttribute("aria-hidden") !== "true",
      );

    const firstFocusable = getFocusableElements()[0];
    (firstFocusable ?? dialogRef.current)?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !containerRef.current?.contains(target)) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      const activeElement = document.activeElement;
      if (event.shiftKey) {
        if (activeElement === first || activeElement === dialogRef.current) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (activeElement === last || activeElement === dialogRef.current) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, setOpen, containerRef, triggerRef, dialogRef]);
}
