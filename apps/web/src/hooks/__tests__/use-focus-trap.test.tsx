import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRef, useState } from "react";
import { useFocusTrap } from "../use-focus-trap";

function FocusTrapHarness() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap({
    open,
    setOpen,
    containerRef,
    triggerRef,
    dialogRef,
  });

  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(true)}>
        Open menu
      </button>
      {open && (
        <div ref={containerRef}>
          <div ref={dialogRef} role="dialog" aria-label="Menu" tabIndex={-1}>
            <button>First action</button>
            <button>Last action</button>
          </div>
        </div>
      )}
      <button>Outside action</button>
    </>
  );
}

describe("useFocusTrap", () => {
  afterEach(() => {
    cleanup();
  });

  it("moves focus to the first focusable element when opened", async () => {
    render(<FocusTrapHarness />);

    screen.getByRole("button", { name: "Open menu" }).click();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "First action" }),
      ).toHaveFocus();
    });
  });

  it("wraps tab focus inside the dialog", async () => {
    render(<FocusTrapHarness />);

    screen.getByRole("button", { name: "Open menu" }).click();
    const first = await screen.findByRole("button", { name: "First action" });
    const last = screen.getByRole("button", { name: "Last action" });

    first.focus();
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(last).toHaveFocus();

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(first).toHaveFocus();
  });

  it("closes on outside pointer down and returns focus to the trigger", async () => {
    render(<FocusTrapHarness />);

    const trigger = screen.getByRole("button", { name: "Open menu" });
    trigger.click();
    expect(
      await screen.findByRole("dialog", { name: "Menu" }),
    ).toBeInTheDocument();

    screen
      .getByRole("button", { name: "Outside action" })
      .dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Menu" }),
      ).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it("prevents and stops escape while closing the dialog", async () => {
    render(<FocusTrapHarness />);

    const trigger = screen.getByRole("button", { name: "Open menu" });
    trigger.click();
    expect(
      await screen.findByRole("dialog", { name: "Menu" }),
    ).toBeInTheDocument();

    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    const stopPropagation = vi.spyOn(event, "stopPropagation");

    document.dispatchEvent(event);

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Menu" }),
      ).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
    expect(event.defaultPrevented).toBe(true);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });
});
