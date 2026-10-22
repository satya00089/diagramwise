import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  MdCheck,
  MdClose,
  MdContentCopy,
  MdImage,
  MdLockOutline,
  MdOpenInNew,
  MdPublic,
  MdRefresh,
  MdVisibilityOff,
} from "react-icons/md";
import { FaLinkedin } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { SiMedium } from "react-icons/si";
import { apiService } from "../services/api";
import useAnalytics from "../hooks/useAnalytics";
import type {
  ValidationResult,
  SystemDesignProblem,
} from "../types/systemDesign";
import type { User } from "../types/auth";

interface ShareToWorldModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessment: ValidationResult | null;
  problem: SystemDesignProblem | null;
  savedAttemptId: string | null;
  /** Pass the current free-design diagram ID to enable sharing from Design Studio. */
  diagramId?: string | null;
  /** Title shown when sharing a free-form diagram. */
  diagramTitle?: string;
  user: User | null;
  captureCanvasPng: () => Promise<string>;
  initiallyPublished?: boolean;
  publicUrl?: string | null;
  onVisibilityChange?: (isPublic: boolean, publicDiagramId?: string) => void;
}

type SharePhase =
  | "preview"
  | "publishing"
  | "published"
  | "unpublishing"
  | "error";

const PREVIEW_TIMEOUT_MS = 3000;

const getPublicUrl = (id: string) => {
  if (typeof window === "undefined") return `/public/${encodeURIComponent(id)}`;
  return `${window.location.origin}/public/${encodeURIComponent(id)}`;
};

