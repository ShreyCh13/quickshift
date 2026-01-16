"use client";

type Props = {
  message: string;
  tone?: "success" | "error" | "info";
};

export default function Toast({ message, tone = "info" }: Props) {
  const colors =
    tone === "success"
      ? "bg-emerald-600"
      : tone === "error"
        ? "bg-red-600"
        : "bg-slate-800";
  return (
    <div className={`${colors} rounded-md px-3 py-2 text-sm text-white`}>
      {message}
    </div>
  );
}
