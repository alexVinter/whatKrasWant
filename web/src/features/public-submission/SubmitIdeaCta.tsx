import type { ButtonHTMLAttributes } from 'react';
import { useStartSubmissionFlow } from './useStartSubmissionFlow';

interface SubmitIdeaCtaProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  onNavigate?: () => void;
}

export function SubmitIdeaCta({
  className,
  onNavigate,
  disabled,
  ...rest
}: SubmitIdeaCtaProps) {
  const { startSubmission, submissionEnabled, pending } = useStartSubmissionFlow();

  if (!submissionEnabled) {
    return (
      <button
        type="button"
        className={className}
        disabled
        aria-disabled="true"
        {...rest}
      >
        Предложить идею
      </button>
    );
  }

  return (
    <button
      type="button"
      className={className}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      onClick={() => {
        onNavigate?.();
        void startSubmission();
      }}
      {...rest}
    >
      Предложить идею
    </button>
  );
}
