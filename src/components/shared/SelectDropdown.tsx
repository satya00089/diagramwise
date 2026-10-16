import React, { useEffect, useRef, useState } from "react";
import { HiChevronDown } from "react-icons/hi2";

export interface SelectDropdownProps {
  id: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  "aria-label": string;
  disabled?: boolean;
  className?: string;
  menuPlacement?: "top" | "bottom";
  onFocus?: React.FocusEventHandler<HTMLButtonElement>;
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
}

const SelectDropdown: React.FC<SelectDropdownProps> = ({
  id,
  value,
  options,
  onChange,
  "aria-label": ariaLabel,
  disabled = false,
  className = "",
  menuPlacement = "bottom",
  onFocus,
  onBlur,
}) => {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(() =>
    Math.max(0, options.indexOf(value)),
  );
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setHighlightedIndex(Math.max(0, options.indexOf(value)));
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, options, value]);

  const choose = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="dashboard-select-wrapper">
      <button
        id={id}
        type="button"
        className={`dashboard-select-trigger ${disabled ? "opacity-60 cursor-not-allowed" : ""} ${className}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(event) => {
          if (!options.length) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setHighlightedIndex((current) =>
              event.key === "ArrowDown"
                ? Math.min(options.length - 1, current + 1)
                : Math.max(0, current - 1),
            );
          } else if (event.key === "Home") {
            event.preventDefault();
            setOpen(true);
            setHighlightedIndex(0);
          } else if (event.key === "End") {
            event.preventDefault();
            setOpen(true);
            setHighlightedIndex(options.length - 1);
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (open) choose(options[highlightedIndex]);
            else setOpen(true);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        <span>{value}</span>
        <HiChevronDown
          aria-hidden="true"
          className={`dashboard-select-chevron ${open ? "dashboard-select-chevron--open" : ""}`}
        />
      </button>
      {open && (
        <div
          id={`${id}-menu`}
          className={`dashboard-select-menu dashboard-select-menu--${menuPlacement}`}
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option, index) => (
            <div
              key={option}
              role="option"
              tabIndex={0}
              aria-selected={option === value}
              className={`dashboard-select-option ${
                index === highlightedIndex
                  ? "dashboard-select-option--highlighted"
                  : ""
              } ${option === value ? "dashboard-select-option--selected" : ""}`}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => choose(option)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  choose(option);
                }
              }}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SelectDropdown;
