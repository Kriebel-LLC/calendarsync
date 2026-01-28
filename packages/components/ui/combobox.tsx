"use client";

import { cn } from "components/lib/utils";
import { Button } from "components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";

interface ComboboxProps {
  options: Array<{ value: string; label: string }>;
  onSelect: (value: string) => void;
  value?: string;
  emptySearchText?: string;
  selectText?: string;
}

export function Combobox({
  options,
  onSelect,
  value,
  emptySearchText,
  selectText,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[75px] justify-between"
          suppressHydrationWarning={true}
        >
          {value
            ? options.find((framework) => framework.value === value)?.label
            : selectText
            ? selectText
            : "Select option..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[75px] p-0">
        <Command>
          <CommandInput placeholder={selectText} />
          <CommandEmpty>
            {emptySearchText ? emptySearchText : "No options found."}
          </CommandEmpty>
          <CommandGroup>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                onSelect={(currentValue) => {
                  onSelect(currentValue === value ? "" : currentValue);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === option.value ? "opacity-100" : "opacity-0"
                  )}
                />
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
