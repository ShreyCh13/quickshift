import type { ReactNode } from "react";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";

type Props = {
  title: string;
  children: ReactNode;
};

export default function MobileShell({ title, children }: Props) {
  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar title={title} />
      <main className="mx-auto max-w-xl px-4 pb-24 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
