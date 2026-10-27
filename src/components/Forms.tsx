import { ReactNode } from "react";
export function Field({
  label,
  name,
  type = "text",
  value,
  required = false,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  children?: ReactNode;
}) {
  return (
    <label>
      {label}
      {children ? (
        <select name={name} defaultValue={value} required={required}>
          {children}
        </select>
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          step={type === "number" ? "1" : undefined}
        />
      )}
    </label>
  );
}
export function Check({
  name,
  label,
  checked = false,
}: {
  name: string;
  label: string;
  checked?: boolean;
}) {
  return (
    <label className="check">
      <input name={name} type="checkbox" defaultChecked={checked} />
      {label}
    </label>
  );
}
export function download(
  name: string,
  content: string,
  type = "text/csv;charset=utf-8",
) {
  const u = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  URL.revokeObjectURL(u);
}
