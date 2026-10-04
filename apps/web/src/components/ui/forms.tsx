"use client";

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

/** Labelled field with hint + inline error (forms always have labels). */
export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  htmlFor: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="body-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="caption text-fail">
          ⚠ {error}
        </p>
      ) : hint ? (
        <p className="caption text-fg-3">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  "h-10 w-full rounded-[8px] border bg-surface-2 px-3 body text-fg placeholder:text-fg-muted transition-colors focus:border-accent focus:outline-none disabled:opacity-50";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; suffix?: ReactNode }
>(function Input({ className, invalid, suffix, ...props }, ref) {
  return (
    <div className="relative">
      <input
        ref={ref}
        className={cn(
          inputBase,
          invalid ? "border-fail" : "border-line",
          suffix && "pr-16",
          className,
        )}
        {...props}
      />
      {suffix && (
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 mono-xs text-fg-3">
          {suffix}
        </span>
      )}
    </div>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        inputBase,
        "h-auto min-h-[160px] py-2.5 mono-sm leading-6",
        invalid ? "border-fail" : "border-line",
        className,
      )}
      {...props}
    />
  );
});

/** Amount input: big number + token pill + balance/MAX row. */
export function AmountInput({
  value,
  onChange,
  symbol,
  balanceLabel,
  onMax,
  invalid,
  label,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  symbol: string;
  balanceLabel?: string;
  onMax?: () => void;
  invalid?: boolean;
  label: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div
        className={cn(
          "flex h-16 items-center gap-3 rounded-[8px] border bg-surface-2 px-3 transition-colors focus-within:border-accent",
          invalid ? "border-fail" : "border-line",
        )}
      >
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value.replace(/,/g, ".");
            if (/^\d*\.?\d*$/.test(v)) onChange(v);
          }}
          className="figure-lg min-w-0 flex-1 bg-transparent text-fg placeholder:text-fg-muted focus:outline-none"
        />
        <span className="inline-flex h-8 shrink-0 items-center rounded-full bg-surface-3 px-3 mono-sm text-fg">
          {symbol}
        </span>
      </div>
      {(balanceLabel || onMax) && (
        <div className="mt-1.5 flex items-center justify-between mono-xs text-fg-3">
          <span>{balanceLabel}</span>
          {onMax && (
            <button
              type="button"
              onClick={onMax}
              className="-my-2 px-2 py-2 text-accent hover:text-accent-hover"
            >
              MAX
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Segmented control (PASS | FAIL, Buy | Sell). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; tone?: "pass" | "fail" }[];
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col rounded-full border border-line bg-canvas p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        const tone =
          o.tone === "pass"
            ? "bg-pass text-fg-inverse"
            : o.tone === "fail"
              ? "bg-fail text-fg-inverse"
              : "bg-white text-fg-inverse";
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-9 rounded-full body-sm font-medium transition-colors duration-150",
              active ? tone : "text-fg-2 hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Radio cards — a fused grid of choices (action types, tranches). Real radios for keyboard + screen readers. */
export function RadioCards<T extends string | number>({
  value,
  onChange,
  options,
  label,
  columns = 3,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; title: ReactNode; sub?: ReactNode; disabled?: boolean }[];
  label: string;
  columns?: 2 | 3 | 4;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div
        className={cn(
          "grid grid-cols-1 border-t border-l border-line-strong sm:grid-cols-2",
          columns === 3 && "lg:grid-cols-3",
          columns === 4 && "lg:grid-cols-4",
        )}
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <label
              key={String(o.value)}
              className={cn(
                "relative flex min-h-[84px] cursor-pointer flex-col gap-1 border-r border-b border-line-strong p-4 transition-colors duration-150",
                active ? "bg-accent-subtle" : "bg-surface-1 hover:bg-surface-2",
                o.disabled && "cursor-not-allowed opacity-40 hover:bg-surface-1",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent",
              )}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={active}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
              />
              <span className="flex items-center justify-between gap-2 body-sm font-medium text-fg">
                {o.title}
                <span
                  aria-hidden
                  className={cn(
                    "size-2.5 shrink-0 rounded-full border",
                    active ? "border-accent bg-accent" : "border-line-strong",
                  )}
                />
              </span>
              {o.sub && <span className="mono-xs leading-4 text-fg-3">{o.sub}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
