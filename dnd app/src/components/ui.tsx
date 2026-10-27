import {
  useContext,
  useId,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { X, Plus, LoaderCircle } from "lucide-react";
import { AppContext, useApp } from "../lib/data";
export function Button({
  children,
  onClick,
  secondary = false,
  danger = false,
  disabled = false,
  type = "button",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  type?: "submit" | "button";
  title?: string;
}) {
  return (
    <button
      title={title}
      type={type}
      className={`button ${secondary ? "secondary" : ""} ${danger ? "danger" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-rune">◇</div>
      <h3>{title}</h3>
      <div className="muted">{children}</div>
    </div>
  );
}
export function Heading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">
          {eyebrow || "IL TUO TAVOLO, SEMPRE CON TE"}
        </div>
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  );
}
export function Field({
  label,
  name,
  value = "",
  type = "text",
  required = false,
  min,
  max,
  step,
  placeholder,
}: {
  label: string;
  name: string;
  value?: string | number;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number | "any";
  placeholder?: string;
}) {
  return (
    <label className="field">
      {label}
      <input
        name={name}
        defaultValue={value}
        type={type}
        required={required}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        maxLength={type === "text" ? 500 : undefined}
      />
    </label>
  );
}
export function Area({
  label,
  name,
  value = "",
}: {
  label: string;
  name: string;
  value?: string;
}) {
  return (
    <label className="field">
      {label}
      <textarea name={name} defaultValue={value} rows={4} maxLength={10000} />
    </label>
  );
}
export function Select({
  label,
  name,
  value = "",
  children,
}: {
  label: string;
  name: string;
  value?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} name={name} defaultValue={value}>
        {children}
      </select>
    </div>
  );
}
export function Form({
  children,
  onSave,
  submit = "Salva",
  initial = {},
}: {
  children: ReactNode;
  onSave: (data: Record<string, string>) => Promise<unknown>;
  submit?: string;
  initial?: Record<string, string>;
}) {
  const app = useContext(AppContext);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const data = {
      ...initial,
      ...Object.fromEntries(new FormData(e.currentTarget)),
    } as Record<string, string>;
    try {
      await onSave(data);
    } catch (e) {
      setError((e as Error).message || "Operazione non riuscita");
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={save} className="form">
      {children}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending || (!!app && (!app.online || app.busy))}
      >
        {pending ? <LoaderCircle className="spin" size={18} /> : null}
        {pending ? "Salvataggio…" : submit}
      </Button>
    </form>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <dialog
        open
        ref={(el) => {
          if (el && !el.matches(":modal")) {
            el.close();
            el.showModal();
          }
        }}
        onCancel={onClose}
        aria-label={title}
        className="modal"
      >
        <div className="section-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Chiudi">
            <X size={22} />
          </button>
        </div>
        {children}
      </dialog>
    </div>
  );
}
export function Action({
  action,
  data,
  children,
  secondary = true,
  disabled = false,
  confirm,
}: {
  action: string;
  data?: object;
  children: ReactNode;
  secondary?: boolean;
  disabled?: boolean;
  confirm?: string;
}) {
  const { run, busy, online } = useApp();
  return (
    <Button
      secondary={secondary}
      disabled={disabled || busy || !online}
      onClick={() => {
        if (!confirm || window.confirm(confirm))
          void run(action, data).catch(() => {});
      }}
    >
      {children}
    </Button>
  );
}
export function AddButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button onClick={onClick}>
      <Plus size={18} />
      {children}
    </Button>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" /> Preparando il tavolo…
    </div>
  );
}
