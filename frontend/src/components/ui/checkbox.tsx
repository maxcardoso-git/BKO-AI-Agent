"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface CheckboxProps extends Omit<React.ComponentProps<"input">, "type" | "onChange"> {
  onCheckedChange?: (checked: boolean) => void
}

function Checkbox({ className, onCheckedChange, checked, defaultChecked, ...props }: CheckboxProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onCheckedChange?.(e.target.checked)
  }

  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      checked={checked}
      defaultChecked={defaultChecked}
      onChange={handleChange}
      className={cn(
        "h-4 w-4 shrink-0 rounded border border-input accent-primary cursor-pointer disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Checkbox }
