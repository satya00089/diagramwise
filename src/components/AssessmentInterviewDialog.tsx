import { useModalDialog } from "../hooks/useModalDialog";
import React from "react";
import {
  MdArrowForward,
  MdClose,
  MdRecordVoiceOver,
  MdSkipNext,
} from "react-icons/md";
import TiptapAnswerEditor from "./TiptapAnswerEditor";

type AssessmentInterviewDialogProps = {
  questions: string[];
  currentIndex: number;
  answer: string;
  onAnswerChange: (answer: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
  onCancel: () => void;
};

const AssessmentInterviewDialog: React.FC<AssessmentInterviewDialogProps> = ({
  questions,
  currentIndex,
  answer,
  onAnswerChange,
  onSubmit,
  onSkip,
  onCancel,
}) => {
  const question = questions[currentIndex];
  const isLastQuestion = currentIndex >= questions.length - 1;

  const dialogRef = useModalDialog(Boolean(question));

  if (!question) return null;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-0 h-full max-h-none w-full max-w-none border-0 text-theme fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      aria-modal="true"
      aria-labelledby="assessment-interview-title"
    >
      <div className="flex max-h-[min(760px,calc(100vh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-theme/15 bg-surface shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-theme/10 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand)]">
              <MdRecordVoiceOver className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="assessment-interview-title"
                  className="text-lg font-semibold text-theme"
                >
                  Interview before assessment
                </h2>
                <span className="rounded-full bg-[var(--brand)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
                  Optional answers
                </span>
              </div>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">
                Answer what you know about this design. If you are unsure, skip
                the question and continue—the assessment will still run.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel assessment interview"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-[var(--bg-hover)] hover:text-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/60"
          >
            <MdClose className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-3 text-xs text-muted">
            <span>
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span>
              {Math.round(((currentIndex + 1) / questions.length) * 100)}%
            </span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-theme/10"
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-200"
              style={{
                width: `${((currentIndex + 1) / questions.length) * 100}%`,
              }}
            />
          </div>

          <section className="mt-5 rounded-xl border border-[var(--brand)]/25 bg-[var(--brand)]/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--brand)]">
              Interview question
            </p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-theme">
              {question}
            </p>
          </section>

          <form
            className="mt-5"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            <label
              htmlFor="assessment-interview-answer"
              className="mb-2 block text-xs font-semibold text-theme"
            >
              Your answer
            </label>
            <TiptapAnswerEditor
              id="assessment-interview-answer"
              value={answer}
              onChange={onAnswerChange}
              placeholder="Explain the decision, the failure mode you considered, and the trade-off you accepted."
            />
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Use the editor toolbar to structure your reasoning, or record your
              answer by voice.
            </p>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={onSkip}
                className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-muted transition-colors hover:bg-[var(--bg-hover)] hover:text-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/60"
              >
                <MdSkipNext className="h-4 w-4" aria-hidden />
                {isLastQuestion ? "Skip and assess" : "Skip question"}
              </button>
              <button
                type="submit"
                disabled={!answer.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2.5 text-xs font-semibold text-[var(--bg)] transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/60 disabled:cursor-not-allowed disabled:bg-[var(--muted)] disabled:text-[var(--bg)] disabled:opacity-100 disabled:hover:brightness-100"
              >
                {isLastQuestion
                  ? "Continue to assessment"
                  : "Save answer and continue"}
                <MdArrowForward className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  );
};

export default AssessmentInterviewDialog;
