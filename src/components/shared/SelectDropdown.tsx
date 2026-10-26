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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const optionsKey = options.join("\u0000");

  useEffect(() => {
    if (!open) return;
    setHighlightedIndex((current) => {
      const currentOptions = optionsRef.current;
      const selectedIndex = currentOptions.indexOf(value);
      return selectedIndex >= 0 ? selectedIndex : Math.min(current, currentOptions.length - 1);
    });
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, optionsKey, value]);

  const choose = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className="dashboard-select-wrapper">
      <button
        id={id}
        ref={triggerRef}
        type="button"
        className={`dashboard-select-trigger ${disabled ? "opacity-60 cursor-not-allowed" : ""} ${className}`}
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        aria-activedescendant={open ? `${id}-option-${highlightedIndex}` : undefined}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onFocus={onFocus}
        onBlur={(event) => {
          if (!wrapperRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (!options.length) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) {
              setOpen(true);
              const selected = options.indexOf(value);
              setHighlightedIndex(selected >= 0 ? selected : event.key === "ArrowDown" ? 0 : options.length - 1);
            } else {
              setHighlightedIndex((current) => (current + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
            }
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
            event.preventDefault();
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
              id={`${id}-option-${index}`}
              role="option"
              tabIndex={-1}
              aria-selected={option === value}
              className={`dashboard-select-option ${
                index === highlightedIndex
                  ? "dashboard-select-option--highlighted"
                  : ""
              } ${option === value ? "dashboard-select-option--selected" : ""}`}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
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
