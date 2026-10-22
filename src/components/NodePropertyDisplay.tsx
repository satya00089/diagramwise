import React from "react";
import DOMPurify from "dompurify";
import type { PropertyValue } from "../types/canvas";

interface NodePropertyDisplayProps {
  propertyKey: string;
  value: PropertyValue;
}

const renderArrayValue = (value: unknown[]): React.ReactNode => {
  if (value.length === 0) return <span className="opacity-60 italic">[ ]</span>;

  return (
    <div className="flex flex-col gap-1">
      {value.map((item, index) => (
        <div key={index} className="ml-2 opacity-70">
          • {String(item)}
        </div>
      ))}
    </div>
  );
};

const renderObjectValue = (value: object): React.ReactNode => (
  <div className="flex flex-col gap-1">
    {Object.entries(value).map(([key, entry]) => (
      <div key={key} className="ml-2 opacity-70">
        <span className="font-semibold">{key}:</span> {String(entry)}
      </div>
    ))}
  </div>
);

const renderStringValue = (value: string): React.ReactNode => {
  if (value.includes("<") && value.includes(">")) {
    const sanitized = DOMPurify.sanitize(value);
    const textOnly = sanitized
      .split("<")
      .map((part) => part.slice(part.indexOf(">") + 1))
      .join(" ")
      .replaceAll("\n", " ")
      .trim();

    if (textOnly.length === 0)
      return <span className="opacity-60 italic">empty</span>;

    return (
      <div
        className="text-xs [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:ml-1 [&_p]:mb-1 [&_p:last-child]:mb-0"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }

  if (value.length === 0) return <span className="opacity-60 italic">empty</span>;
  return <span className="break-words">{value}</span>;
};

const renderPropertyValue = (value: PropertyValue): React.ReactNode => {
  if (value === null || value === undefined)
    return <span className="opacity-60 italic">empty</span>;
  if (typeof value === "function")
    return <span className="text-purple-500 italic">[Component]</span>;
  if (typeof value === "boolean")
    return (
      <span className={value ? "text-green-500" : "text-red-500"}>
        {value ? "✓ true" : "✗ false"}
      </span>
    );
  if (typeof value === "number")
    return <span className="font-mono text-blue-500">{value}</span>;
  if (Array.isArray(value)) return renderArrayValue(value);
  if (typeof value === "object") return renderObjectValue(value);
  return renderStringValue(String(value));
};

const NodePropertyDisplay: React.FC<NodePropertyDisplayProps> = ({
  propertyKey,
  value,
}) => {
  return (
    <div className="flex flex-col gap-1 p-2 rounded bg-[var(--bg-hover)]/30">
      <div
        className="opacity-60 font-semibold capitalize tracking-wide"
        style={{ fontSize: "0.65rem" }}
      >
        {propertyKey
          .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
          .replaceAll(/([A-Z])([A-Z][a-z])/g, "$1 $2")}
      </div>
      <div className="break-words overflow-wrap-anywhere">
        {renderPropertyValue(value)}
      </div>
    </div>
  );
};

export default NodePropertyDisplay;
