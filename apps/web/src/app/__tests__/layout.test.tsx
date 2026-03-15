import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RootLayout, { metadata } from "../layout";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

vi.mock("@/components/auth-provider", () => ({
  AuthProvider: ({ children }: any) => <div data-testid="auth">{children}</div>,
}));

vi.mock("@/components/header", () => ({
  Header: () => <header>Header</header>,
}));

vi.mock("@/components/toast", () => ({
  ToastContainer: () => <div>ToastContainer</div>,
}));

vi.mock("@vercel/analytics/next", () => ({
  Analytics: () => <div>Analytics</div>,
}));

vi.mock("@vercel/speed-insights/next", () => ({
  SpeedInsights: () => <div>SpeedInsights</div>,
}));

describe("RootLayout", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the shared application shell", () => {
    render(
      <RootLayout>
        <div>Page content</div>
      </RootLayout>,
    );

    expect(screen.getByText("Header")).toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(screen.getByText("ToastContainer")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("SpeedInsights")).toBeInTheDocument();
    expect(metadata.title).toBe("OpenShelf");
  });
});
