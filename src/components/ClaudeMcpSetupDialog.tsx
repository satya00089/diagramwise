import { useState } from "react";
import { HiArrowUpRight, HiCheck, HiClipboard, HiXMark } from "react-icons/hi2";
import { useModalDialog } from "../hooks/useModalDialog";

const connectorUrl = "https://mcp.diagramwise.com/mcp";
const claudeHelpUrl =
  "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp";

type ClaudeMcpSetupDialogProps = {
  onClose: () => void;
};

export default function ClaudeMcpSetupDialog({
  onClose,
}: ClaudeMcpSetupDialogProps) {
  const dialogRef = useModalDialog();
  const [copyStatus, setCopyStatus] = useState("");

  const copyConnectorUrl = async () => {
    try {
      await navigator.clipboard.writeText(connectorUrl);
      setCopyStatus("Connector URL copied.");
    } catch {
      setCopyStatus("Copy unavailable. Select and copy the URL above.");
    }
  };

  return (
    <dialog
      ref={dialogRef}
      id="claude-mcp-setup-dialog"
      className="systema-claude-dialog"
      aria-labelledby="claude-mcp-dialog-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="systema-claude-dialog-content">
        <div className="systema-claude-dialog-topline">
          <span>OPTIONAL CONNECTION</span>
          <button
            type="button"
            className="systema-claude-icon-button"
            onClick={onClose}
            aria-label="Close Claude setup guide"
          >
            <HiXMark aria-hidden="true" />
          </button>
        </div>
        <h2 id="claude-mcp-dialog-title">Use Diagramwise with Claude</h2>
        <p className="systema-claude-dialog-intro">
          Connect Diagramwise as a remote MCP connector to explore components
          and work on architecture from Claude.
        </p>

        <div className="systema-claude-endpoint">
          <code>{connectorUrl}</code>
          <button
            type="button"
            className="systema-claude-copy-button"
            onClick={copyConnectorUrl}
          >
            {copyStatus === "Connector URL copied." ? (
              <HiCheck aria-hidden="true" />
            ) : (
              <HiClipboard aria-hidden="true" />
            )}
            {copyStatus === "Connector URL copied." ? "Copied" : "Copy URL"}
          </button>
        </div>
        <span className="systema-claude-copy-status" aria-live="polite">
          {copyStatus}
        </span>

        <ol className="systema-claude-steps">
          <li>
            In Claude, open <strong>Customize → Connectors</strong> and choose
            <strong> Add custom connector</strong>.
          </li>
          <li>
            Name it <strong>Diagramwise</strong>, paste the URL above, then
            choose <strong>Sign in now</strong>.
          </li>
          <li>
            Sign in to Diagramwise and enable the connector in the chat where
            you want to use it.
          </li>
        </ol>

        <div className="systema-claude-access-note">
          <strong>What it can do</strong>
          <p>
            Read component information and validate designs; with your
            permission, create and save architecture work. Sign-in happens
            securely with Diagramwise—Claude does not receive your password.
          </p>
        </div>

        <p className="systema-claude-dialog-footnote">
          On Claude Team or Enterprise, an organization owner may need to add
          the connector first.{" "}
          <a href={claudeHelpUrl} target="_blank" rel="noreferrer">
            See Claude’s setup instructions{" "}
            <HiArrowUpRight aria-hidden="true" />
          </a>
        </p>

        <button
          type="button"
          className="systema-claude-done-button"
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </dialog>
  );
}
