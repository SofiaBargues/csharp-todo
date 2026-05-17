import * as React from "react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn("p-3 text-sm", className)}
      classNames={{
        months: "flex flex-col",
        month: "flex flex-col gap-3",
        month_caption: "flex h-8 items-center justify-center font-semibold",
        nav: "absolute right-3 top-3 flex items-center gap-1",
        button_previous:
          "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        button_next:
          "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        weekdays: "grid grid-cols-7 text-muted-foreground",
        weekday: "flex size-8 items-center justify-center text-xs font-medium",
        week: "grid grid-cols-7",
        day: "size-8 p-0 text-center",
        day_button:
          "inline-flex size-8 items-center justify-center rounded-md text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        selected: "[&_button]:bg-primary [&_button]:text-primary-foreground",
        today: "[&_button]:border [&_button]:border-border",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-40",
        hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  );
}
