"use client";

import { useEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onAddNew?: (name: string) => Promise<void>;
  fetchSuggestions: (search: string) => Promise<string[]>;
  placeholder?: string;
  required?: boolean;
  accentColor?: "emerald" | "blue";
  disabled?: boolean;
}

export default function Autocomplete({
  label,
  value,
  onChange,
  onAddNew,
  fetchSuggestions,
  placeholder,
  required,
  accentColor = "emerald",
  disabled = false,
}: Props) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedInput = useDebounce(inputValue, 200);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Fetch suggestions when input changes
  useEffect(() => {
    if (!focused) return;
    fetchSuggestions(debouncedInput).then((results) => {
      setSuggestions(results);
      setOpen(results.length > 0 || (debouncedInput.trim().length > 0 && !!onAddNew));
    });
  }, [debouncedInput, focused]);

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocused(false);
        // If user typed something not in suggestions, keep it as free text
        if (inputValue !== value) {
          onChange(inputValue);
        }
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [inputValue, value, onChange]);

  function handleSelect(name: string) {
    setInputValue(name);
    onChange(name);
    setOpen(false);
    setFocused(false);
  }

  async function handleAddNew() {
    if (!onAddNew || !inputValue.trim()) return;
    setAdding(true);
    try {
      await onAddNew(inputValue.trim());
      onChange(inputValue.trim());
      setOpen(false);
    } finally {
      setAdding(false);
    }
  }

  const focusRing = accentColor === "blue" ? "focus:border-blue-500" : "focus:border-emerald-500";
  const addBtnColor =
    accentColor === "blue"
      ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100";

  const exactMatch = suggestions.some((s) => s.toLowerCase() === inputValue.trim().toLowerCase());
  const showAddOption = onAddNew && inputValue.trim().length > 0 && !exactMatch;

  return (
    <div ref={containerRef} className="relative">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </span>
        <input
          type="text"
          value={inputValue}
          disabled={disabled}
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange(e.target.value);
          }}
          onFocus={() => {
            setFocused(true);
            fetchSuggestions(inputValue).then((results) => {
              setSuggestions(results);
              setOpen(results.length > 0 || (inputValue.trim().length > 0 && !!onAddNew));
            });
          }}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-base ${focusRing} focus:outline-none disabled:bg-slate-50 disabled:text-slate-400`}
        />
      </label>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border-2 border-slate-200 bg-white shadow-xl">
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(name);
              }}
              className="flex w-full items-center px-4 py-3 text-left text-sm text-slate-800 hover:bg-slate-50 active:bg-slate-100"
            >
              <span className="mr-2 text-slate-400">✓</span>
              {name}
            </button>
          ))}

          {showAddOption && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleAddNew();
              }}
              disabled={adding}
              className={`flex w-full items-center gap-2 border-t border-slate-100 px-4 py-3 text-left text-sm font-medium ${addBtnColor} disabled:opacity-50`}
            >
              {adding ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Adding...
                </>
              ) : (
                <>
                  <span className="text-lg leading-none">+</span>
                  Add &quot;{inputValue.trim()}&quot;
                </>
              )}
            </button>
          )}

          {suggestions.length === 0 && !showAddOption && (
            <div className="px-4 py-3 text-sm text-slate-400">No results</div>
          )}
        </div>
      )}
    </div>
  );
}
