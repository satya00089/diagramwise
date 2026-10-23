import React from "react";
import type {
  Module as ModuleType,
  Lesson,
} from "../../services/contentLoader";

type Props = {
  modules: ModuleType[];
  onSelectLesson: (l: Lesson) => void;
  activeLessonId?: string | null;
  completedLessons?: string[];
  onToggleCompleted?: (lessonId: string) => void;
};

const ModuleList: React.FC<Props> = ({
  modules,
  onSelectLesson,
  activeLessonId,
  completedLessons = [],
  onToggleCompleted,
}) => {
  return (
    <div>
      {modules.map((m) => {
        const moduleActive = m.lessons.some((ls) => ls.id === activeLessonId);
        return (
          <div
            key={m.id}
            className={`mb-4 ${moduleActive ? "rounded-xl bg-[var(--brand)]/4 p-3 ring-1 ring-[var(--brand)]/15" : ""}`}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-theme">
                <button
                  type="button"
                  onClick={() => m.lessons?.[0] && onSelectLesson(m.lessons[0])}
                  className="text-left w-full"
                >
                  {m.title}
                </button>
              </h4>
            </div>

            <ul className="mt-2 space-y-2">
              {m.lessons.map((lesson) => {
                const isActive = activeLessonId === lesson.id;
                const isDone = completedLessons.includes(lesson.id);
                const excerpt = (lesson.content || "")
                  .split("\n")[0]
                  ?.slice(0, 120);

                return (
                  <li key={lesson.id}>
                    <div
                      className={`flex items-center justify-between rounded-xl border p-3 transition-colors ${
                        isActive
                          ? "border-[var(--brand)]/20 bg-[var(--brand)]/8 shadow-sm"
                          : "border-theme/10 bg-[var(--bg)] hover:border-theme/20 hover:bg-[var(--bg-hover)]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectLesson(lesson)}
                        className="flex-1 text-left"
                      >
                        <div
                          className={`text-sm font-semibold ${
                            isActive ? "text-[var(--brand)]" : "text-theme"
                          }`}
                        >
                          {lesson.title}
                        </div>
                        {excerpt ? (
                          <div className="mt-1 text-xs text-muted">
                            {excerpt}
                            {excerpt.length === 120 ? "…" : ""}
                          </div>
                        ) : null}
                      </button>

                      <div className="ml-3 flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={
                            isDone ? "Mark as incomplete" : "Mark as complete"
                          }
                          onClick={() => onToggleCompleted?.(lesson.id)}
                          className={`flex h-8 w-8 items-center justify-center rounded-full border shadow-sm transition-colors ${
                            isDone
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-theme/15 bg-[var(--surface)] text-theme/70 hover:bg-[var(--bg-hover)]"
                          }`}
                        >
                          {isDone ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 00-1.414-1.414L7 12.172 4.707 9.879a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l9-9z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 12h14"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

export default ModuleList;
