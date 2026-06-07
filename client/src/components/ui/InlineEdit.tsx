import { useState, useRef, useEffect } from "react";

interface Props {
  value: string | number;
  onSave: (val: string) => void;
  type?: "text" | "number";
  format?: (val: string | number) => string;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function InlineEdit({ value, onSave, type = "text", format, className = "", inputClassName = "", placeholder, disabled }: Props) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!editing) setVal(String(value)); }, [value, editing]);

  function commit() {
    setEditing(false);
    if (val !== String(value)) onSave(val);
  }

  function cancel() {
    setEditing(false);
    setVal(String(value));
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        type={type}
        value={val}
        placeholder={placeholder}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); cancel(); }
        }}
        className={`border border-blue-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-blue-400 outline-none transition ${inputClassName}`}
      />
    );
  }

  const display = format ? format(value) : String(value);

  return (
    <span
      onClick={() => { if (!disabled) setEditing(true); }}
      title={disabled ? undefined : "Click to edit"}
      className={`cursor-pointer hover:bg-slate-100 px-1.5 py-0.5 rounded transition-colors ${disabled ? "cursor-default" : ""} ${className}`}
    >
      {display || <span className="text-slate-400 italic text-xs">{placeholder ?? "—"}</span>}
    </span>
  );
}
