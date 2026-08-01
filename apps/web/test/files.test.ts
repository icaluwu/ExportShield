import { describe, expect, it } from "vitest";
import { inspectUpload, maximumUploadSize } from "../functions/lib/files";
import type { Env } from "../functions/lib/types";

const env = { MAX_UPLOAD_SIZE: "10485760" } as Env;

describe("private evidence validation", () => {
  it("accepts a PDF by magic bytes and recomputes its SHA-256", async () => {
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])], "report.pdf", { type: "application/pdf" });
    const result = await inspectUpload(file, env);
    expect(result.extension).toBe("pdf");
    expect(result.originalName).toBe("report.pdf");
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects a forged MIME declaration", async () => {
    const file = new File(["not a pdf"], "report.pdf", { type: "application/pdf" });
    await expect(inspectUpload(file, env)).rejects.toMatchObject({ code: "FILE_SIGNATURE_INVALID", status: 415 });
  });

  it("caps configured upload limits at 10 MB", () => {
    expect(maximumUploadSize({ MAX_UPLOAD_SIZE: "999999999" } as Env)).toBe(10 * 1024 * 1024);
  });
});
