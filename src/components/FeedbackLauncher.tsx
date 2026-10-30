import React from "react";
import { MdFeedback } from "react-icons/md";
import { useFeedback } from "../contexts/FeedbackContext";
import "../styles/feedback-overrides.css";

type FeedbackLauncherProps = {
  /**
   * "floating" is the labelled pill fixed to the corner of the page.
   * "docked" is the icon-only button that sits in the canvas toolbar; CSS shows
   * one or the other depending on whether the left nav is open.
   */
  variant?: "floating" | "docked";
};

const FeedbackLauncher: React.FC<FeedbackLauncherProps> = ({
  variant = "floating",
}) => {
  const { openFeedback } = useFeedback();
  const docked = variant === "docked";

  return (
    <button
      type="button"
      onClick={() => openFeedback()}
      className={`feedback-launcher feedback-launcher--${variant}`}
      aria-label="Give feedback"
      data-tooltip={docked ? "Give feedback" : undefined}
      data-tooltip-placement={docked ? "right" : undefined}
      data-analytics="feedback:feedback_launcher_clicked"
    >
      <MdFeedback className="h-4 w-4" aria-hidden="true" />
      {!docked && <span className="hidden sm:inline">Feedback</span>}
    </button>
  );
};

export default FeedbackLauncher;
