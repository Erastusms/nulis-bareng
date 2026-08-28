import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageSidebar } from "./PageSidebar";
import * as useDocsModule from "../hooks/use-documents";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("PageSidebar Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render page list and deduplicate duplicate page IDs gracefully", () => {
    const mockPages = [
      {
        id: "page_1",
        workspaceId: "ws_123",
        title: "Architecture Specs",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "page_1", // Duplicate ID (e.g. from concurrent optimistic + websocket arrival)
        workspaceId: "ws_123",
        title: "Architecture Specs",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "page_2",
        workspaceId: "ws_123",
        title: "Product Vision",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    vi.spyOn(useDocsModule, "usePages").mockReturnValue({
      data: mockPages,
      isLoading: false,
      error: null,
    } as any);

    vi.spyOn(useDocsModule, "useCreatePage").mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.spyOn(useDocsModule, "useDeletePage").mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(<PageSidebar workspaceId="ws_123" activePageId="page_1" />);

    // Check header count displays deduplicated count (2)
    expect(screen.getByText("2")).toBeInTheDocument();

    // Verify both unique titles exist without duplication crashes
    expect(screen.getByText("Architecture Specs")).toBeInTheDocument();
    expect(screen.getByText("Product Vision")).toBeInTheDocument();

    // Links rendered should only be 2, not 3
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
  });
});
