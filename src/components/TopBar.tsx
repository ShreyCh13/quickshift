type Props = {
  title: string;
};

export default function TopBar({ title }: Props) {
  return (
    <header className="sticky top-0 z-10 border-b bg-white">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      </div>
    </header>
  );
}
