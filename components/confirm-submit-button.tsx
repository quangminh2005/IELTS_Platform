"use client";

import type { ReactNode } from "react";

type ConfirmSubmitButtonProps = {
  formAction?: (formData: FormData) => void | Promise<void>;
  confirmMessage: string;
  className?: string;
  children: ReactNode;
};

export function ConfirmSubmitButton({
  formAction,
  confirmMessage,
  className,
  children
}: ConfirmSubmitButtonProps) {
  return (
    <button
      type="submit"
      formAction={formAction}
      className={className}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
