import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
       className={cn(
  "flex h-10 w-full rounded-xl border border-gray-300 bg-background px-3 py-2 text-base placeholder:text-muted-foreground outline-none focus:border-orange-600 focus:ring-0 focus-visible:ring-0 ring-offset-0 shadow-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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
