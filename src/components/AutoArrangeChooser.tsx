import { useState } from "react";
import {
  MdAccountTree,
  MdDeviceHub,
  MdGridView,
  MdViewColumn,
} from "react-icons/md";
import SelectDropdown from "./shared/SelectDropdown";
import type { AutoArrangeOptions } from "../utils/autoArrange";
import "./AutoArrangeChooser.css";

const choices = [
  {
    algorithm: "layered",
    label: "Left-right",
    description:
      "Follow connections across the canvas. Best for architectures and dependency chains.",
    icon: MdAccountTree,
  },
  {
    algorithm: "pipeline",
    label: "Pipeline",
    description:
      "Align connected stages in columns, with parallel nodes stacked together.",
    icon: MdViewColumn,
  },
  {
    algorithm: "snowflake",
    label: "Hub-and-spoke",
    description:
      "Place the most connected nodes at the center, with related nodes around them.",
    icon: MdDeviceHub,
  },
  {
    algorithm: "compact",
    label: "Compact",
    description:
      "Pack nodes into a compact area. Useful for overviews and diagrams with few connections.",
    icon: MdGridView,
  },
] as const;

type Props = Readonly<{
  onArrange: (options: AutoArrangeOptions) => void;
  onDone: () => void;
}>;

export default function AutoArrangeChooser({
  onArrange,
  onDone,
}: Props) {
  const [direction, setDirection] = useState<"LR" | "TB">("LR");

  return (
    <div className="auto-arrange-chooser nodrag nopan nowheel">
      <h3 className="auto-arrange-title">Arrange layout</h3>
      <div className="auto-arrange-options">
        {choices.map(({ algorithm, label, description, icon: Icon }) => (
          <button
            key={algorithm}
            type="button"
            onClick={() => {
              onArrange({ algorithm, direction });
              onDone();
            }}
          >
            <Icon className="auto-arrange-icon" aria-hidden="true" />
            <span>
              <span className="auto-arrange-label">
                {algorithm === "layered" && direction === "TB"
                  ? "Top-bottom"
                  : label}
              </span>
              <span className="auto-arrange-description">
                {algorithm === "pipeline" && direction === "TB"
                  ? "Align connected stages in rows, with parallel nodes side by side."
                  : description}
              </span>
            </span>
          </button>
        ))}
      </div>
      <footer className="auto-arrange-footer">
        <label htmlFor="auto-arrange-direction">Layered direction</label>
        <div className="auto-arrange-direction-control">
          <SelectDropdown
            id="auto-arrange-direction"
            value={direction === "LR" ? "Left to right" : "Top to bottom"}
            options={["Left to right", "Top to bottom"]}
            aria-label="Layered direction"
            onChange={(value) =>
              setDirection(value === "Left to right" ? "LR" : "TB")
            }
            className="auto-arrange-direction-trigger"
          />
        </div>
        <p>
          Direction applies to the first two layouts. Arranges the whole
          diagram, including groups.
        </p>
      </footer>
    </div>
  );
}
