"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, MapPin } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useLocationSuggestions } from "@/lib/query-hooks";
import { LocationSuggestion } from "@/lib/types";

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debounced;
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: LocationSuggestion) => void;
  placeholder?: string;
  country?: string;
};

export function LocationAutocompleteField({ value, onChange, onSelect, placeholder, country }: Props) {
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(value, 250);
  const suggestionsQuery = useLocationSuggestions(debouncedQuery, country, open);

  const suggestions = suggestionsQuery.data ?? [];
  const hasSuggestions = suggestions.length > 0;

  const emptyMessage = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.trim().length < 3) return "Type at least 3 characters";
    if (suggestionsQuery.isLoading) return "Searching locations...";
    return "No matching locations";
  }, [debouncedQuery, suggestionsQuery.isLoading]);

  return (
    <Popover open={open && (suggestionsQuery.isLoading || hasSuggestions || debouncedQuery.trim().length >= 3)} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Input
            value={value}
            placeholder={placeholder}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              onChange(event.target.value);
              setOpen(true);
            }}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandList>
            {!hasSuggestions ? <CommandEmpty>{emptyMessage}</CommandEmpty> : null}
            {suggestions.map((suggestion) => (
              <CommandItem
                key={suggestion.id}
                value={suggestion.label}
                onSelect={() => {
                  onSelect(suggestion);
                  setOpen(false);
                }}
                className="items-start"
              >
                <MapPin className="mt-0.5 size-4 text-slate-500" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{suggestion.label}</div>
                  <div className="truncate text-xs text-slate-500">
                    {[suggestion.address.city, suggestion.address.province, suggestion.address.country].filter(Boolean).join(", ")}
                  </div>
                </div>
                <Check className={cn("size-4 opacity-0")} />
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
