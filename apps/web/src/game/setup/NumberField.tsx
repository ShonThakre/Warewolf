import { TextField } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

/** The message shown for an entry that cannot be committed, or null when it is valid. */
export function numberFieldError(text: string, min?: number, max?: number): string | null {
  if (text.trim() === '') return 'Enter a number.';
  const value = Number(text);
  if (!Number.isInteger(value)) return 'Enter a whole number.';
  const low = min ?? 0;
  if (value < low || (max !== undefined && value > max)) {
    return max === undefined ? `Enter a number of at least ${low}.` : `Enter a number from ${low} to ${max}.`;
  }
  return null;
}

/**
 * A whole-number field that lets the user type freely. Nothing reaches the
 * draft until the user leaves the field or presses Enter (Done on a phone);
 * then the entry is checked and an invalid one shows an error instead.
 */
export function NumberField({
  label,
  value,
  onCommit,
  min,
  max,
  disabled = false,
  helperText,
  className = 'ww-setup-number',
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number | undefined;
  max?: number | undefined;
  disabled?: boolean;
  helperText?: string | undefined;
  className?: string;
}) {
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const [commits, setCommits] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Show the draft's value again when it changes from outside (a preset, a mode),
  // and after each commit, in case the setter adjusted or refused the number.
  // An invalid entry changes neither, so it stays on screen with its error.
  useEffect(() => {
    setText(String(value));
    setError(null);
  }, [value, commits]);

  function commit() {
    const problem = numberFieldError(text, min, max);
    setError(problem);
    if (problem) return;
    const next = Number(text);
    if (next !== value) onCommit(next);
    setCommits((count) => count + 1);
  }

  return (
    <TextField
      className={className}
      label={label}
      type="text"
      value={text}
      disabled={disabled}
      error={error != null}
      helperText={error ?? helperText}
      inputRef={inputRef}
      onChange={(event) => {
        setText(event.target.value.replace(/\D/g, ''));
        setError(null);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        // Blurring commits, and on a phone it also closes the keypad.
        if (inputRef.current && document.activeElement === inputRef.current) inputRef.current.blur();
        else commit();
      }}
      slotProps={{
        htmlInput: {
          inputMode: 'numeric',
          pattern: '[0-9]*',
          enterKeyHint: 'done',
          autoComplete: 'off',
          'aria-label': label,
        },
      }}
    />
  );
}
