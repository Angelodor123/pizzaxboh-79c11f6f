import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, placeholder, ...props }, ref) => {
    const resolvedPlaceholder =
      placeholder === undefined && type === "number" ? "0" : placeholder;
    return (
      <input
        type={type}
        placeholder={resolvedPlaceholder}
        className={cn(
          "flex h-11 w-full items-center rounded-md border border-input bg-transparent px-3 py-0 text-base leading-none shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm [&::-webkit-datetime-edit]:py-0 [&::-webkit-datetime-edit]:leading-none [&::-webkit-calendar-picker-indicator]:cursor-pointer",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
