import { useRef, useState } from "react";
import { HiArrowUpRight, HiCheck, HiClipboard, HiXMark } from "react-icons/hi2";
import { useModalDialog } from "../hooks/useModalDialog";

const providers = ["chatgpt", "claude", "gemini"] as const;
type Provider = (typeof providers)[number];
type GeminiClient = "apps" | "cli";

const connectionDetails = {
  chatgpt: {
    name: "ChatGPT",
    endpoint: "https://mcp.diagramwise.com/mcp",
    helpUrl:
      "https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt",
  },
  claude: {
    name: "Claude",
    endpoint: "https://mcp.diagramwise.com/mcp",
    helpUrl:
      "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp",
  },
  gemini: {
    name: "Gemini Apps",
    endpoint: "https://mcp.diagramwise.com/mcp",
    helpUrl: "https://support.google.com/gemini/answer/17209137?hl=en",
  },
} as const;

type AiConnectionGuideDialogProps = {
  onClose: () => void;
};

export default function AiConnectionGuideDialog({
  onClose,
}: AiConnectionGuideDialogProps) {
  const dialogRef = useModalDialog();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [provider, setProvider] = useState<Provider>("chatgpt");
  const [geminiClient, setGeminiClient] = useState<GeminiClient>("apps");
  const [copyStatus, setCopyStatus] = useState("");
  const activeConnection = connectionDetails[provider];

  const selectProvider = (nextProvider: Provider) => {
    setProvider(nextProvider);
    setCopyStatus("");
  };

  const selectGeminiClient = (nextClient: GeminiClient) => {
    setGeminiClient(nextClient);
    setCopyStatus("");
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = providers.indexOf(provider);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight")
      nextIndex = (currentIndex + 1) % providers.length;
    else if (event.key === "ArrowLeft")
      nextIndex = (currentIndex - 1 + providers.length) % providers.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = providers.length - 1;
    else return;

    event.preventDefault();
    selectProvider(providers[nextIndex]);
    tabRefs.current[nextIndex]?.focus();
  };

  const copyConnectorUrl = async () => {
    try {
      await navigator.clipboard.writeText(activeConnection.endpoint);
      setCopyStatus("Connection URL copied.");
    } catch {
      setCopyStatus("Copy unavailable. Select and copy the URL above.");
    }
  };

  return (
    <dialog
      ref={dialogRef}
      id="ai-connection-guide-dialog"
      className="systema-ai-dialog"
      aria-labelledby="ai-connection-dialog-title"
      onCancel={onClose}
    >
      <div className="systema-ai-dialog-content">
        <div className="systema-ai-dialog-topline">
          <span>OPTIONAL CONNECTION</span>
          <button
            type="button"
            className="systema-ai-icon-button"
            onClick={onClose}
            aria-label="Close AI connection guide"
          >
            <HiXMark aria-hidden="true" />
          </button>
        </div>
        <h2 id="ai-connection-dialog-title">
          Connect Diagramwise to your AI assistant
        </h2>
        <p className="systema-ai-dialog-intro">
          Create and refine architectures in Diagramwise from your AI workspace.
          Choose the assistant you use below.
        </p>

        <div
          className="systema-ai-provider-tabs"
          role="tablist"
          aria-label="AI provider"
        >
          {providers.map((item, index) => {
            const label =
              item === "chatgpt"
                ? "ChatGPT"
                : item === "claude"
                  ? "Claude"
                  : "Gemini";
            return (
              <button
                key={item}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                type="button"
                role="tab"
                id={`ai-provider-tab-${item}`}
                aria-selected={provider === item}
                aria-controls="ai-provider-panel"
                tabIndex={provider === item ? 0 : -1}
                onClick={() => selectProvider(item)}
                onKeyDown={handleTabKeyDown}
              >
                {label}
              </button>
            );
          })}
        </div>

        <section
          id="ai-provider-panel"
          className="systema-ai-provider-panel"
          role="tabpanel"
          aria-labelledby={`ai-provider-tab-${provider}`}
          tabIndex={0}
        >
          {provider === "gemini" ? (
            <div>
              <div
                className="systema-ai-gemini-options"
                role="group"
                aria-label="Gemini connection options"
              >
                <button
                  type="button"
                  aria-pressed={geminiClient === "apps"}
                  onClick={() => selectGeminiClient("apps")}
                >
                  Gemini Apps
                </button>
                <button
                  type="button"
                  aria-pressed={geminiClient === "cli"}
                  onClick={() => selectGeminiClient("cli")}
                >
                  Gemini CLI
                  <span className="systema-ai-tab-status">Soon</span>
                </button>
              </div>
              {geminiClient === "cli" ? (
                <div className="systema-ai-coming-soon-panel">
                  <p className="systema-ai-coming-soon-eyebrow">
                    IN DEVELOPMENT
                  </p>
                  <h3>Gemini CLI is coming soon</h3>
                  <p>
                    We’ve tested Diagramwise with Gemini Apps. Gemini CLI
                    instructions will follow after separate end-to-end testing.
                  </p>
                </div>
              ) : (
                <>
                  <p className="systema-ai-connection-summary">
                    Connect Gemini Apps to Diagramwise to create and save
                    architecture in your account.
                  </p>
                  <div className="systema-ai-endpoint">
                    <code>{activeConnection.endpoint}</code>
                    <button
                      type="button"
                      className="systema-ai-copy-button"
                      onClick={copyConnectorUrl}
                    >
                      {copyStatus === "Connection URL copied." ? (
                        <HiCheck aria-hidden="true" />
                      ) : (
                        <HiClipboard aria-hidden="true" />
                      )}
                      {copyStatus === "Connection URL copied."
                        ? "Copied"
                        : "Copy URL"}
                    </button>
                  </div>
                  <span className="systema-ai-copy-status" aria-live="polite">
                    {copyStatus}
                  </span>

                  <ol className="systema-ai-steps">
                    <li>
                      In Gemini on the web, open <strong>Settings</strong> and
                      choose <strong>Connected Apps</strong>.
                    </li>
                    <li>
                      Under <strong>Custom apps</strong>, choose{" "}
                      <strong>Add a custom app</strong>, paste the URL above,
                      and select <strong>Next</strong>.
                    </li>
                    <li>
                      Complete the Google sign-in and Diagramwise authorization
                      prompts to connect your account.
                    </li>
                    <li>
                      In a Gemini chat, type <strong>@Diagramwise</strong> and
                      select the app. Describe the architecture you want; when
                      Gemini asks to use Diagramwise’s{" "}
                      <strong>create architecture</strong> action, choose{" "}
                      <strong>Allow</strong> to create and save it.
                    </li>
                  </ol>

                  <p className="systema-ai-dialog-footnote">
                    Google currently requires an eligible personal account in
                    the US, age 18 or older, with Keep Activity enabled.{" "}
                    <a
                      href={activeConnection.helpUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      See setup and eligibility details{" "}
                      <HiArrowUpRight aria-hidden="true" />
                    </a>
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              <p className="systema-ai-connection-summary">
                {provider === "chatgpt"
                  ? "Connect ChatGPT to Diagramwise so it can help you design and save architecture to your account."
                  : "Connect Claude to Diagramwise so it can help you design and save architecture to your account."}
              </p>
              <div className="systema-ai-endpoint">
                <code>{activeConnection.endpoint}</code>
                <button
                  type="button"
                  className="systema-ai-copy-button"
                  onClick={copyConnectorUrl}
                >
                  {copyStatus === "Connection URL copied." ? (
                    <HiCheck aria-hidden="true" />
                  ) : (
                    <HiClipboard aria-hidden="true" />
                  )}
                  {copyStatus === "Connection URL copied."
                    ? "Copied"
                    : "Copy URL"}
                </button>
              </div>
              <span className="systema-ai-copy-status" aria-live="polite">
                {copyStatus}
              </span>

              {provider === "chatgpt" ? (
                <>
                  <ol className="systema-ai-steps">
                    <li>
                      In a supported ChatGPT workspace, open{" "}
                      <strong>Settings → Apps</strong> and enable{" "}
                      <strong>Developer mode</strong>. Your workspace admin may
                      need to allow custom apps.
                    </li>
                    <li>
                      Choose <strong>Create app</strong>, name it Diagramwise,
                      paste the URL above, select <strong>OAuth</strong>, and
                      scan the available tools.
                    </li>
                    <li>
                      Sign in or create your Diagramwise account when prompted,
                      authorize the connection, then finish creating the app.
                      Select Diagramwise from the tools menu in a chat.
                    </li>
                  </ol>
                  <div className="systema-ai-access-note">
                    <strong>Design and save with Diagramwise</strong>
                    <p>
                      Your authorized Diagramwise account is used to create and
                      save architecture. Full MCP write actions require a
                      supported Business, Enterprise, or Edu workspace.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <ol className="systema-ai-steps">
                    <li>
                      In Claude, open <strong>Customize → Connectors</strong>{" "}
                      and choose <strong>Add custom connector</strong>.
                    </li>
                    <li>
                      Name it <strong>Diagramwise</strong>, paste the URL above,
                      then choose <strong>Sign in now</strong>.
                    </li>
                    <li>
                      Sign in or create your Diagramwise account, authorize the
                      connection, then enable it in the chat where you want to
                      work on an architecture.
                    </li>
                  </ol>
                  <div className="systema-ai-access-note">
                    <strong>Design and save with Diagramwise</strong>
                    <p>
                      Use Claude to create and save architecture through the
                      Diagramwise account you authorize, then continue working
                      with your design in Diagramwise.
                    </p>
                  </div>
                </>
              )}

              <p className="systema-ai-dialog-footnote">
                {provider === "claude" &&
                  "On Claude Team or Enterprise, an organization owner may need to add the connector first. "}
                <a
                  href={activeConnection?.helpUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {provider === "chatgpt"
                    ? "See ChatGPT setup details"
                    : "See Claude setup instructions"}{" "}
                  <HiArrowUpRight aria-hidden="true" />
                </a>
              </p>
            </>
          )}
        </section>

        <button
          type="button"
          className="systema-ai-done-button"
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </dialog>
  );
}
