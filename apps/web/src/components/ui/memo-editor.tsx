"use client";

import { useId, useState } from "react";
import { Memo } from "./display";
import { Segmented, Textarea } from "./forms";

/** Markdown memo editor with a rendered preview and an on-chain byte budget (memos are emitted in events). */
export function MemoEditor({
  value,
  onChange,
  maxBytes,
  label,
  placeholder,
  rows = 14,
}: {
  value: string;
  onChange: (v: string) => void;
  maxBytes?: number;
  label: string;
  placeholder?: string;
  rows?: number;
}) {
  const id = useId();
  const [tab, setTab] = useState<"write" | "preview">("write");
  const bytes = new TextEncoder().encode(value).length;
  const over = maxBytes !== undefined && bytes > maxBytes;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label htmlFor={id} className="body-sm font-medium text-fg">
          {label}
        </label>
        <div className="w-[200px]">
          <Segmented
            label="Memo view"
            value={tab}
            onChange={setTab}
            options={[
              { value: "write", label: "Write" },
              { value: "preview", label: "Preview" },
            ]}
          />
        </div>
      </div>
      {tab === "write" ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          invalid={over}
          spellCheck
        />
      ) : (
        <div className="min-h-[160px] rounded-[8px] border border-line bg-surface-2 p-4">
          {value.trim() ? (
            <Memo text={value} />
          ) : (
            <p className="body-sm text-fg-3">Nothing to preview yet.</p>
          )}
        </div>
      )}
      <p className={over ? "caption text-fail" : "caption text-fg-3"}>
        Markdown · {bytes.toLocaleString()}
        {maxBytes !== undefined ? ` / ${maxBytes.toLocaleString()}` : ""} bytes · stored in the
        event log, hash on-chain
      </p>
    </div>
  );
}
