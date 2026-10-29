import { useModalDialog } from "../hooks/useModalDialog";
import React, { useMemo, useState } from "react";
import {
  MdAccountTree,
  MdClose,
  MdCode,
  MdDownload,
  MdStorage,
  MdUpload,
} from "react-icons/md";
import type { ExtensionImportResult } from "../types/extensions";
import { parseExtensionSource } from "../utils/extensionImport";

type ImageFormat = "png" | "jpeg" | "svg";

type ExtensionHubProps = {
  isOpen: boolean;
  onClose: () => void;
  onImport: (result: ExtensionImportResult, sourceName: string) => void;
  onImportDesign: () => void;
  onExportImage: (format: ImageFormat, transparent: boolean) => void;
  onExportJSON: () => void;
  onExportXML: () => void;
  canExport: boolean;
};

const examples = {
  mermaid: `flowchart LR\n  client[Web Client] --> api[API Gateway]\n  api --> service[Order Service]\n  service --> db[(Orders DB)]`,
  "database-schema": `CREATE TABLE users (\n  id UUID PRIMARY KEY,\n  email VARCHAR(255) NOT NULL\n);\n\nCREATE TABLE orders (\n  id UUID PRIMARY KEY,\n  user_id UUID NOT NULL REFERENCES users(id),\n  created_at TIMESTAMP NOT NULL\n);`,
};

function ImportReport({
  error,
  parsed,
}: Readonly<{ error: string | null; parsed: ExtensionImportResult | null }>) {
  if (error)
    return (
      <div
        className="mt-4 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"
        role="alert"
      >
        {error}
      </div>
    );
  if (!parsed)
    return (
      <p className="mt-4 text-sm text-muted">
        Add source to see a recognition report.
      </p>
    );
  return (
    <>
      <p className="mt-4 text-lg font-semibold text-theme">{parsed.summary}</p>
      {typeof parsed.catalogMatches === "number" && (
        <p className="mt-2 text-sm text-muted">
          {parsed.catalogMatches} component
          {parsed.catalogMatches === 1 ? "" : "s"} matched from the Diagramwise
          catalog; {parsed.fallbackNodes ?? 0} kept as generic editable node
          {parsed.fallbackNodes === 1 ? "" : "s"}.
        </p>
      )}
      <p className="mt-2 text-sm text-muted">
        Imported elements retain source metadata so future linting can explain
        where they came from.
      </p>
      {parsed.warnings.length > 0 && (
        <output className="mt-4 block space-y-2">
          {parsed.warnings.map((warning) => (
            <p
              key={warning}
              className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200"
            >
              {warning}
            </p>
          ))}
        </output>
      )}
    </>
  );
}

