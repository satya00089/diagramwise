import React from "react";
import { motion } from "motion/react";
import { FieldWrapper } from "./AnimatedFieldBase";
import { useFocus } from "./useFocus";
import SelectDropdown, { type SelectDropdownSize } from "./SelectDropdown";

export interface AnimatedSelectProps {
  id: string;
  label?: string;
  value: string | undefined;
  onChange: (value: string) => void;
  options: string[];
  disabled?: boolean;
  className?: string;
  containerClassName?: string;
  size?: SelectDropdownSize;
}

const AnimatedSelect: React.FC<AnimatedSelectProps> = ({
  id,
  label,
  value,
  onChange,
  options,
  disabled,
  className = "",
  containerClassName,
  size,
}) => {
  const { focused, onFocus, onBlur } = useFocus();
  const labelId = `${id}-label`;
  return (
    <FieldWrapper
      id={id}
      label={label}
      focused={focused}
      containerClassName={containerClassName}
    >
      {!label && (
        <label id={labelId} htmlFor={id} className="sr-only">
          {id}
        </label>
      )}
      <motion.div
        initial={{ opacity: 0, y: -4, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="w-full"
      >
        <SelectDropdown
          id={id}
          value={value ?? ""}
          onChange={onChange}
          options={options}
          aria-label={label || id}
          onFocus={onFocus}
          onBlur={onBlur}
          disabled={disabled}
          className={className}
          size={size}
        />
      </motion.div>
    </FieldWrapper>
  );
};

export default AnimatedSelect;
