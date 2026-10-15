import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectIntentDialog } from "./ProjectIntentDialog";

describe("ProjectIntentDialog", () => {
  it("marks the design title as required when saving", () => {
    const html = renderToStaticMarkup(
      <ProjectIntentDialog
        onSubmit={() => undefined}
        onSkip={() => undefined}
        heading="Save Your Design"
        titleLabel="Design title"
        titleRequired
      />,
    );

    expect(html).toContain("Design title *");
    expect(html).toMatch(/id="project-title"[^>]*required/);
  });
});
