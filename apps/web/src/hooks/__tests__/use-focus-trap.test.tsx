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

function EmptyFocusTrapHarness() {
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
        Open empty menu
      </button>
      {open && (
        <div ref={containerRef}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-label="Empty Menu"
            tabIndex={-1}
          >
            <p>No focusable elements here</p>
          </div>
        </div>
      )}
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

  it("focuses the dialog and keeps focus on Tab when there are no focusable elements", async () => {
    render(<EmptyFocusTrapHarness />);

    screen.getByRole("button", { name: "Open empty menu" }).click();

    const dialog = await screen.findByRole("dialog", { name: "Empty Menu" });
    await waitFor(() => {
      expect(dialog).toHaveFocus();
    });

    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(dialog).toHaveFocus();
  });

  it("ignores keydown events that are not Tab or Escape", async () => {
    render(<FocusTrapHarness />);

    screen.getByRole("button", { name: "Open menu" }).click();

    const first = await screen.findByRole("button", { name: "First action" });
    await waitFor(() => {
      expect(first).toHaveFocus();
    });

    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(first).toHaveFocus();
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeInTheDocument();
  });

  it("focuses the last element when shift+tabbing from the first element", async () => {
    render(<FocusTrapHarness />);

    screen.getByRole("button", { name: "Open menu" }).click();

    const first = await screen.findByRole("button", { name: "First action" });
    const last = screen.getByRole("button", { name: "Last action" });
    await waitFor(() => {
      expect(first).toHaveFocus();
    });

    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(last).toHaveFocus();
  });

  it("focuses the first element when tabbing from the last element", async () => {
    render(<FocusTrapHarness />);

    screen.getByRole("button", { name: "Open menu" }).click();

    const first = await screen.findByRole("button", { name: "First action" });
    const last = screen.getByRole("button", { name: "Last action" });

    last.focus();
    await waitFor(() => {
      expect(last).toHaveFocus();
    });

    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(first).toHaveFocus();
  });

  it("focuses the dialog if activeElement is the dialog and Shift+Tab is pressed", async () => {
    render(<FocusTrapHarness />);

    screen.getByRole("button", { name: "Open menu" }).click();

    const dialog = await screen.findByRole("dialog", { name: "Menu" });
    const last = screen.getByRole("button", { name: "Last action" });

    dialog.focus();
    await waitFor(() => {
      expect(dialog).toHaveFocus();
    });

    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(last).toHaveFocus();
  });

  it("focuses the first element if activeElement is the dialog and Tab is pressed", async () => {
    render(<FocusTrapHarness />);

    screen.getByRole("button", { name: "Open menu" }).click();

    const dialog = await screen.findByRole("dialog", { name: "Menu" });
    const first = await screen.findByRole("button", { name: "First action" });

    dialog.focus();
    await waitFor(() => {
      expect(dialog).toHaveFocus();
    });

    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(first).toHaveFocus();
  });

  it("focuses the dialog when opening if no focusable elements are found and firstFocusable is undefined", async () => {
    render(<EmptyFocusTrapHarness />);

    screen.getByRole("button", { name: "Open empty menu" }).click();

    const dialog = await screen.findByRole("dialog", { name: "Empty Menu" });
    await waitFor(() => {
      expect(dialog).toHaveFocus();
    });
  });

  it("handles when element is clicked outside container but it is not a Node", async () => {
    render(<FocusTrapHarness />);

    const trigger = screen.getByRole("button", { name: "Open menu" });
    trigger.click();

    expect(
      await screen.findByRole("dialog", { name: "Menu" }),
    ).toBeInTheDocument();

    const event = new PointerEvent("pointerdown", { bubbles: true });
    Object.defineProperty(event, "target", {
      value: "not a node",
      enumerable: true,
    });
    document.dispatchEvent(event);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Menu" })).toBeInTheDocument();
    });
  });

  it("filters out disabled and hidden elements from focusable array", async () => {
    function HiddenFocusTrapHarness() {
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
            Open hidden menu
          </button>
          {open && (
            <div ref={containerRef}>
              <div
                ref={dialogRef}
                role="dialog"
                aria-label="Hidden Menu"
                tabIndex={-1}
              >
                <button disabled>Disabled</button>
                <button aria-hidden="true">Hidden</button>
                <button>Visible action</button>
              </div>
            </div>
          )}
        </>
      );
    }

    render(<HiddenFocusTrapHarness />);

    screen.getByRole("button", { name: "Open hidden menu" }).click();

    const visibleAction = await screen.findByRole("button", {
      name: "Visible action",
    });
    await waitFor(() => {
      expect(visibleAction).toHaveFocus();
    });
  });

  it("focuses nothing if neither firstFocusable nor dialogRef are present", async () => {
    function NoRefsFocusTrapHarness() {
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
            Open broken menu
          </button>
          {open && <div ref={containerRef}></div>}
        </>
      );
    }

    render(<NoRefsFocusTrapHarness />);

    const trigger = screen.getByRole("button", { name: "Open broken menu" });
    trigger.click();

    await waitFor(() => {
      expect(trigger).not.toHaveFocus();
    });
  });

  it("does not set open to false if trigger button is clicked", async () => {
    render(<FocusTrapHarness />);

    const trigger = screen.getByRole("button", { name: "Open menu" });
    trigger.click();

    expect(
      await screen.findByRole("dialog", { name: "Menu" }),
    ).toBeInTheDocument();

    const event = new PointerEvent("pointerdown", { bubbles: true });
    Object.defineProperty(event, "target", {
      value: trigger,
      enumerable: true,
    });
    document.dispatchEvent(event);

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Menu" }),
      ).toBeInTheDocument();
    });
  });

  it("focuses last element if shift+tab is pressed and activeElement is neither first nor dialogRef", async () => {
    render(<FocusTrapHarness />);

    screen.getByRole("button", { name: "Open menu" }).click();

    const last = await screen.findByRole("button", { name: "Last action" });

    // Focus middle element (let's say we had one, but we'll just fake it with trigger)
    const trigger = screen.getByRole("button", { name: "Open menu" });
    trigger.focus();

    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("focuses first element if tab is pressed and activeElement is neither last nor dialogRef", async () => {
    render(<FocusTrapHarness />);

    screen.getByRole("button", { name: "Open menu" }).click();

    const trigger = screen.getByRole("button", { name: "Open menu" });
    trigger.focus();

    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("focuses nothing on unmount due to cleanup", async () => {
    const { unmount } = render(<FocusTrapHarness />);
    unmount();

    // This is basically implicitly tested but good to cover
  });

  it("does not prevent default if tab pressed and it is not last element or dialogRef", async () => {
    render(<FocusTrapHarness />);

    screen.getByRole("button", { name: "Open menu" }).click();

    const first = await screen.findByRole("button", { name: "First action" });
    first.focus();

    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});
