/** Labeled input/textarea with an optional schema character-limit counter. */
export function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  textarea,
  rows,
  type = "text",
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  textarea?: boolean;
  rows?: number;
  type?: "text" | "number";
  mono?: boolean;
}) {
  const over = maxLength !== undefined && value.length > maxLength;
  return (
    <label className="field">
      <span className="field-label">
        <span>{label}</span>
        {maxLength !== undefined && (
          <span className={`counter${over ? " over" : ""}`}>
            {value.length}/{maxLength}
          </span>
        )}
      </span>
      {textarea ? (
        <textarea
          value={value}
          rows={rows ?? 4}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={mono ? "mono" : undefined}
        />
      ) : (
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={mono ? "mono" : undefined}
        />
      )}
    </label>
  );
}
