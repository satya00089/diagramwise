import { useModalDialog } from "../hooks/useModalDialog";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { MdClose, MdSend, MdStar, MdStarBorder } from "react-icons/md";
import { useAuth } from "../hooks/useAuth";
import TiptapAnswerEditor from "./TiptapAnswerEditor";
import SelectDropdown from "./shared/SelectDropdown";
import "../styles/feedback-overrides.css";
import type {
  FeedbackCategory,
  FeedbackLaunchOptions,
  FeedbackReason,
  FeedbackSubmission,
} from "../types/feedback";

interface FeedbackDialogProps {
  initialOptions: FeedbackLaunchOptions;
  onClose: () => void;
  onSubmit: (submission: FeedbackSubmission) => Promise<void>;
}

const CATEGORY_OPTIONS: Array<{ value: FeedbackCategory; label: string }> = [
  { value: "bug", label: "Report a bug" },
  { value: "feature_request", label: "Suggest an improvement" },
  { value: "usability", label: "Something was confusing" },
  { value: "content", label: "Content or problem issue" },
  { value: "other", label: "Something else" },
];

const REASON_OPTIONS: Array<{ value: FeedbackReason; label: string }> = [
  { value: "inaccurate", label: "It felt inaccurate" },
  { value: "too_generic", label: "It was too generic" },
  { value: "not_actionable", label: "It was not actionable" },
  { value: "missing_context", label: "It missed important context" },
  { value: "hard_to_understand", label: "It was hard to understand" },
];

interface FeedbackCategorySelectProps {
  value: FeedbackCategory;
  onChange: (value: FeedbackCategory) => void;
}

const FeedbackCategorySelect: React.FC<FeedbackCategorySelectProps> = ({
  value,
  onChange,
}) => {
  const selectedValue = CATEGORY_OPTIONS.some(
    (option) => option.value === value,
  )
    ? value
    : CATEGORY_OPTIONS[0].value;
  return (
    <SelectDropdown
      id="feedback-category"
      value={selectedValue}
      options={CATEGORY_OPTIONS}
      aria-label="Feedback category"
      wrapperClassName="feedback-category-select"
      onChange={(nextValue) => {
        const option = CATEGORY_OPTIONS.find(
          (category) => category.value === nextValue,
        );
        if (option) onChange(option.value);
      }}
    />
  );
};

