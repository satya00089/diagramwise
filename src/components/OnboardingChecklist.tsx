import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MdClose,
  MdCheckCircle,
  MdRadioButtonUnchecked,
  MdChevronRight,
} from "react-icons/md";
import { HiSparkles } from "react-icons/hi2";
import { useOnboarding } from "../hooks/useOnboarding";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";

// ---------------------------------------------------------------------------
// Task definitions
// ---------------------------------------------------------------------------

interface ChecklistTask {
  id: string;
  label: string;
  description: string;
  action?: () => void;
}

const OnboardingChecklist: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const { isTaskCompleted, completeTask } = useOnboarding();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const tasks: ChecklistTask[] = [
    {
      id: "take_dashboard_tour",
      label: "Take the Dashboard tour",
      description: "Learn how to find and filter practice problems",
      action: () => navigate("/problems?tour=1"),
    },
    {
      id: "add_first_component",
      label: "Add a component to the canvas",
      description: "Drag any component onto the Design Studio canvas",
      action: () => navigate("/playground/free"),
    },
    {
      id: "solve_problem",
      label: "Solve a practice problem",
      description: "Open any problem card and start designing",
      action: () => navigate("/problems"),
    },
    {
      id: "run_assessment",
      label: "Run an AI assessment",
      description: "Get instant feedback on your architecture",
    },
    {
      id: "save_design",
      label: "Save and name a design",
      description: "Save your work to access it later from My Designs",
    },
    {
      id: "explore_aiml",
      label: "Explore AI & ML problems",
      description: "Try MLOps, LLM infrastructure, or AIOps scenarios",
      action: () => navigate("/problems"),
    },
  ];

  const completedCount = tasks.filter((t) => isTaskCompleted(t.id)).length;
  const totalCount = tasks.length;
  const allDone = completedCount === totalCount;
  const progressDeg = (completedCount / totalCount) * 360;

  if (isDismissed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="w-80 rounded-2xl border border-theme bg-[var(--surface)] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-theme">
              <div className="flex items-center gap-2">
                <HiSparkles className="text-[var(--brand)] h-4 w-4" />
                <span className="text-sm font-bold text-theme">
                  Getting Started
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">
                  {completedCount}/{totalCount}
                </span>
                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={() =>
                      window.dispatchEvent(new Event("open-quick-setup"))
                    }
                    className="text-xs text-theme hover:underline mr-2"
                  >
                    Edit preferences
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDismissed(true)}
                  className="text-muted hover:text-theme transition-colors cursor-pointer"
                  aria-label="Dismiss checklist"
                >
                  <MdClose className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-[var(--border)]">
              <motion.div
                className="h-full bg-[var(--brand)] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(completedCount / totalCount) * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>

            {/* Tasks */}
            <ul className="divide-y divide-theme/40">
              {tasks.map((task) => {
                const done = isTaskCompleted(task.id);
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!done) completeTask(task.id);
                        task.action?.();
                      }}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[var(--surface-hover,var(--bg))] transition-colors cursor-pointer group"
                    >
                      <span className="mt-0.5 shrink-0">
                        {done ? (
                          <MdCheckCircle className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <MdRadioButtonUnchecked className="h-5 w-5 text-muted group-hover:text-[var(--brand)] transition-colors" />
                        )}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span
                          className={`block text-sm font-medium ${done ? "line-through text-muted" : "text-theme"}`}
                        >
                          {task.label}
                        </span>
                        <span className="block text-xs text-muted mt-0.5 leading-relaxed">
                          {task.description}
                        </span>
                      </span>
                      {!done && task.action && (
                        <MdChevronRight className="h-4 w-4 text-muted group-hover:text-[var(--brand)] mt-0.5 shrink-0 transition-colors" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Footer */}
            {allDone && (
              <div className="px-4 py-3 text-center text-xs text-emerald-500 font-semibold border-t border-theme">
                🎉 You're all set! Great work.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-theme bg-[var(--surface)] shadow-lg hover:bg-[var(--bg)] transition-colors cursor-pointer"
        aria-label="Toggle getting started checklist"
      >
        {/* Circular progress indicator */}
        <div className="relative h-7 w-7 shrink-0">
          <svg
            className="h-7 w-7 -rotate-90"
            viewBox="0 0 28 28"
            aria-hidden="true"
          >
            <circle
              cx="14"
              cy="14"
              r="11"
              fill="none"
              stroke="var(--border, rgba(255,255,255,0.1))"
              strokeWidth="2.5"
            />
            <circle
              cx="14"
              cy="14"
              r="11"
              fill="none"
              stroke="var(--brand, #6366f1)"
              strokeWidth="2.5"
              strokeDasharray={`${(progressDeg / 360) * 69.1} 69.1`}
              strokeLinecap="round"
              style={{ transition: "stroke-dasharray 0.4s ease" }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-theme">
            {completedCount}/{totalCount}
          </span>
        </div>
        <span className="text-sm font-semibold text-theme whitespace-nowrap">
          {allDone ? "All done!" : "Getting Started"}
        </span>
        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <MdChevronRight className="h-4 w-4 text-muted -rotate-90" />
        </motion.span>
      </button>
    </div>
  );
};

export default OnboardingChecklist;
