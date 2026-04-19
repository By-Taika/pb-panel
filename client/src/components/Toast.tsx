interface ToastItem {
  id: number;
  msg: string;
  ok: boolean;
}

interface ToastStackProps {
  items: ToastItem[];
}

export function ToastStack({ items }: ToastStackProps) {
  return (
    <div className="fixed bottom-4 right-4 z-30 space-y-2 max-w-sm">
      {items.map((t) => (
        <div
          key={t.id}
          className={`text-xs font-mono px-3 py-2 rounded border backdrop-blur-sm animate-fade-in ${
            t.ok
              ? 'bg-panel-accent/10 border-panel-accent/40 text-panel-accent'
              : 'bg-panel-danger/10 border-panel-danger/40 text-panel-danger'
          }`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}