const FeedbackDialog: React.FC<FeedbackDialogProps> = ({
  initialOptions,
  onClose,
  onSubmit,
}) => {
  const { user } = useAuth();
  const dialogRef = useModalDialog();
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [category, setCategory] = useState<FeedbackCategory>(
    initialOptions.category ??
      (initialOptions.source === "assessment"
        ? "assessment"
        : "feature_request"),
  );
  const [rating, setRating] = useState<number | undefined>();
  const [hoveredRating, setHoveredRating] = useState<number | undefined>();
  const [message, setMessage] = useState("");
  const [messageText, setMessageText] = useState("");
  const [reasons, setReasons] = useState<FeedbackReason[]>([]);
  const [contactEmail, setContactEmail] = useState(user?.email ?? "");
  const contactEmailWasEditedRef = useRef(false);
  const [requestContact, setRequestContact] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const source = initialOptions.source ?? "global";
  const isAssessment = source === "assessment";
  const title = isAssessment
    ? "Help us improve this review"
    : "Help us improve Diagramwise";
  const description = isAssessment
    ? "Tell us what would make the architecture review more useful."
    : "Your feedback helps us make the design and learning experience better.";

  useEffect(() => {
    if (user?.email && !contactEmailWasEditedRef.current) {
      setContactEmail(user.email);
    }
  }, [user?.email]);

  const canSubmit = useMemo(
    () =>
      isAssessment || messageText.trim().length >= 5 || rating !== undefined,
    [isAssessment, messageText, rating],
  );

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>(
          'button, select, textarea, input, [contenteditable="true"]',
        )
        ?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      previousFocusRef.current?.focus();
    };
  }, [dialogRef]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [contenteditable="true"]:not([aria-disabled="true"])',
        ),
      );
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
  }, [dialogRef, isSubmitting, onClose]);

  const toggleReason = (reason: FeedbackReason) => {
    setReasons((current) =>
      current.includes(reason)
        ? current.filter((item) => item !== reason)
        : [...current, reason],
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        source,
        category,
        rating,
        helpful: initialOptions.helpful,
        reasons,
        message: messageText.trim() ? message : "",
        contactEmail: requestContact ? contactEmail.trim() : undefined,
        context: initialOptions.context ?? {},
      });
      setSubmitted(true);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Feedback could not be sent. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="feedback-dialog-title"
      aria-describedby="feedback-dialog-description"
      onCancel={(event) => event.preventDefault()}
      className="feedback-dialog"
    >
      <div tabIndex={-1} className="feedback-dialog__surface">
        <header className="feedback-dialog__header">
          <div>
            <h2 id="feedback-dialog-title" className="feedback-dialog__title">
              {submitted ? "Thank you" : title}
            </h2>
            <p
              id="feedback-dialog-description"
              className="feedback-dialog__description"
            >
              {submitted ? "Your feedback was received." : description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="feedback-dialog__close"
            aria-label="Close feedback dialog"
          >
            <MdClose className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        {submitted ? (
          <div className="feedback-dialog__submitted">
            <p className="feedback-dialog__description">
              We’ll use this to improve the experience over time. No further
              action is needed.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="feedback-dialog__primary-action"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="feedback-dialog__form">
            {!isAssessment && (
              <div className="feedback-dialog__field">
                <span>What would you like to tell us?</span>
                <FeedbackCategorySelect
                  value={category}
                  onChange={setCategory}
                />
              </div>
            )}

            <fieldset>
              <legend className="feedback-dialog__legend">
                How was your experience?
              </legend>
              <div
                className="feedback-dialog__rating"
                role="radiogroup"
                aria-label="Star rating"
              >
                {[1, 2, 3, 4, 5].map((value) => {
                  const displayRating = hoveredRating ?? rating;
                  const isFilled =
                    displayRating !== undefined && value <= displayRating;

                  return (
                    <label
                      key={value}
                      htmlFor={`feedback-rating-${value}`}
                      data-tooltip={`${value} star${value === 1 ? "" : "s"}`}
                      onMouseEnter={() => setHoveredRating(value)}
                      onMouseLeave={() => setHoveredRating(undefined)}
                      className="feedback-dialog__rating-choice"
                    >
                      <input
                        id={`feedback-rating-${value}`}
                        type="radio"
                        name="feedback-rating"
                        value={value}
                        checked={rating === value}
                        onChange={() => setRating(value)}
                        className="sr-only"
                        aria-label={`${value} star${value === 1 ? "" : "s"}`}
                      />
                      {isFilled ? (
                        <MdStar
                          className="pointer-events-none h-7 w-7"
                          aria-hidden="true"
                        />
                      ) : (
                        <MdStarBorder
                          className="pointer-events-none h-7 w-7 text-muted"
                          aria-hidden="true"
                        />
                      )}
                    </label>
                  );
                })}
              </div>
              <p className="feedback-dialog__hint">
                {rating ? "Rating selected" : "Select a rating"}
              </p>
            </fieldset>

            {isAssessment && (
              <fieldset>
                <legend className="feedback-dialog__legend">
                  What could be better?
                </legend>
                <div className="feedback-dialog__reasons">
                  {REASON_OPTIONS.map((option) => {
                    const selected = reasons.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggleReason(option.value)}
                        aria-pressed={selected}
                        className={`feedback-dialog__reason ${selected ? "feedback-dialog__reason--selected" : ""}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <div className="feedback-dialog__message-field">
              <span className="feedback-dialog__field-label">
                {isAssessment ? "Anything else?" : "Tell us more"}
              </span>
              <div className="feedback-dialog__editor">
                <TiptapAnswerEditor
                  id="feedback-description"
                  value={message}
                  contentFormat="html"
                  ariaLabel="Feedback description"
                  maxLength={4000}
                  disabled={isSubmitting}
                  placeholder={
                    isAssessment
                      ? "What should the review explain, catch, or prioritize differently?"
                      : "What happened, or what would make this better?"
                  }
                  onChange={setMessageText}
                  onHtmlChange={(html) => setMessage(html)}
                />
              </div>
              <span className="feedback-dialog__character-count">
                {messageText.length}/4000
              </span>
            </div>

            <div className="feedback-dialog__contact-box">
              <div className="feedback-dialog__contact-label">
                <input
                  id="feedback-contact"
                  type="checkbox"
                  checked={requestContact}
                  onChange={(event) => setRequestContact(event.target.checked)}
                  aria-describedby="feedback-contact-note"
                  className="mt-0.5 h-4 w-4 rounded border-[var(--border)] accent-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]"
                />
                <span>
                  <label
                    htmlFor="feedback-contact"
                    className="feedback-dialog__contact-title"
                  >
                    You may contact me about this feedback
                  </label>
                  <span
                    id="feedback-contact-note"
                    className="feedback-dialog__contact-note"
                  >
                    Optional. We only use your email for this follow-up.
                  </span>
                </span>
              </div>
              {requestContact && (
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(event) => {
                    contactEmailWasEditedRef.current = true;
                    setContactEmail(event.target.value);
                  }}
                  placeholder="you@example.com"
                  required
                  className="feedback-dialog__contact-input"
                  aria-label="Email address for feedback follow-up"
                />
              )}
            </div>

            {error && (
              <p role="alert" className="feedback-dialog__error">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="feedback-dialog__primary-action"
            >
              <MdSend className="h-4 w-4" aria-hidden="true" />
              {isSubmitting ? "Sending…" : "Send feedback"}
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
};

export default FeedbackDialog;
