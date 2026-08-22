import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Traps focus inside the given container when active (e.g. for modals).
 * Restores focus to the previously focused element on cleanup.
 * Optionally calls onEscape when Escape is pressed.
 */
export function useFocusTrap(
  isActive: boolean,
  containerRef: RefObject<HTMLElement | null>,
  options?: { onEscape?: () => void },
): void {
  const onEscapeRef = useRef(options?.onEscape);
  onEscapeRef.current = options?.onEscape;

  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const timer = setTimeout(() => container?.focus(), 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onEscapeRef.current?.();
        return;
      }
      if (e.key !== "Tab" || !container) return;

      const focusable =
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isActive, containerRef]);
}
