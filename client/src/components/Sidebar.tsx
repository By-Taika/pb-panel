import type { Category, CategoryConfig, RepoInfo } from '../lib/types';

interface SidebarProps {
  categories: CategoryConfig[];
  repos: Record<Category, RepoInfo[]>;
  selected: Category | 'all';
  onSelect: (c: Category | 'all') => void;
}

export function Sidebar({ categories, repos, selected, onSelect }: SidebarProps) {
  const total = Object.values(repos).reduce((s, list) => s + list.length, 0);
  const dirtyTotal = Object.values(repos)
    .flat()
    .filter((r) => r.dirty > 0 || r.ahead > 0 || r.behind > 0).length;

  return (
    <aside className="w-56 shrink-0 border-r border-panel-border p-4 space-y-1">
      <div className="text-[10px] font-mono uppercase tracking-wider text-panel-muted mb-2 px-2">
        Kategoriler
      </div>

      <SideItem
        active={selected === 'all'}
        onClick={() => onSelect('all')}
        label="Tümü"
        count={total}
        badge={dirtyTotal > 0 ? `${dirtyTotal} aktif` : undefined}
        tone="accent"
      />

      <div className="h-px bg-panel-border my-3" />

      {categories.length === 0 && (
        <div className="text-xs text-panel-muted px-2">
          Henüz kategori yok. Ayarlar'dan ekle.
        </div>
      )}

      {categories.map((cat, i) => {
        const list = repos[cat.name] || [];
        const dirty = list.filter((r) => r.dirty > 0 || r.ahead > 0 || r.behind > 0).length;
        // Alternate tone by position so neighbouring categories look distinct.
        const tone: 'accent' | 'accent2' = i % 2 === 0 ? 'accent' : 'accent2';
        return (
          <SideItem
            key={cat.name}
            active={selected === cat.name}
            onClick={() => onSelect(cat.name)}
            label={cat.name}
            count={list.length}
            badge={dirty > 0 ? `${dirty}` : undefined}
            tone={tone}
          />
        );
      })}
    </aside>
  );
}

function SideItem({
  active,
  onClick,
  label,
  count,
  badge,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  badge?: string;
  tone: 'accent' | 'accent2';
}) {
  const toneBorder = tone === 'accent' ? 'border-l-panel-accent' : 'border-l-panel-accent2';
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border-l-2 transition-colors text-left text-sm ${
        active
          ? `bg-panel-raised ${toneBorder} text-panel-text`
          : 'border-l-transparent text-panel-muted hover:bg-panel-raised/50 hover:text-panel-text'
      }`}
    >
      <span className="font-medium">{label}</span>
      <span className="flex items-center gap-1.5">
        {badge && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-panel-warn/10 text-panel-warn border border-panel-warn/30">
            {badge}
          </span>
        )}
        <span className="text-xs font-mono text-panel-muted">{count}</span>
      </span>
    </button>
  );
}
