import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Lang = 'tr' | 'en';

type Translations = Record<string, { tr: string; en: string }>;

// Flat translation table. Keys are dotted namespaces so similar concepts
// cluster together (header.*, branches.*, prs.*). Values carry both
// languages so there's no async loading step.
const T: Translations = {
  // --- Header / global ---
  'header.settings': { tr: 'Ayarlar', en: 'Settings' },
  'header.refresh': { tr: 'Yenile', en: 'Refresh' },
  'header.refreshing': { tr: 'Yenileniyor…', en: 'Refreshing…' },
  'header.clone': { tr: 'Clone', en: 'Clone' },
  'header.language': { tr: 'Dil', en: 'Language' },
  'header.toggleLanguage': { tr: 'İngilizce\'ye geç', en: 'Switch to Turkish' },
  'header.repos': { tr: 'repo', en: 'repos' },

  // --- Sidebar ---
  'sidebar.all': { tr: 'Hepsi', en: 'All' },
  'sidebar.categories': { tr: 'Kategoriler', en: 'Categories' },
  'sidebar.allTitle': { tr: 'Tümü', en: 'All' },
  'sidebar.activeBadge': { tr: '{n} aktif', en: '{n} active' },
  'sidebar.empty': { tr: 'Henüz kategori yok. Ayarlar\'dan ekle.', en: 'No categories yet. Add some from Settings.' },

  // --- Main ---
  'main.allCategories': { tr: 'Tüm kategoriler', en: 'All categories' },
  'main.pullAllBehind': { tr: '↓↓ Pull behind\'i olanları', en: '↓↓ Pull all behind' },
  'main.noCategories': { tr: 'Henüz hiç kategori tanımlı değil.', en: 'No categories defined yet.' },
  'main.emptyCategory': { tr: '{cat} kategorisinde henüz repo yok', en: 'No repos in {cat}' },
  'main.noRepoToPull': { tr: 'Çekilecek repo yok (behind=0 veya dirty)', en: 'Nothing to pull (all in sync or dirty)' },
  'main.pullingN': { tr: '{n} repo güncelleniyor…', en: 'Pulling {n} repos…' },
  'main.booting': { tr: 'pb-panel yükleniyor…', en: 'pb-panel loading…' },

  // --- RepoCard ---
  'repoCard.pull': { tr: 'Pull', en: 'Pull' },
  'repoCard.fetch': { tr: 'Fetch', en: 'Fetch' },
  'repoCard.push': { tr: 'Push', en: 'Push' },
  'repoCard.open': { tr: 'Open', en: 'Open' },
  'repoCard.detail': { tr: 'Geçmiş & PR\'lar', en: 'History & PRs' },
  'repoCard.dirty': { tr: 'dirty', en: 'dirty' },
  'repoCard.noUpstream': { tr: 'no upstream', en: 'no upstream' },
  'repoCard.updates': { tr: 'update', en: 'updates' },
  'repoCard.remoteUpdatesTitle': { tr: 'Remote\'da yeni commit var (fetch edilmedi):\n{branches}', en: 'Remote has new commits (not yet fetched):\n{branches}' },

  // --- RepoDrawer ---
  'drawer.close': { tr: 'Kapat (Esc)', en: 'Close (Esc)' },
  'drawer.tab.overview': { tr: 'Genel bakış', en: 'Overview' },
  'drawer.tab.branches': { tr: 'Branches', en: 'Branches' },
  'drawer.tab.prs': { tr: 'PR', en: 'PRs' },
  'drawer.tab.conflicts': { tr: 'Çakışmalar', en: 'Conflicts' },

  // --- Overview ---
  'overview.github': { tr: 'GitHub', en: 'GitHub' },
  'overview.githubUnavailable': { tr: 'GitHub meta erişilemedi (token/özel repo?)', en: 'GitHub metadata unavailable (token/private repo?)' },
  'overview.localState': { tr: 'Lokal durum', en: 'Local state' },
  'overview.commitHistory': { tr: 'Commit history', en: 'Commit history' },
  'overview.noCommits': { tr: 'Henüz commit yok', en: 'No commits yet' },
  'overview.stat.default': { tr: 'default', en: 'default' },
  'overview.stat.stars': { tr: 'stars', en: 'stars' },
  'overview.stat.openIssues': { tr: 'open issues', en: 'open issues' },
  'overview.stat.visibility': { tr: 'visibility', en: 'visibility' },
  'overview.stat.language': { tr: 'language', en: 'language' },
  'overview.stat.pushed': { tr: 'pushed', en: 'pushed' },
  'overview.stat.branch': { tr: 'branch', en: 'branch' },
  'overview.stat.dirtyFiles': { tr: 'dirty files', en: 'dirty files' },
  'overview.stat.ahead': { tr: 'ahead', en: 'ahead' },
  'overview.stat.behind': { tr: 'behind', en: 'behind' },
  'overview.stat.remoteUpdates': { tr: 'remote updates', en: 'remote updates' },
  'overview.stat.account': { tr: 'account', en: 'account' },
  'overview.visibility.private': { tr: 'private', en: 'private' },
  'overview.visibility.public': { tr: 'public', en: 'public' },

  // --- Branches ---
  'branches.title': { tr: 'Branches', en: 'Branches' },
  'branches.newButton': { tr: '+ Yeni', en: '+ New' },
  'branches.closeForm': { tr: '×', en: '×' },
  'branches.newPlaceholder': { tr: 'feature/yeni-isim', en: 'feature/new-name' },
  'branches.createAndCheckout': { tr: 'Oluştur + checkout', en: 'Create + checkout' },
  'branches.created': { tr: '{name} oluşturuldu', en: '{name} created' },
  'branches.checkedOut': { tr: '{name} checkout edildi', en: 'switched to {name}' },
  'branches.pushed': { tr: '{name} push edildi', en: '{name} pushed' },
  'branches.deleted': { tr: '{name} silindi', en: '{name} deleted' },
  'branches.deleteConfirm': { tr: '{name} silinsin mi?', en: 'Delete {name}?' },
  'branches.noLocal': { tr: 'Yerel branch yok', en: 'No local branches' },
  'branches.remoteCount': { tr: 'Remote ({n})', en: 'Remote ({n})' },
  'branches.remoteCheckout': { tr: 'checkout', en: 'checkout' },
  'branches.remoteCheckedOut': { tr: '{name} local olarak oluşturuldu + checkout edildi', en: '{name} created locally + checked out' },
  'branches.stashTitle': { tr: 'Stash', en: 'Stash' },
  'branches.stashTitleN': { tr: 'Stash ({n})', en: 'Stash ({n})' },
  'branches.stashSave': { tr: 'Stash değişiklikleri', en: 'Stash changes' },
  'branches.stashSaved': { tr: 'stash kaydedildi', en: 'stash saved' },
  'branches.noStashes': { tr: 'Stash yok', en: 'No stashes' },
  'branches.noDirty': { tr: 'Kirli değişiklik yok', en: 'No dirty changes' },
  'branches.stashDirtyTitle': { tr: 'Değişiklikleri stash\'le', en: 'Stash the dirty changes' },
  'branches.stashPopped': { tr: 'stash pop edildi', en: 'stash popped' },
  'branches.stashDropped': { tr: 'stash silindi', en: 'stash dropped' },
  'branches.stashDropConfirm': { tr: 'stash@{idx} silinsin mi?', en: 'Drop stash@{idx}?' },
  'branches.tipCheckout': { tr: 'checkout', en: 'checkout' },
  'branches.tipPush': { tr: 'push', en: 'push' },
  'branches.tipPushUpstream': { tr: 'push -u origin', en: 'push -u origin' },
  'branches.tipDelete': { tr: 'delete', en: 'delete' },
  'branches.loading': { tr: 'Yükleniyor…', en: 'Loading…' },

  // --- Pull Requests ---
  'prs.title': { tr: 'Açık PR\'lar', en: 'Open PRs' },
  'prs.titleN': { tr: 'Açık PR\'lar ({n})', en: 'Open PRs ({n})' },
  'prs.newButton': { tr: '+ Yeni PR', en: '+ New PR' },
  'prs.closeForm': { tr: '×', en: '×' },
  'prs.noPrs': { tr: 'Açık PR yok', en: 'No open PRs' },
  'prs.noRemote': { tr: 'Bu repo\'nun GitHub remote\'u yok (owner/repo okunamıyor).', en: 'This repo has no GitHub remote (owner/repo not resolved).' },
  'prs.draft': { tr: 'draft', en: 'draft' },
  'prs.loadingDetail': { tr: 'yükleniyor…', en: 'loading…' },
  'prs.stat.head': { tr: 'head', en: 'head' },
  'prs.stat.base': { tr: 'base', en: 'base' },
  'prs.stat.mergeable': { tr: 'mergeable', en: 'mergeable' },
  'prs.stat.autoMerge': { tr: 'auto-merge', en: 'auto-merge' },
  'prs.mergeable.clean': { tr: 'temiz ({s})', en: 'clean ({s})' },
  'prs.mergeable.conflict': { tr: 'çakışma ({s})', en: 'conflict ({s})' },
  'prs.mergeable.calculating': { tr: 'hesaplanıyor', en: 'calculating' },
  'prs.autoMergeOn': { tr: 'aktif', en: 'on' },
  'prs.autoMergeOff': { tr: 'kapalı', en: 'off' },
  'prs.description': { tr: 'Açıklama', en: 'Description' },
  'prs.mergeNow': { tr: 'Merge şimdi', en: 'Merge now' },
  'prs.mergeConfirm': { tr: 'PR #{n} {method} ile merge edilsin mi?', en: 'Merge PR #{n} with {method}?' },
  'prs.mergedOk': { tr: 'PR #{n} merge edildi ({method})', en: 'PR #{n} merged ({method})' },
  'prs.mergeConflictTitle': { tr: 'Çakışma var, merge edilemez', en: 'Conflict present, cannot merge' },
  'prs.enableAuto': { tr: 'Auto-merge aç ({method})', en: 'Enable auto-merge ({method})' },
  'prs.disableAuto': { tr: 'Auto-merge iptal', en: 'Disable auto-merge' },
  'prs.autoEnabled': { tr: 'PR #{n} için auto-merge aktif', en: 'Auto-merge enabled for PR #{n}' },
  'prs.autoDisabled': { tr: 'PR #{n} auto-merge iptal', en: 'Auto-merge disabled for PR #{n}' },
  'prs.openInGithub': { tr: 'GitHub\'da aç ↗', en: 'Open on GitHub ↗' },
  'prs.form.head': { tr: 'head branch', en: 'head branch' },
  'prs.form.base': { tr: 'base branch', en: 'base branch' },
  'prs.form.title': { tr: 'Başlık', en: 'Title' },
  'prs.form.body': { tr: 'Açıklama (markdown)', en: 'Description (markdown)' },
  'prs.form.draft': { tr: 'draft', en: 'draft' },
  'prs.form.cancel': { tr: 'İptal', en: 'Cancel' },
  'prs.form.submit': { tr: 'PR oluştur', en: 'Create PR' },
  'prs.form.required': { tr: 'title / head / base zorunlu', en: 'title / head / base required' },
  'prs.form.created': { tr: 'PR #{n} oluşturuldu', en: 'PR #{n} created' },

  // --- Conflicts ---
  'conflicts.none': { tr: 'Çakışma yok. Bu repo temiz bir durumda.', en: 'No conflicts. Repo is clean.' },
  'conflicts.merge': { tr: 'merge', en: 'merge' },
  'conflicts.rebase': { tr: 'rebase', en: 'rebase' },
  'conflicts.inProgress': { tr: '{label} devam ediyor', en: '{label} in progress' },
  'conflicts.inProgressDesc': { tr: '{n} dosyada çakışma var. Her birini çöz (ours/theirs/manuel), sonra devam et ya da iptal et.', en: '{n} files in conflict. Resolve each (ours/theirs/manual) then continue or abort.' },
  'conflicts.continue': { tr: '✓ Devam', en: '✓ Continue' },
  'conflicts.continueResolveFirst': { tr: 'Önce tüm dosyaları çöz', en: 'Resolve all files first' },
  'conflicts.continueTitle': { tr: '{label} devam', en: '{label} continue' },
  'conflicts.continueOk': { tr: '{label} tamamlandı', en: '{label} finalized' },
  'conflicts.abort': { tr: '× İptal', en: '× Abort' },
  'conflicts.abortConfirm': { tr: '{label} iptal edilsin mi? Değişiklikler geri alınacak.', en: 'Abort {label}? Changes will be reverted.' },
  'conflicts.abortOk': { tr: '{label} iptal edildi', en: '{label} aborted' },
  'conflicts.filesTitle': { tr: 'Çakışan dosyalar ({n})', en: 'Conflicted files ({n})' },
  'conflicts.chooseOurs': { tr: '← ours seç', en: '← use ours' },
  'conflicts.chooseTheirs': { tr: 'theirs seç →', en: 'use theirs →' },
  'conflicts.openInIde': { tr: 'IDE\'de aç', en: 'Open in IDE' },
  'conflicts.ideOpened': { tr: 'IDE açıldı', en: 'IDE opened' },
  'conflicts.oursPicked': { tr: '{file} → ours', en: '{file} → ours' },
  'conflicts.theirsPicked': { tr: '{file} → theirs', en: '{file} → theirs' },
  'conflicts.diffLoading': { tr: 'yükleniyor…', en: 'loading…' },
  'conflicts.loading': { tr: 'Yükleniyor…', en: 'Loading…' },

  // --- Update modal ---
  'update.title': { tr: 'Yeni sürüm var', en: 'New version available' },
  'update.cta': { tr: 'İndir ve yükle', en: 'Download & install' },
  'update.later': { tr: 'Sonra', en: 'Later' },
  'update.explanation': { tr: 'Güncelleme indirildikten sonra panel yeniden başlayacak. Açık işlerin kaybolmaz ama yeniden açmak gerekebilir.', en: 'The panel will restart after the update is installed. Open work won\'t be lost but may need to be reopened.' },
  'update.downloading': { tr: 'İndiriliyor…', en: 'Downloading…' },
  'update.installing': { tr: 'Yükleniyor, birazdan yeniden başlatılacak…', en: 'Installing, about to relaunch…' },
  'update.error': { tr: 'Güncelleme hatası: {err}', en: 'Update error: {err}' },
  'update.close': { tr: 'Kapat', en: 'Close' },
  'update.retry': { tr: 'Tekrar dene', en: 'Retry' },

  // --- Notifications ---
  'notif.newCommit.title': { tr: 'Yeni commit var', en: 'New commits' },
  'notif.newCommit.body': { tr: '{name} {n} commit geride. Pull etmek ister misin?', en: '{name} is {n} commits behind. Pull?' },
  'notif.dirty.title': { tr: 'Uncommitted değişiklik', en: 'Uncommitted changes' },
  'notif.dirty.body': { tr: '{name} içinde {n} dosya değişmiş, henüz commit edilmemiş.', en: '{name} has {n} changed files, not yet committed.' },
  'notif.remote.title': { tr: 'Remote güncellendi', en: 'Remote updated' },
  'notif.remote.body': { tr: '{name} için upstream\'de yeni iş var ({branches}).', en: '{name} has new upstream work ({branches}).' },

  // --- Errors / toasts ---
  'error.dirtyWorktree': { tr: 'Working tree kirli. Önce commit/stash yap veya reset çek.', en: 'Working tree is dirty. Commit, stash or reset first.' },
  'error.branchNameEmpty': { tr: 'Branch adı boş olamaz', en: 'Branch name cannot be empty' },
};

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nCtx>({
  lang: 'tr',
  setLang: () => {},
  t: (k) => k,
});

const STORAGE_KEY = 'pb-panel.lang';

function detectInitial(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'tr' || stored === 'en') return stored;
  } catch {
    /* no-op */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return nav.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* no-op */
    }
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const entry = T[key];
      if (!entry) {
        // Surface missing keys in dev without crashing: show the raw key so it is obvious.
        return key;
      }
      return format(entry[lang], vars);
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  return useContext(Ctx);
}

export function useT() {
  return useContext(Ctx).t;
}
