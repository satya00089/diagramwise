import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SelectDropdown from "./SelectDropdown";

function renderSelect(size?: "small" | "default" | "large") {
  return renderToStaticMarkup(
    <SelectDropdown
      id="behavior"
      value="queue"
      options={[
        { value: "queue", label: "Message queue" },
        { value: "service", label: "Service" },
      ]}
      onChange={() => {}}
      aria-label="Behavior"
      {...(size ? { size } : {})}
    />,
  );
}

describe("SelectDropdown", () => {
  it("uses the default size when no size is provided", () => {
    const markup = renderSelect();

    expect(markup).toContain("dashboard-select-trigger--default");
    expect(markup).toContain("Message queue");
  });

  it.each(["small", "default", "large"] as const)(
    "applies the %s size variant",
    (size) => {
      expect(renderSelect(size)).toContain(`dashboard-select-trigger--${size}`);
    },
  );
});
