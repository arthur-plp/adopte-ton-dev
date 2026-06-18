import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: ReactNode;
  action?: ReactNode;
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <h2 className="font-semibold text-foreground">{title}</h2>
      {action && <div className="ml-4 shrink-0">{action}</div>}
    </div>
  );
}
