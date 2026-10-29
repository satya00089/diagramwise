import React, { useEffect, useRef, useState } from "react";
import { HiChevronDown } from "react-icons/hi2";

export interface SelectDropdownProps {
  readonly id: string;
  readonly value: string;
  readonly options: readonly SelectDropdownItem[];
  readonly onChange: (value: string) => void;
  readonly "aria-label": string;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly wrapperClassName?: string;
  readonly size?: SelectDropdownSize;
  readonly menuPlacement?: "top" | "bottom";
  readonly onFocus?: React.FocusEventHandler<HTMLButtonElement>;
  readonly onBlur?: React.FocusEventHandler<HTMLButtonElement>;
}

export type SelectDropdownSize = "small" | "default" | "large";

export interface SelectDropdownOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export type SelectDropdownItem = string | SelectDropdownOption;

interface NormalizedOption {
  value: string;
  label: string;
  disabled: boolean;
}

function normalizeOption(
  option: string | SelectDropdownOption,
): NormalizedOption {
  if (typeof option === "string")
    return { value: option, label: option, disabled: false };
  return {
    value: option.value,
    label: option.label,
    disabled: option.disabled ?? false,
  };
}

function normalizeOptions(items: readonly SelectDropdownItem[]) {
  return items.map(normalizeOption);
}

function findEnabledIndex(
  options: readonly NormalizedOption[],
  startIndex: number,
  direction: 1 | -1,
): number {
  for (let offset = 0; offset < options.length; offset += 1) {
    const index =
      (((startIndex + direction * offset) % options.length) + options.length) %
      options.length;
    if (!options[index].disabled) return index;
  }
  return -1;
}

function getArrowOpenIndex(
  key: string,
  selectedIndex: number,
  options: readonly NormalizedOption[],
): number {
  if (selectedIndex >= 0 && !options[selectedIndex].disabled)
    return selectedIndex;
  return key === "ArrowDown"
    ? findEnabledIndex(options, 0, 1)
    : findEnabledIndex(options, options.length - 1, -1);
}

function getNextHighlightedIndex(
  current: number,
  key: string,
  options: readonly NormalizedOption[],
): number {
  if (!options.length) return -1;
  const direction = key === "ArrowDown" ? 1 : -1;
  const origin = current < 0 ? (direction === 1 ? -1 : 0) : current;
  for (let offset = 1; offset <= options.length; offset += 1) {
    const index =
      (((origin + direction * offset) % options.length) + options.length) %
      options.length;
    if (!options[index].disabled) return index;
  }
  return current;
}

function SelectDropdown({
  id,
  value,
  options,
  onChange,
  "aria-label": ariaLabel,
  disabled = false,
  className = "",
  wrapperClassName = "",
  size = "default",
  menuPlacement = "bottom",
  onFocus,
  onBlur,
}: SelectDropdownProps) {
  const normalizedOptions = normalizeOptions(options);
  const selectedIndex = normalizedOptions.findIndex(
    (option) => option.value === value && !option.disabled,
  );
  const selectedOption = normalizedOptions.find(
    (option) => option.value === value,
  );
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(() =>
    selectedIndex >= 0
      ? selectedIndex
      : findEnabledIndex(normalizedOptions, 0, 1),
  );
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionsRef = useRef(normalizedOptions);
  const skipHighlightSyncRef = useRef(false);
  optionsRef.current = normalizedOptions;
  const optionsKey = JSON.stringify(normalizedOptions);

  useEffect(() => {
    if (!open) return;
    if (skipHighlightSyncRef.current) {
      skipHighlightSyncRef.current = false;
    } else {
      const currentOptions = optionsRef.current;
      const currentSelectedIndex = currentOptions.findIndex(
        (option) => option.value === value && !option.disabled,
      );
      setHighlightedIndex(
        currentSelectedIndex >= 0
          ? currentSelectedIndex
          : findEnabledIndex(currentOptions, 0, 1),
      );
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, optionsKey, value]);

  const choose = (index: number) => {
    const option = normalizedOptions[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      ref={wrapperRef}
      className={`dashboard-select-wrapper ${wrapperClassName}`}
    >
      <button
        id={id}
        ref={triggerRef}
        type="button"
        className={`dashboard-select-trigger dashboard-select-trigger--${size} ${disabled ? "opacity-60 cursor-not-allowed" : ""} ${className}`}
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        aria-activedescendant={
          open && highlightedIndex >= 0
            ? `${id}-option-${highlightedIndex}`
            : undefined
        }
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onFocus={onFocus}
        onBlur={(event) => {
          if (!wrapperRef.current?.contains(event.relatedTarget as Node | null))
            setOpen(false);
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (!normalizedOptions.length) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) {
              setOpen(true);
              setHighlightedIndex(
                getArrowOpenIndex(event.key, selectedIndex, normalizedOptions),
              );
            } else {
              setHighlightedIndex((current) =>
                getNextHighlightedIndex(current, event.key, normalizedOptions),
              );
            }
          } else if (event.key === "Home") {
            event.preventDefault();
            if (!open) skipHighlightSyncRef.current = true;
            setOpen(true);
            setHighlightedIndex(findEnabledIndex(normalizedOptions, 0, 1));
          } else if (event.key === "End") {
            event.preventDefault();
            if (!open) skipHighlightSyncRef.current = true;
            setOpen(true);
            setHighlightedIndex(
              findEnabledIndex(
                normalizedOptions,
                normalizedOptions.length - 1,
                -1,
              ),
            );
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (open) choose(highlightedIndex);
            else setOpen(true);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
      >
        <span>{selectedOption?.label ?? value}</span>
        <HiChevronDown
          aria-hidden="true"
          className={`dashboard-select-chevron ${open ? "dashboard-select-chevron--open" : ""}`}
        />
      </button>
      {open && (
        <div
          id={`${id}-menu`}
          className={`dashboard-select-menu dashboard-select-menu--${menuPlacement} dashboard-select-menu--${size}`}
          role="listbox"
          aria-label={ariaLabel}
        >
          {normalizedOptions.map((option, index) => (
            <div
              key={`${option.value}-${index}`}
              id={`${id}-option-${index}`}
              role="option"
              tabIndex={-1}
              aria-selected={option.value === value}
              aria-disabled={option.disabled || undefined}
              className={`dashboard-select-option ${
                index === highlightedIndex
                  ? "dashboard-select-option--highlighted"
                  : ""
              } ${option.value === value ? "dashboard-select-option--selected" : ""} ${
                option.disabled ? "dashboard-select-option--disabled" : ""
              }`}
              onMouseEnter={() => {
                if (!option.disabled) setHighlightedIndex(index);
              }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  choose(index);
                }
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SelectDropdown;
