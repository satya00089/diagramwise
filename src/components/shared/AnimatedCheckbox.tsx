import React from "react";

export type AnimatedCheckboxVariant = "brand" | "danger";

export interface AnimatedCheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  /** "brand" follows the theme color (default); "danger" is a soft red tint (matches destructive buttons). */
  variant?: AnimatedCheckboxVariant;
}

const VARIANT_STYLES: Record<
  AnimatedCheckboxVariant,
  { box: string; check: string }
> = {
  brand: {
    box: "checked:bg-[var(--brand)] checked:border-[var(--brand)] focus:ring-[var(--brand)]",
    check: "text-[var(--bg)]",
  },
  danger: {
    box: "checked:bg-red-600/10 checked:border-red-600/40 focus:ring-red-500",
    check: "text-red-600 dark:text-red-400",
  },
};

/*
  Re-usable checkbox.
  - Uses a native checkbox for accessibility (screen readers & keyboard)
  - Hides the default appearance; the box fills with the variant color when checked
  - Overlays an SVG check glyph when checked
*/
export const AnimatedCheckbox: React.FC<AnimatedCheckboxProps> = ({
  id,
  checked,
  onChange,
  label,
  disabled = false,
  className = "",
  labelClassName = "text-theme",
  variant = "brand",
}) => {
  const styles = VARIANT_STYLES[variant];
  return (
    <label
      htmlFor={id}
      className={`inline-flex items-start gap-2 text-sm cursor-pointer select-none ${disabled ? "opacity-60 cursor-not-allowed" : ""} ${className}`}
    >
      <span className="relative mt-0.5 inline-flex shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className={`peer w-4 h-4 cursor-pointer appearance-none rounded border border-theme bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors disabled:cursor-not-allowed ${styles.box}`}
        />
        {checked && (
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className={`pointer-events-none absolute w-3 h-3 ${styles.check}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 8.5l3.2 3.2L13 4.8" />
          </svg>
        )}
      </span>
      {label && <span className={`text-sm ${labelClassName}`}>{label}</span>}
    </label>
  );
};

export default AnimatedCheckbox;