const ExtensionHub: React.FC<ExtensionHubProps> = ({
  isOpen,
  onClose,
  onImport,
  onImportDesign,
  onExportImage,
  onExportJSON,
  onExportXML,
  canExport,
}) => {
  const dialogRef = useModalDialog(isOpen);
  const [mode, setMode] = useState<"import" | "export">("import");
  const [kind, setKind] = useState<"mermaid" | "database-schema">("mermaid");
  const [source, setSource] = useState(examples.mermaid);
  const [sourceName, setSourceName] = useState("Pasted source");
  const [transparentBg, setTransparentBg] = useState(false);

  const { parsed, error } = useMemo(() => {
    try {
      return { parsed: parseExtensionSource(kind, source), error: null };
    } catch (parseError) {
      return {
        parsed: null,
        error:
          parseError instanceof Error
            ? parseError.message
            : "Unable to parse this source.",
      };
    }
  }, [kind, source]);

  if (!isOpen) return null;

  const selectKind = (nextKind: "mermaid" | "database-schema") => {
    setKind(nextKind);
    setSource(examples[nextKind]);
    setSourceName(nextKind === "mermaid" ? "Pasted Mermaid" : "Pasted schema");
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSource(await file.text());
    setSourceName(file.name);
    event.target.value = "";
  };

  const importOptions = [
    {
      id: "design-file",
      label: "Diagramwise file",
      description: "JSON or XML design file",
      icon: MdUpload,
      onClick: onImportDesign,
      active: false,
    },
    {
      id: "mermaid",
      label: "Mermaid",
      description: "Flowcharts and service maps",
      icon: MdAccountTree,
      onClick: () => selectKind("mermaid"),
      active: kind === "mermaid",
    },
    {
      id: "database-schema",
      label: "Database schema",
      description: "SQL tables and relationships",
      icon: MdStorage,
      onClick: () => selectKind("database-schema"),
      active: kind === "database-schema",
    },
  ];

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby="extension-hub-title"
      className="m-0 h-full max-h-none w-full max-w-none border-0 fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4"
    >
      <section className="flex max-h-[min(760px,92vh)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-theme/10 bg-surface shadow-2xl">
        <header className="flex items-start justify-between border-b border-theme/10 px-6 py-5">
          <div>
            <h2
              id="extension-hub-title"
              className="text-xl font-bold text-theme"
            >
              Extensions
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Bring architecture into Diagramwise or export the design you have
              built.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-[var(--bg-hover)] hover:text-theme"
            aria-label="Close extensions"
          >
            <MdClose className="h-5 w-5" />
          </button>
        </header>

        <div className="border-b border-theme/10 px-6">
          <div
            className="flex gap-5"
            role="tablist"
            aria-label="Extension tasks"
          >
            {(["import", "export"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={mode === tab}
                onClick={() => setMode(tab)}
                className={`border-b-2 px-1 py-3 text-sm font-semibold capitalize transition-colors ${mode === tab ? "border-[var(--brand)] text-[var(--brand)]" : "border-transparent text-muted hover:text-theme"}`}
              >
                {tab} design
              </button>
            ))}
          </div>
        </div>

        {mode === "import" ? (
          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <nav
              aria-label="Architecture import extensions"
              className="space-y-2"
            >
              {importOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={option.onClick}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${option.active ? "border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_10%,transparent)]" : "border-theme/10 hover:bg-[var(--bg-hover)]"}`}
                  >
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand)]" />
                    <span>
                      <span className="block text-sm font-semibold text-theme">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-xs text-muted">
                        {option.description}
                      </span>
                    </span>
                  </button>
                );
              })}
              <div className="mt-5 rounded-xl border border-dashed border-theme/15 p-3 text-xs text-muted">
                <MdCode className="mb-2 h-5 w-5" />
                More source adapters will plug into this same review flow.
              </div>
            </nav>

            <div className="grid min-h-0 gap-4 lg:grid-cols-2">
              <div className="flex min-h-[320px] flex-col">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label
                    htmlFor="extension-source"
                    className="text-sm font-semibold text-theme"
                  >
                    Source
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[var(--brand)]">
                    <MdUpload className="h-4 w-4" />
                    Upload file
                    <input
                      type="file"
                      accept={
                        kind === "mermaid" ? ".mmd,.mermaid,.txt" : ".sql,.txt"
                      }
                      onChange={handleFile}
                      className="hidden"
                    />
                  </label>
                </div>
                <textarea
                  id="extension-source"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  spellCheck={false}
                  className="min-h-0 flex-1 resize-none rounded-xl border border-theme/15 bg-[var(--bg)] p-4 font-mono text-xs leading-5 text-theme outline-none transition-colors focus:border-[var(--brand)]"
                  aria-describedby="extension-source-help"
                />
                <p
                  id="extension-source-help"
                  className="mt-2 text-xs text-muted"
                >
                  {sourceName} · Your current canvas will not change until you
                  confirm the import.
                </p>
              </div>

              <div className="flex min-h-[320px] flex-col rounded-xl border border-theme/10 bg-[var(--bg)] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-theme">
                    Import report
                  </h3>
                  {parsed && (
                    <span className="import-ready-badge">Ready to import</span>
                  )}
                </div>
                {<ImportReport error={error} parsed={parsed} />}
                <div className="mt-auto flex flex-col gap-2 pt-6 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:bg-[var(--bg-hover)] hover:text-theme"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!parsed}
                    onClick={() => parsed && onImport(parsed, sourceName)}
                    className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[var(--muted)] disabled:text-[var(--bg)] disabled:opacity-100 disabled:hover:opacity-100"
                  >
                    Replace canvas with import
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid flex-1 gap-5 overflow-y-auto p-6 md:grid-cols-[minmax(0,1fr)_260px]">
            <div className="rounded-xl border border-theme/10 bg-[var(--bg)] p-5">
              <h3 className="text-base font-semibold text-theme">
                Export design
              </h3>
              <p className="mt-1 text-sm text-muted">
                Choose an image for sharing or a data file you can bring back
                into Diagramwise.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {(["png", "jpeg", "svg"] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    disabled={!canExport}
                    onClick={() => onExportImage(format, transparentBg)}
                    className="rounded-xl border border-theme/10 bg-surface px-4 py-4 text-left transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <MdDownload className="mb-3 h-5 w-5 text-[var(--brand)]" />
                    <span className="block text-sm font-semibold uppercase text-theme">
                      {format}
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {format === "svg" ? "Editable vector" : "Image file"}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-6 border-t border-theme/10 pt-5">
                <h4 className="text-sm font-semibold text-theme">
                  Design data
                </h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canExport}
                    onClick={onExportJSON}
                    className="rounded-lg border border-theme/10 px-4 py-2 text-sm font-medium text-theme hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Export JSON
                  </button>
                  <button
                    type="button"
                    disabled={!canExport}
                    onClick={onExportXML}
                    className="rounded-lg border border-theme/10 px-4 py-2 text-sm font-medium text-theme hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Export XML
                  </button>
                </div>
              </div>
            </div>
            <aside className="rounded-xl border border-theme/10 p-5">
              <h3 className="text-sm font-semibold text-theme">
                Image background
              </h3>
              <label
                htmlFor="extension-transparent-bg"
                className="mt-4 flex cursor-pointer items-start gap-3"
              >
                <input
                  id="extension-transparent-bg"
                  aria-label="Transparent image background"
                  type="checkbox"
                  checked={transparentBg}
                  onChange={(event) => setTransparentBg(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
                />
                <span>
                  <span className="block text-sm font-medium text-theme">
                    Transparent
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted">
                    Apply to PNG and SVG. JPEG always uses white.
                  </span>
                </span>
              </label>
              {!canExport && (
                <p className="mt-5 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                  Add at least one component before exporting.
                </p>
              )}
            </aside>
          </div>
        )}
      </section>
    </dialog>
  );
};

export default ExtensionHub;
