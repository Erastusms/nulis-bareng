import * as React from "react";

interface DocumentsLayoutProps {
  children: React.ReactNode;
}

export default function DocumentsLayout({ children }: DocumentsLayoutProps) {
  return <div className="min-h-[500px]">{children}</div>;
}