const ShareToWorldModal: React.FC<ShareToWorldModalProps> = ({
  isOpen,
  onClose,
  assessment,
  problem,
  savedAttemptId,
  diagramId,
  diagramTitle,
  user,
  captureCanvasPng,
  initiallyPublished = false,
  publicUrl: initialPublicUrl = null,
  onVisibilityChange,
}) => {
  const reduceMotion = useReducedMotion();
  const { trackEvent } = useAnalytics({ isEnabled: true });
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const previewRequestRef = useRef(0);
  const captureCanvasPngRef = useRef(captureCanvasPng);

  const [phase, setPhase] = useState<SharePhase>("preview");
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [messageCopied, setMessageCopied] = useState<string | null>(null);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);

  useEffect(() => {
    captureCanvasPngRef.current = captureCanvasPng;
  }, [captureCanvasPng]);

  const mode: "attempt" | "diagram" | null = savedAttemptId
    ? "attempt"
    : diagramId
      ? "diagram"
      : null;
  const entityId = savedAttemptId ?? diagramId ?? null;
  const sharedTitle =
    mode === "attempt"
      ? (problem?.title ?? "System design solution")
      : diagramTitle?.trim() || "Untitled design";
  const score = assessment?.score ?? null;
  const isBusy = phase === "publishing" || phase === "unpublishing";
  const isPublished = phase === "published" || phase === "unpublishing";

  const statusCopy = useMemo(() => {
    if (score == null) return null;
    if (score >= 80) return "Strong architecture";
    if (score >= 60) return "Solid foundation";
    return "Work in progress";
  }, [score]);

  const defaultPost = useMemo(() => {
    const link = publicUrl ?? "";
    if (mode === "attempt") {
      const scoreCopy = score == null ? "" : ` with a score of ${score}/100`;
      return `I just completed “${sharedTitle}” on Diagramwise${scoreCopy}. Explore the architecture: ${link}\n\n#SystemDesign #SoftwareArchitecture`;
    }
    return `I published my system design “${sharedTitle}” on Diagramwise. Explore the architecture: ${link}\n\n#SystemDesign #SoftwareArchitecture`;
  }, [mode, publicUrl, score, sharedTitle]);

  const copyText = useCallback(async (value: string) => {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard access is unavailable");
    }
    await navigator.clipboard.writeText(value);
  }, []);

  const capturePreview = useCallback(async () => {
    const requestId = ++previewRequestRef.current;
    let timeoutId: number | undefined;
    setPreviewLoading(true);
    setPreviewError(false);
    try {
      const image = await Promise.race([
        captureCanvasPngRef.current(),
        new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(
            () => reject(new Error("Preview capture timed out")),
            PREVIEW_TIMEOUT_MS,
          );
        }),
      ]);
      if (previewRequestRef.current === requestId) setPreviewUrl(image);
    } catch {
      if (previewRequestRef.current === requestId) setPreviewError(true);
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (previewRequestRef.current === requestId) setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      previewRequestRef.current += 1;
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setPhase(initiallyPublished ? "published" : "preview");
    setPublicUrl(
      initiallyPublished && entityId
        ? initialPublicUrl || getPublicUrl(entityId)
        : null,
    );
    setError(null);
    setLinkCopied(false);
    setMessageCopied(null);
    setConfirmUnpublish(false);
    setPreviewUrl(null);
    void capturePreview();

    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      previousFocusRef.current?.focus();
    };
  }, [capturePreview, entityId, initiallyPublished, initialPublicUrl, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isBusy, isOpen, onClose]);

  const handlePublish = useCallback(async () => {
    if (!mode || !entityId || phase === "publishing") return;
    setPhase("publishing");
    setError(null);
    try {
      const result =
        mode === "attempt"
          ? await apiService.publishAttempt(entityId)
          : await apiService.publishDiagram(entityId);
      setPublicUrl(result.publicUrl);
      setPhase("published");
      trackEvent("public_share_completed", {
        artifact_type: mode,
        problem_id: problem?.id,
        visibility: "public",
      }, true);
      onVisibilityChange?.(
        true,
        mode === "diagram" && "diagramId" in result
          ? result.diagramId
          : undefined,
      );
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "The design could not be published. Check your connection and try again.",
      );
      setPhase("error");
    }
  }, [entityId, mode, onVisibilityChange, phase, problem?.id, trackEvent]);

  const handleUnpublish = useCallback(async () => {
    if (!mode || !entityId || phase === "unpublishing") return;
    setPhase("unpublishing");
    setError(null);
    try {
      if (mode === "attempt") await apiService.unpublishAttempt(entityId);
      else await apiService.unpublishDiagram(entityId);
      setPublicUrl(null);
      setConfirmUnpublish(false);
      setPhase("preview");
      onVisibilityChange?.(false);
    } catch {
      setError(
        "The design is still public. Check your connection and try unpublishing again.",
      );
      setPhase("published");
    }
  }, [entityId, mode, onVisibilityChange, phase]);

  const handleCopyLink = useCallback(async () => {
    if (!publicUrl) return;
    try {
      await copyText(publicUrl);
      setLinkCopied(true);
      setError(null);
      window.setTimeout(() => setLinkCopied(false), 2200);
    } catch {
      setError(
        "Your browser blocked automatic copying. Select the link and copy it manually.",
      );
    }
  }, [copyText, publicUrl]);

  const handleLinkedIn = useCallback(async () => {
    if (!publicUrl) return;
    try {
      await copyText(defaultPost);
      setMessageCopied("LinkedIn post copied");
    } catch {
      setMessageCopied(null);
    }
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(publicUrl)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }, [copyText, defaultPost, publicUrl]);

  const handleTwitter = useCallback(() => {
    if (!publicUrl) return;
    let post = `Explore my system design “${sharedTitle}” on Diagramwise.`;
    if (mode === "attempt") {
      const scoreCopy = score == null ? "" : ` — ${score}/100`;
      post = `I completed “${sharedTitle}” on Diagramwise${scoreCopy}.`;
    }
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(post)}&url=${encodeURIComponent(publicUrl)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }, [mode, publicUrl, score, sharedTitle]);

  const handleMedium = useCallback(async () => {
    if (!publicUrl) return;
    const article = `# ${sharedTitle}\n\n${defaultPost}`;
    try {
      await copyText(article);
      setMessageCopied("Article starter copied");
    } catch {
      setMessageCopied(null);
    }
    window.open(
      "https://medium.com/new-story",
      "_blank",
      "noopener,noreferrer",
    );
  }, [copyText, defaultPost, publicUrl, sharedTitle]);

  let previewContent: React.ReactNode;
  if (previewUrl) {
    previewContent = (
      <img
        src={previewUrl}
        alt={`Preview of ${sharedTitle}`}
        className="h-full w-full object-contain"
      />
    );
  } else if (previewLoading) {
    previewContent = (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted"
        aria-live="polite"
      >
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
        <span className="text-sm">Building a quick preview…</span>
      </div>
    );
  } else {
    previewContent = (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-muted">
        <MdImage size={30} aria-hidden />
        <div>
          <p className="text-sm font-semibold text-theme">Preview skipped</p>
          <p className="mt-1 text-xs leading-relaxed">
            Publishing is ready, and the interactive public canvas will still be
            available.
          </p>
        </div>
        {previewError && (
          <button
            type="button"
            onClick={() => void capturePreview()}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-[var(--brand)] hover:bg-[var(--brand)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            <MdRefresh aria-hidden /> Retry preview
          </button>
        )}
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <button
          type="button"
          aria-label="Close publish dialog"
          className="absolute inset-0 cursor-default bg-slate-950/70"
          onClick={() => !isBusy && onClose()}
          disabled={isBusy}
        />

        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="public-share-title"
          aria-describedby="public-share-description"
          tabIndex={-1}
          className="relative z-10 flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-[var(--surface)] text-theme shadow-[0_24px_80px_rgba(0,0,0,0.35)] outline-none sm:rounded-2xl"
          initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{
            duration: reduceMotion ? 0 : 0.22,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <header className="flex items-start gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-6 sm:py-5">
            <div
              className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                isPublished
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-[var(--brand)]/12 text-[var(--brand)]"
              }`}
              aria-hidden="true"
            >
              {isPublished ? <MdCheck size={22} /> : <MdPublic size={22} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="public-share-title"
                  className="text-lg font-bold leading-tight text-theme sm:text-xl"
                >
                  {isPublished ? "Your design is live" : "Publish your design"}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    isPublished
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-[var(--bg)] text-muted"
                  }`}
                >
                  {isPublished ? (
                    <MdPublic aria-hidden />
                  ) : (
                    <MdLockOutline aria-hidden />
                  )}
                  {isPublished ? "Public" : "Private"}
                </span>
              </div>
              <p
                id="public-share-description"
                className="mt-1 max-w-2xl text-sm leading-relaxed text-muted"
              >
                {isPublished
                  ? "Anyone with the link can explore this read-only design."
                  : "Review what people will see. Nothing becomes public until you confirm."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-[var(--bg-hover)] hover:text-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Close"
            >
              <MdClose size={20} />
            </button>
          </header>

          <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1.08fr)_minmax(280px,0.92fr)]">
            <section className="border-b border-[var(--border)] p-5 sm:p-6 lg:border-b-0 lg:border-r">
              <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[var(--bg)]">
                {previewContent}
              </div>

              <div className="mt-4 min-w-0">
                <h3 className="break-words text-base font-bold leading-snug text-theme">
                  {sharedTitle}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
                  <span className="truncate">
                    by {user?.name?.trim() || user?.email || "Anonymous"}
                  </span>
                  <span>
                    {mode === "attempt"
                      ? "Reviewed solution"
                      : "Free-form design"}
                  </span>
                  {score != null && (
                    <span className="font-semibold tabular-nums text-theme">
                      {score}/100{statusCopy ? ` · ${statusCopy}` : ""}
                    </span>
                  )}
                </div>
              </div>
            </section>

            <section className="flex min-h-[260px] flex-col p-5 sm:p-6">
              {!isPublished ? (
                <>
                  <div className="space-y-4">
                    <div className="flex gap-3 rounded-xl bg-[var(--bg)] p-4">
                      <MdPublic
                        className="mt-0.5 flex-shrink-0 text-[var(--brand)]"
                        size={20}
                        aria-hidden
                      />
                      <div>
                        <p className="text-sm font-semibold text-theme">
                          Anyone with the link can view
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted">
                          Viewers can pan and zoom, but they cannot edit your
                          original design. You can unpublish at any time.
                        </p>
                      </div>
                    </div>

                    {error && (
                      <div
                        role="alert"
                        className="rounded-xl bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-700 dark:text-red-300"
                      >
                        <p className="font-semibold">
                          Publishing did not complete
                        </p>
                        <p className="mt-1 text-xs">{error}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto pt-6">
                    <button
                      type="button"
                      onClick={() => void handlePublish()}
                      disabled={!mode || phase === "publishing"}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-bold text-[var(--bg)] shadow-[0_8px_24px_rgba(79,70,229,0.24)] transition-[transform,background-color,box-shadow] hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] disabled:cursor-not-allowed disabled:bg-[var(--muted)] disabled:text-[var(--bg)] disabled:opacity-100 disabled:hover:translate-y-0 disabled:hover:brightness-100"
                    >
                      {phase === "publishing" ? (
                        <>
                          <span
                            className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--bg)]/40 border-t-[var(--bg)]"
                            aria-hidden
                          />
                          <span>Publishing…</span>
                        </>
                      ) : (
                        <>
                          <MdPublic size={18} aria-hidden /> Publish design
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isBusy}
                      className="mt-2 w-full rounded-lg py-2 text-sm font-medium text-muted hover:bg-[var(--bg-hover)] hover:text-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                    >
                      Keep private
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div aria-live="polite">
                    <label
                      htmlFor="public-design-link"
                      className="text-xs font-semibold text-theme"
                    >
                      Public link
                    </label>
                    <div className="mt-2 flex min-w-0 items-center gap-2 rounded-xl bg-[var(--bg)] p-2">
                      <input
                        id="public-design-link"
                        readOnly
                        value={publicUrl ?? ""}
                        onFocus={(event) => event.currentTarget.select()}
                        className="min-w-0 flex-1 bg-transparent px-2 text-xs text-theme outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handleCopyLink()}
                        className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-bold text-[var(--bg)] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                      >
                        {linkCopied ? (
                          <MdCheck aria-hidden />
                        ) : (
                          <MdContentCopy aria-hidden />
                        )}
                        {linkCopied ? "Copied" : "Copy link"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <a
                      href={publicUrl ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--bg)] px-3 py-2.5 text-sm font-semibold text-theme hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                    >
                      <MdOpenInNew aria-hidden /> Open page
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleCopyLink()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--bg)] px-3 py-2.5 text-sm font-semibold text-theme hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                    >
                      <MdContentCopy aria-hidden /> Copy again
                    </button>
                  </div>

                  <div className="mt-6">
                    <p className="text-xs font-semibold text-theme">
                      Share your work
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => void handleLinkedIn()}
                        className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-[#0A66C2] px-2 py-3 text-xs font-semibold text-white hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A66C2] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
                      >
                        <FaLinkedin size={18} aria-hidden /> LinkedIn
                      </button>
                      <button
                        type="button"
                        onClick={handleTwitter}
                        className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-2 py-3 text-xs font-semibold text-white hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] dark:bg-white dark:text-black dark:hover:text-white"
                      >
                        <FaXTwitter size={17} aria-hidden /> X
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleMedium()}
                        className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-2 py-3 text-xs font-semibold text-white hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
                      >
                        <SiMedium size={18} aria-hidden /> Medium
                      </button>
                    </div>
                    {messageCopied && (
                      <p
                        className="mt-2 text-center text-xs font-medium text-emerald-700 dark:text-emerald-300"
                        aria-live="polite"
                      >
                        {messageCopied}. Paste it into the new window.
                      </p>
                    )}
                  </div>

                  {error && (
                    <p
                      role="alert"
                      className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-700 dark:text-red-300"
                    >
                      {error}
                    </p>
                  )}

                  <div className="mt-auto pt-6">
                    {confirmUnpublish ? (
                      <div className="rounded-xl bg-red-500/10 p-3">
                        <p className="text-xs leading-relaxed text-red-800 dark:text-red-200">
                          The public link will stop working. Your saved design
                          will not be deleted.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleUnpublish()}
                            disabled={phase === "unpublishing"}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50"
                          >
                            {phase === "unpublishing" ? (
                              <span
                                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                                aria-hidden
                              />
                            ) : (
                              <MdVisibilityOff aria-hidden />
                            )}
                            Unpublish
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmUnpublish(false)}
                            disabled={phase === "unpublishing"}
                            className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-theme hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmUnpublish(true)}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-muted hover:bg-red-500/10 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:text-red-300"
                      >
                        <MdVisibilityOff aria-hidden /> Manage visibility
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ShareToWorldModal;
