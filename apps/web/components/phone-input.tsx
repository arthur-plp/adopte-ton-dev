"use client";

import PhoneInputBase from "react-phone-number-input";
import fr from "react-phone-number-input/locale/fr.json";
import "react-phone-number-input/style.css";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function PhoneInput({ value, onChange, placeholder, disabled }: Props) {
  return (
    <PhoneInputBase
      international
      defaultCountry="FR"
      labels={fr}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}
