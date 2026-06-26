import { describe, expect, it } from "vitest";
import { materialNoticePath } from "../lib/material-notices";

describe("materialNoticePath", () => {
  it("builds an encoded materials notice URL", () => {
    expect(materialNoticePath("error", "Cannot delete assigned work.")).toBe(
      "/teacher/materials?materialsStatus=error&materialsMessage=Cannot+delete+assigned+work."
    );
  });
});
