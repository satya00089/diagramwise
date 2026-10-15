import React, { useState } from "react";
import { motion } from "framer-motion";
import type { UserIntent } from "../types/chatBot";

interface ProjectIntentDialogProps {
  onSubmit: (intent: UserIntent) => void;
  onSkip: () => void;
  initialTitle?: string;
  initialDescription?: string;
  heading?: string;
  subheading?: string;
  submitLabel?: string;
  titleLabel?: string;
  titleRequired?: boolean;
}

export const ProjectIntentDialog: React.FC<ProjectIntentDialogProps> = ({
  onSubmit,
  onSkip,
  initialTitle = "",
  initialDescription = "",
  heading = "🎨 What are you designing today?",
  subheading = "Help us provide better suggestions by sharing what you're building",
  submitLabel = "Continue",
  titleLabel = "Project Title",
  titleRequired = false,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (titleRequired && !title.trim()) return;
    if (title.trim() || description.trim()) {
      const intent: UserIntent = {
        title: title.trim(),
        description: description.trim(),
        timestamp: new Date(),
      };
      onSubmit(intent);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[var(--surface)] rounded-lg shadow-xl border border-theme/10 w-full max-w-lg mx-4"
      >
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-theme/10">
            <h2 className="text-xl font-bold text-theme">{heading}</h2>
            <p className="text-sm text-muted mt-1">{subheading}</p>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-4">
            <div>
              <label
                htmlFor="project-title"
                className="block text-sm font-medium text-theme mb-2"
              >
                {titleLabel}{titleRequired ? " *" : ""}
              </label>
              <input
                id="project-title"
                type="text"
                required={titleRequired}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., E-commerce System, Blog Database, Microservices Architecture..."
                className="w-full px-3 py-2 border border-theme/20 rounded-md 
                  bg-theme text-theme
                  focus:ring-2 focus:ring-accent/50 focus:border-transparent
                  placeholder:text-muted"
                autoFocus
              />
            </div>

            <div>
              <label
                htmlFor="project-description"
                className="block text-sm font-medium text-theme mb-2"
              >
                Description <span className="text-muted">(Optional)</span>
              </label>
              <textarea
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe what you want to design and its key features..."
                rows={4}
                className="w-full px-3 py-2 border border-theme/20 rounded-md 
                  bg-theme text-theme
                  focus:ring-2 focus:ring-accent/50 focus:border-transparent
                  placeholder:text-muted
                  resize-none"
              />
            </div>

            <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
              <p className="text-xs text-theme">
                💡 <strong>Tip:</strong> This information will be used for
                auto-save and to provide you with smart, context-aware
                suggestions while you design.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-theme/10 flex justify-end gap-3">
            <button
              type="button"
              onClick={onSkip}
              className="px-4 py-2 text-sm font-medium text-muted
                hover:text-theme hover:bg-[var(--bg-hover)] rounded-md transition-colors"
            >
              Skip for now
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium bg-accent hover:brightness-90
                text-[var(--bg)] rounded-md transition-all"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
