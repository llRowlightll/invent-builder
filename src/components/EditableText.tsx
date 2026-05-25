import React, { useState, useRef, useEffect } from "react";
import { useEditMode } from "@/lib/edit-mode-context";

interface EditableTextProps {
  contentKey: string;
  locale: string;
  fallback: string;
  as?: string;
  className?: string;
  multiline?: boolean;
}

export function EditableText({
  contentKey,
  locale,
  fallback,
  as: Tag = "span",
  className = "",
  multiline = false,
}: EditableTextProps) {
  const { isEditMode, getContent, saveContent } = useEditMode();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  const value = getContent(contentKey, locale, fallback);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [editing, value]);

  async function handleSave() {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    await saveContent(contentKey, locale, draft);
    setSaving(false);
    setEditing(false);
  }

  if (!isEditMode) {
    return React.createElement(Tag, { className }, value);
  }

  if (editing) {
    return (
      <span className="inline-block relative">
        {multiline ? (
          <textarea
            ref={inputRef as React.Ref<HTMLTextAreaElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="w-full min-w-[300px] px-2 py-1 border-2 border-info rounded text-sm bg-background text-foreground focus:outline-none resize-y"
            onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }}
          />
        ) : (
          <input
            ref={inputRef as React.Ref<HTMLInputElement>}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="px-2 py-1 border-2 border-info rounded text-sm bg-background text-foreground focus:outline-none min-w-[200px]"
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
          />
        )}
        <span className="flex gap-1 mt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-[10px] px-2 py-0.5 rounded bg-info text-white font-medium disabled:opacity-50"
          >
            {saving ? "…" : "✓ Spara"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground"
          >
            Avbryt
          </button>
        </span>
      </span>
    );
  }

  return React.createElement(
    Tag,
    {
      className: `${className} group relative cursor-pointer outline-2 outline-dashed outline-info/40 hover:outline-info rounded px-0.5 transition-all`,
      onClick: () => setEditing(true),
      title: "Klicka för att redigera",
    },
    value,
    React.createElement(
      "span",
      { className: "absolute -top-2 -right-2 hidden group-hover:flex items-center justify-center size-4 rounded-full bg-info text-white text-[8px] font-bold shadow z-10" },
      "✎"
    )
  );
}
