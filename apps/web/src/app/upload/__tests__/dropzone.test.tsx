import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileDropzone } from "@/components/upload/file-dropzone";

// Add a mock DataTransfer
class MockDataTransfer {
  files: File[] = [];
  items = {
    add: (f: File) => {
      this.files.push(f);
    },
  };
}

global.DataTransfer = MockDataTransfer as any;

describe("FileDropzone", () => {
  it("handles drop events correctly and filters invalid file types", () => {
    const mockOnAddFiles = vi.fn();

    render(
      <FileDropzone
        files={[]}
        onAddFiles={mockOnAddFiles}
        onRemoveFile={vi.fn()}
        onUpdateFileType={vi.fn()}
      />
    );

    const dropzone = screen.getByText("ファイルを複数選択").closest("button")!;

    const validFile = new File(["dummy"], "dragged.pdf", { type: "application/pdf" });
    const invalidFile = new File(["dummy"], "malicious.exe", { type: "application/x-msdownload" });

    const dragEvent = new Event("drop", { bubbles: true }) as any;
    Object.defineProperty(dragEvent, 'dataTransfer', {
      value: { files: [validFile, invalidFile] }
    });

    fireEvent(dropzone, dragEvent);

    expect(mockOnAddFiles).toHaveBeenCalledTimes(1);
    const passedFiles = mockOnAddFiles.mock.calls[0][0];
    expect(passedFiles.length).toBe(1);
    expect(passedFiles[0].name).toBe("dragged.pdf");
  });
});
