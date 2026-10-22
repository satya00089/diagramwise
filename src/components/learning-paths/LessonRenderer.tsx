import React, { useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { Lesson, Exercise } from "../../services/contentLoader";

function ExerciseRunner({
  exercise,
}: Readonly<{ exercise?: Exercise | null }>) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showHints, setShowHints] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<
    Record<string, { ok: boolean; message?: string }>
  >({});

  const parseNumber = (s?: string) => {
    if (!s) return Number.NaN;
    const cleaned = s.replaceAll(",", "").match(/-?\d+(?:\.\d+)?/);
    return cleaned ? Number.parseFloat(cleaned[0]) : Number.NaN;
  };

  const validateString = (q: Exercise["questions"][number], user: string) => {
    const ans = q.answer;
    if (!ans) return;
    if (ans.type === "string") {
      const val = (ans.value || "").toString();
      if (ans.regex) {
        try {
          const re = new RegExp(ans.regex, "i");
          const ok = re.test(user);
          setResults((r) => ({
            ...r,
            [q.id]: {
              ok,
              message: ok
                ? "Correct"
                : `Incorrect — expected pattern ${ans.regex}`,
            },
          }));
        } catch {
          setResults((r) => ({
            ...r,
            [q.id]: { ok: false, message: "Invalid validation regex." },
          }));
        }
        return;
      }
      const ok = user.toLowerCase() === val.toLowerCase();
      setResults((r) => ({
        ...r,
        [q.id]: {
          ok,
          message: ok ? "Correct" : `Incorrect — expected "${val}"`,
        },
      }));
      return;
    }
  };

  const validate = (q: Exercise["questions"][number]) => {
    const user = (answers[q.id] || "").trim();
    if (!q.answer) {
      setResults((r) => ({
        ...r,
        [q.id]: { ok: false, message: "No expected answer available." },
      }));
      return;
    }

    const ans = q.answer;

    if (ans.type === "numeric" || ans.type === "integer") {
      const userNum = parseNumber(user);
      if (Number.isNaN(userNum)) {
        setResults((r) => ({
          ...r,
          [q.id]: {
            ok: false,
            message: "Please enter a numeric value (e.g. 13.5).",
          },
        }));
        return;
      }
      const expected = Number(ans.value);
      const tol = ans.tolerance ?? (ans.type === "integer" ? 0 : 0.15);
      const diff = Math.abs(userNum - expected);
      const ok = diff <= tol * Math.max(Math.abs(expected), 1);
      const unitsLabel = ans.units ? ` ${ans.units}` : "";
      const message = ok
        ? `Correct (≈ ${expected}${unitsLabel})`
        : `Incorrect — expected ≈ ${expected}${unitsLabel} (±${Math.round(tol * 100)}%)`;
      setResults((r) => ({ ...r, [q.id]: { ok, message } }));
      return;
    }

    validateString(q, user);
  };

  if (!exercise || !exercise.questions || exercise.questions.length === 0) {
    return <div className="text-sm text-muted">No exercises available.</div>;
  }

  const ex = exercise as Exercise;

  return (
    <div className="space-y-4">
      {ex.assumptions && ex.assumptions.length > 0 && (
        <div className="rounded-xl border border-theme/10 bg-[var(--bg)] p-4 shadow-sm">
          <div className="font-medium">Assumptions</div>
          <ul className="list-disc list-inside mt-2 text-sm text-theme/90">
            {ex.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </div>
      )}

      {ex.questions.map((q, idx) => (
        <div
          key={q.id}
          className="rounded-xl border border-theme/10 bg-[var(--bg)] p-4 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium">Question {idx + 1}</div>
              <div className="text-sm text-theme/80 mt-1">{q.prompt}</div>
            </div>
            <div>
              {q.hint && (
                <button
                  onClick={() =>
                    setShowHints((s) => ({ ...s, [q.id]: !s[q.id] }))
                  }
                  className="inline-flex shrink-0 whitespace-nowrap rounded-full border border-[var(--brand)]/20 bg-[var(--brand)]/8 px-2 py-1 text-xs font-medium text-[var(--brand)]"
                >
                  {showHints[q.id] ? "Hide hint" : "Show hint"}
                </button>
              )}
            </div>
          </div>

          {showHints[q.id] && q.hint && (
            <div className="mt-3 text-sm text-muted">{q.hint}</div>
          )}

          <div className="mt-3 flex gap-3 items-center">
            <input
              aria-label={`answer-${q.id}`}
              value={answers[q.id] || ""}
              onChange={(e) =>
                setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
              }
              className="flex-1 rounded-lg border border-theme/15 bg-[var(--surface)] px-3 py-2 text-theme"
              placeholder="Type your answer (numbers accepted)"
            />
            <button
              onClick={() => validate(q)}
              className="exercise-submit-button px-3 py-2 rounded-md transition-all"
            >
              Submit
            </button>
          </div>

          {results[q.id] && (
            <div
              className={`mt-2 text-sm ${results[q.id].ok ? "text-emerald-600" : "text-rose-600"}`}
            >
              {results[q.id].message}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const LessonRenderer: React.FC<{
  lesson: Lesson;
  completed?: boolean;
  onToggleCompleted?: () => void;
  hasNextLesson?: boolean;
  onNext?: () => void;
  hasFinishModule?: boolean;
  onFinish?: () => void;
}> = ({
  lesson,
  completed = false,
  onToggleCompleted,
  hasNextLesson = false,
  onNext,
  hasFinishModule = false,
  onFinish,
}) => {
  // Ref for scroll-to-top on lesson change
  const contentRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [lesson.id]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-start justify-between mb-4 shrink-0">
        <div>
          <h2 className="text-2xl font-semibold text-theme">{lesson.title}</h2>
          <div className="text-sm text-muted">Type: {lesson.type}</div>
        </div>
        <div className="ml-4">
          <button
            onClick={onToggleCompleted}
            className={`px-3 py-1 rounded-full text-sm font-medium border shadow-sm ${completed ? "bg-emerald-600 text-white border-emerald-600" : "bg-[var(--bg)] text-theme border-theme/15"}`}
          >
            {completed ? "Completed" : "Mark complete"}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto component-palette" ref={contentRef}>
        {lesson.type === "article" && (
          <div className="prose max-w-none prose-headings:text-theme prose-p:text-theme prose-strong:text-theme prose-li:text-theme prose-code:text-theme dark:prose-invert">
            <div
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(marked.parse(lesson.content || "")),
              }}
            />
          </div>
        )}

        {lesson.type === "exercise" && (
          <div>
            <div className="prose max-w-none prose-headings:text-theme prose-p:text-theme prose-strong:text-theme prose-li:text-theme prose-code:text-theme dark:prose-invert mb-6">
              <div
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    marked.parse(lesson.content || ""),
                  ),
                }}
              />
            </div>
            <ExerciseRunner exercise={lesson.exercise} />
          </div>
        )}

        {lesson.type !== "article" && lesson.type !== "exercise" && (
          <div>
            <div className="text-gray-600 mb-3">Lesson type: {lesson.type}</div>
            <div className="mt-4">{lesson.content}</div>
          </div>
        )}
      </div>

      {(hasNextLesson || hasFinishModule) && (
        <div className="mt-4 shrink-0 flex justify-end gap-3 pt-4 border-t border-theme/8 bg-[var(--bg)]">
          {hasFinishModule && (
            <button
              onClick={onFinish}
              className="px-4 py-2 bg-surface text-theme rounded-md border border-theme/10 hover:shadow-sm transition"
            >
              Finish Module
            </button>
          )}

          {hasNextLesson && (
            <button
              onClick={onNext}
              className="lesson-next-button px-4 py-2 rounded-md transition-all"
            >
              Next Lesson
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default LessonRenderer;
