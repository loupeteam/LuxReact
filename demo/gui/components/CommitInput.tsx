import { useEffect, useRef, useState } from 'react';

interface CommitInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur' | 'onKeyDown'> {
  /** The current committed value (from PLC / server). */
  value: string | number;
  /** Called with the new value when the user commits (blur or Enter). */
  onCommit: (value: string) => void;
}

/**
 * An input that lets the user type freely without triggering writes on every keystroke.
 * The `onCommit` callback fires only when the user blurs the field or presses Enter.
 * Incoming `value` changes (e.g. from the PLC) update the draft only while the field
 * is not focused, so they never clobber mid-edit text.
 */
export function CommitInput({ value, onCommit, ...rest }: CommitInputProps) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  return (
    <input
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => { focused.current = true; }}
      onBlur={(e) => { focused.current = false; onCommit(e.target.value); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}
