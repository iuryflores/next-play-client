import ThemePicker from './ThemePicker';
import PageLoading from './PageLoading';
import PageBoundary from './PageBoundary';
import AchievementProvider, { AchievementTitle } from './AchievementProvider';
import { genreLabel } from './i18n';
import { dateLabel } from './i18n';
import { language } from './i18n';
import { t } from './i18n';
import ReleaseBadge from './ReleaseBadge';
import IconAction from './IconAction';
import { Trash2, CircleAlert } from 'lucide-react';
import RecentWatched, {
  hasWatched,
  watchedTime,
  WatchedWhen,
} from './RecentWatched';
import { ReviewProvider } from './Review';
import SeriesResume from './SeriesResume';
import OriginalTitle from './OriginalTitle';
import {
  useEffect,
  lazy,
  useLayoutEffect,
  useRef,
  useState,
  type SubmitEvent,
} from 'react';
import {
  BookOpen,
  Trophy,
  Film,
  Tv,
  Gamepad2,
  LayoutGrid,
  Bookmark,
  CalendarDays,
  CalendarClock,
  CheckCheck,
  Plus,
  Search,
  LogOut,
  Library,
  Pencil,
  Compass,
  ChartNoAxesCombined,
  Archive,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ApiError, authRequest, type AuthUser } from './auth';
import {
  categories,
  statusNames,
  libraryRequest,
  type Kind,
  type Status,
  type LibraryItem,
} from './library';
import './home.css';
import MobileNavigation from './MobileNavigation';
import './mobile.css';
import QuickActions from './QuickActions';
import CompletionFields from './CompletionFields';
import { matchesView, overviewOrder } from './collection-view';
import type { CatalogTitle } from './CatalogSearch';

// Cada tela tem seu próprio arquivo de produção; voltar a ela reutiliza o módulo baixado.
const Stats = lazy(() => import('./Stats'));
const Incoming = lazy(() => import('./Incoming'));
const Friends = lazy(() => import('./Friends'));
const Account = lazy(() => import('./Account'));
const Collector = lazy(() => import('./Collector'));
const TitleDetails = lazy(() => import('./TitleDetails'));
const Explore = lazy(() => import('./Explore'));
const CatalogSearch = lazy(() => import('./CatalogSearch'));
const Achievements = lazy(() => import('./Achievements'));

const icons = { movie: Film, series: Tv, game: Gamepad2, book: BookOpen };
const views = [
  { id: 'all', label: t('Visão geral'), icon: LayoutGrid },
  { id: 'planned', label: t('Para depois'), icon: Bookmark },
  { id: 'coming-soon', label: t('Em breve'), icon: CalendarClock },
  { id: 'completed', label: t('Concluídos'), icon: CheckCheck },
  { id: 'archived', label: t('Arquivados'), icon: Archive },
] as const;
function Home({
  user,
  onUserChanged,
  logout,
  busy,
  notice,
  onExpired,
}: {
  user: AuthUser;
  onUserChanged: (user: AuthUser) => void;
  logout: () => Promise<void>;
  busy: boolean;
  notice: string;
  onExpired: () => void;
}) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailItem = items.find((item) => item.id === detailId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<
    | 'all'
    | 'explore'
    | 'add'
    | 'stats'
    | 'incoming'
    | 'coming-soon'
    | 'account'
    | 'achievements'
    | 'acervo'
    | 'archived'
    | 'friends'
    | Status
  >('all');
  const [density, setDensity] = useState<'compact' | 'details'>(
    user.collectionDensity || 'compact',
  );
  const [savingDensity, setSavingDensity] = useState(false);
  useEffect(() => {
    setDensity(user.collectionDensity || 'compact');
  }, [user.collectionDensity]);
  const compactCards = view === 'all' && density === 'compact';
  async function changeDensity(value: string) {
    if (savingDensity) return;
    const next = value === 'details' ? 'details' : 'compact';
    setSavingDensity(true);
    try {
      await authRequest('preferences', { collectionDensity: next });
      setDensity(next);
    } catch {
      setError(t('Não foi possível salvar a exibição. Tente novamente.'));
    } finally {
      setSavingDensity(false);
    }
  }
  const [category, setCategory] = useState<'all' | Kind>('all');
  const [search, setSearch] = useState('');
  const [historyMode, setHistoryMode] = useState(false);
  const pageRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const content = pageRef.current?.querySelector('.home-content');
    const animation = content?.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 240, easing: 'cubic-bezier(.2,.7,.2,1)' },
    );
    return () => animation?.cancel();
  }, [view, detailId]);
  useLayoutEffect(() => {
    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      pageRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    };
    resetScroll();
    const frame = requestAnimationFrame(resetScroll);
    return () => cancelAnimationFrame(frame);
  }, [view, detailId, category, historyMode]);
  const matchesCollection = (item: LibraryItem, target: string) =>
    target === 'completed' && historyMode
      ? !item.archived && hasWatched(item)
      : matchesView(item, target);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible')
        setReload((value) => value + 1);
    };
    window.addEventListener('focus', refresh);
    let day = new Date().toISOString().slice(0, 10);
    const timer = window.setInterval(() => {
      const today = new Date().toISOString().slice(0, 10);
      if (today !== day) {
        day = today;
        refresh();
      }
    }, 60000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.clearInterval(timer);
    };
  }, []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryItem | null>(null);
  const [kind, setKind] = useState<Kind>('movie');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [catalogMode, setCatalogMode] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState<CatalogTitle | null>(null);
  useEffect(() => {
    document.title = t('Minha biblioteca · NextPlay');
    let active = true;
    const controller = new AbortController();
    // Agrupa notificações próximas e cancela a leitura substituída por uma mais nova.
    const timer = window.setTimeout(() => {
      void libraryRequest<{ items: LibraryItem[] }>(
        'GET',
        '',
        undefined,
        undefined,
        undefined,
        controller.signal,
      )
        .then((data) => {
          if (active) {
            // A leitura compartilha a lista de acompanhamento, sem importar exemplares da Minha Coleção.
            setItems(data.items);
            setError('');
          }
        })
        .catch((reason: unknown) => {
          if (active)
            setError(
              reason instanceof ApiError && reason.status === 401
                ? t('Sua sessão expirou. Entre novamente.')
                : reason instanceof Error
                  ? reason.message
                  : t('Não foi possível carregar sua coleção.'),
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 150);
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
      document.title = t('Entrar · NextPlay');
    };
  }, [reload]);
  const visible = items.filter(
    (item) =>
      (category === 'all' || item.kind === category) &&
      matchesCollection(item, view) &&
      [
        item.title,
        item.originalTitle || '',
        ...(item.productionCompanies || []).map((company) => company.name),
      ].some((value) =>
        value
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLocaleLowerCase('pt-BR')
          .includes(
            search
              .trim()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLocaleLowerCase('pt-BR'),
          ),
      ),
  );
  {
    const compareOverview = overviewOrder();
    const releaseYear = (item: LibraryItem) =>
      /^\d{4}$/.test(item.year || '') ? Number(item.year) : 0;
    const releaseTime = (item: LibraryItem) => {
      const date = Date.parse(item.releaseDate || '');
      return Number.isFinite(date) ? date : Number.MAX_SAFE_INTEGER;
    };
    visible.sort(
      (a, b) =>
        (view === 'coming-soon' ? releaseTime(a) - releaseTime(b) : 0) ||
        (view === 'completed' && historyMode
          ? watchedTime(b) - watchedTime(a)
          : 0) ||
        (view === 'all' ? compareOverview(a, b) : 0) ||
        releaseYear(b) - releaseYear(a) ||
        a.title.localeCompare(b.title, language) ||
        a.id.localeCompare(b.id),
    );
  }
  function edit(item: LibraryItem | null) {
    setSelectedTitle(null);
    setCatalogMode(!item);
    setEditing(item);
    setKind(item?.kind || (category === 'all' ? 'movie' : category));
    setFormError('');
    setConfirmDelete(false);
    if (item) setOpen(true);
    else {
      setDetailId(null);
      setOpen(false);
      setView('add');
    }
  }
  function returnHome() {
    setDetailId(null);
    setView('all');
    setCategory('all');
    setSearch('');
    setHistoryMode(false);
  }
  function updateItem(item: LibraryItem, keepExplore = false) {
    const previous = items.find((entry) => entry.id === item.id);
    if (item.kind === 'series' && !keepExplore) setReload((value) => value + 1);
    setItems((current) => [
      item,
      ...current.filter((entry) => entry.id !== item.id),
    ]);
    // No Explorar, salvar atualiza apenas os cards, sem refazer a página ou navegar.
    if (
      !keepExplore &&
      previous?.status !== 'completed' &&
      item.status === 'completed'
    )
      returnHome();
  }
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    const genreInput = data.get('genres');
    setSaving(true);
    setFormError('');
    try {
      const result = await libraryRequest<{ item: LibraryItem }>(
        editing ? 'PATCH' : 'POST',
        editing?.id,
        {
          title: data.get('title'),
          kind,
          status: data.get('status'),
          ...(data.get('completedOn')
            ? { completedOn: data.get('completedOn') }
            : {}),
          stars: Number(data.get('stars') || 0),
          feeling: data.get('feeling') || '',
          favoriteCharacter: data.get('favoriteCharacter') || '',
          favoriteCastId: data.get('favoriteCastId') || '',
          notes: data.get('notes'),
          ...(kind === 'game'
            ? {
                platform: data.get('platform') || '',
                playtimeMinutes: Math.round(
                  Number(data.get('playtimeHours') || 0) * 60,
                ),
              }
            : {}),
          ...(kind === 'book' && (selectedTitle || editing?.catalogId)
            ? {}
            : {
                genres:
                  editing?.catalogId && kind !== 'game'
                    ? editing.genres
                    : (typeof genreInput === 'string' ? genreInput : '')
                        .split(',')
                        .map((value) => value.trim())
                        .filter(Boolean),
              }),
          ...(selectedTitle ? { catalogId: selectedTitle.catalogId } : {}),
        },
      );
      setItems((current) => [
        result.item,
        ...current.filter((item) => item.id !== result.item.id),
      ]);
      if (!editing) {
        setCategory('all');
        setView('all');
        setSearch('');
      }
      setOpen(false);
      if (kind === 'series') setReload((value) => value + 1);
      if (
        editing &&
        editing.status !== 'completed' &&
        result.item.status === 'completed'
      )
        returnHome();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else
        setFormError(
          reason instanceof Error
            ? reason.message
            : t('Não foi possível salvar.'),
        );
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!editing || saving) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await libraryRequest('DELETE', editing.id);
      setItems((current) => current.filter((item) => item.id !== editing.id));
      setOpen(false);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else
        setFormError(
          reason instanceof Error
            ? reason.message
            : t('Não foi possível remover.'),
        );
    } finally {
      setSaving(false);
    }
  }
  const editor = (
    <>
      {editing && (
        <div className="edit-title-summary">
          {editing.coverUrl && <img src={editing.coverUrl} alt="" />}
          <div>
            <strong>{editing.title}</strong>
            <OriginalTitle
              title={editing.title}
              originalTitle={editing.originalTitle}
            />
            <small>
              {categories[editing.kind]}
              {editing.year ? ` · ${editing.year}` : ''}
            </small>
            <Button
              type="button"
              variant="link"
              disabled={saving}
              onClick={() => {
                setOpen(false);
                setDetailId(editing.id);
              }}
            >
              {t('Abrir detalhes completos')}
            </Button>
          </div>
        </div>
      )}
      {!editing && (
        <Button
          type="button"
          variant="link"
          onClick={() => {
            setSelectedTitle(null);
            setCatalogMode(true);
          }}
        >
          {t(' ← Buscar no catálogo ')}
        </Button>
      )}
      {selectedTitle && (
        <div className="selected-catalog-title">
          {selectedTitle.coverUrl && (
            <img
              src={selectedTitle.coverUrl}
              alt=""
              referrerPolicy="no-referrer"
            />
          )}
          <div>
            <strong>{selectedTitle.title}</strong>
            <OriginalTitle
              title={selectedTitle.title}
              originalTitle={selectedTitle.originalTitle}
            />
            <small>{selectedTitle.year}</small>
            <p>{selectedTitle.overview}</p>
          </div>
        </div>
      )}
      <form
        onSubmit={save}
        key={editing?.id || selectedTitle?.catalogId || 'new'}
        className="item-form title-editor-form"
      >
        <details
          className="editor-metadata"
          open={kind === 'game' || !editing?.catalogId}
        >
          <summary>{t('Dados do título')}</summary>
          <div className="editor-section-fields">
            <label htmlFor="item-title">{t(' Título ')}</label>
            <Input
              id="item-title"
              name="title"
              defaultValue={editing?.title || selectedTitle?.title}
              readOnly={Boolean(selectedTitle || editing?.catalogId)}
              placeholder={t('Como se chama?')}
              required
              maxLength={200}
            />
            <div className="item-form-columns">
              <div>
                <label htmlFor="item-kind">{t(' Categoria ')}</label>
                <NativeSelect
                  id="item-kind"
                  value={kind}
                  disabled={Boolean(selectedTitle || editing?.catalogId)}
                  onChange={(event) => setKind(event.target.value as Kind)}
                >
                  {(Object.keys(categories) as Kind[]).map((key) => (
                    <option key={key} value={key}>
                      {categories[key]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <label htmlFor="item-genres">
              {t(' Gêneros ')}
              <span>{t(' (opcional) ')}</span>
            </label>
            <Input
              id="item-genres"
              name="genres"
              defaultValue={(editing?.genres || selectedTitle?.genres || [])
                .map(genreLabel)
                .join(', ')}
              placeholder={t(
                kind === 'game'
                  ? 'Ex.: luta, aventura, RPG'
                  : 'Ex.: fantasia, aventura',
              )}
              maxLength={480}
              readOnly={
                kind !== 'game' && Boolean(selectedTitle || editing?.catalogId)
              }
            />
            <small className="genre-hint">
              {t(
                ' Separe por vírgulas, até 8 gêneros. Usamos esses gêneros nas sugestões do Explorar. ',
              )}
            </small>
          </div>
        </details>
        <section className="editor-tracking">
          <h3>{t('Seu acompanhamento')}</h3>
          {kind === 'game' && (
            <div className="editor-section-fields">
              <label htmlFor="item-platform">
                {t('Plataforma em que você joga')}
              </label>
              <Input
                id="item-platform"
                name="platform"
                list="game-platforms"
                maxLength={60}
                defaultValue={editing?.platform || ''}
                placeholder={t('Selecione ou digite a plataforma')}
              />
              <datalist id="game-platforms">
                {[
                  'PC',
                  'PS5',
                  'PS4',
                  'PS3',
                  'PS2',
                  'PS1',
                  'PSP',
                  'PS Vita',
                  'Xbox Series X/S',
                  'Xbox One',
                  'Xbox 360',
                  'Xbox',
                  'Nintendo Switch 2',
                  'Nintendo Switch',
                  'Wii U',
                  'Wii',
                  'GameCube',
                  'Nintendo 64',
                  'SNES',
                  'NES',
                  'Nintendo 3DS',
                  'Nintendo DS',
                  'Game Boy Advance',
                  'Game Boy',
                  'Mega Drive',
                  'Dreamcast',
                  'Android',
                  'iOS',
                ].map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </datalist>
              <label htmlFor="game-playtime">{t('Horas jogadas')}</label>
              <Input
                id="game-playtime"
                name="playtimeHours"
                type="number"
                min="0"
                max="100000"
                step="any"
                // Três casas preservam os minutos salvos ao reabrir e salvar o formulário.
                defaultValue={Number(
                  ((editing?.playtimeMinutes || 0) / 60).toFixed(3),
                )}
              />
              <small>
                {t(
                  'Informe o total acumulado. O tempo é mantido ao mudar o status do jogo.',
                )}
              </small>
            </div>
          )}
          <CompletionFields
            item={editing}
            kind={kind}
            initialStatus={
              editing?.status ||
              (view === 'all' ||
              view === 'explore' ||
              view === 'add' ||
              view === 'stats' ||
              view === 'acervo' ||
              view === 'incoming' ||
              view === 'coming-soon' ||
              view === 'friends' ||
              view === 'archived' ||
              view === 'account' ||
              view === 'achievements'
                ? 'planned'
                : view)
            }
          />
        </section>
        <section className="editor-notes">
          <label htmlFor="item-notes">
            {t(' Anotações privadas ')}
            <span>{t(' (opcional) ')}</span>
          </label>
          <textarea
            id="item-notes"
            name="notes"
            maxLength={1000}
            defaultValue={editing?.notes}
            placeholder={t('Uma indicação, onde parou ou o que achou…')}
            rows={3}
          />
        </section>
        <output aria-live="polite" className="home-error">
          {formError}
        </output>
        <div className="item-form-actions">
          {editing && (
            <IconAction
              icon={confirmDelete ? CircleAlert : Trash2}
              label={confirmDelete ? t('Confirmar remoção') : t('Remover')}
              type="button"
              variant="ghost"
              className="remove-item"
              onClick={() => void remove()}
              disabled={saving}
            />
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (editing) setOpen(false);
              else setCatalogMode(true);
            }}
            disabled={saving}
          >
            {t(' Cancelar ')}
          </Button>
          <Button type="submit" className="home-primary" disabled={saving}>
            {saving ? t('Salvando…') : t('Salvar título')}
          </Button>
        </div>
      </form>
    </>
  );
  const libraryNavigation = (afterNavigate?: () => void) => (
    <nav className="library-navigation" aria-label={t('Biblioteca')}>
      {views.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={view === id ? 'selected' : ''}
          aria-current={view === id ? 'page' : undefined}
          onClick={() => {
            afterNavigate?.();
            setDetailId(null);
            setHistoryMode(false);
            setView(id);
          }}
        >
          <Icon aria-hidden="true" />
          {label}
          <span>{items.filter((item) => matchesView(item, id)).length}</span>
        </button>
      ))}
      <button
        className={view === 'acervo' ? 'selected' : ''}
        aria-current={view === 'acervo' ? 'page' : undefined}
        onClick={() => {
          afterNavigate?.();
          setDetailId(null);
          setView('acervo');
        }}
      >
        <Library aria-hidden="true" />
        {t('Minha Coleção')}
      </button>
      <button
        className={view === 'achievements' ? 'selected' : ''}
        aria-current={view === 'achievements' ? 'page' : undefined}
        onClick={() => {
          afterNavigate?.();
          setDetailId(null);
          setHistoryMode(false);
          setView('achievements');
        }}
      >
        <Trophy aria-hidden="true" />
        {t('Conquistas')}
      </button>
      <button
        className={view === 'incoming' ? 'selected' : ''}
        aria-current={view === 'incoming' ? 'page' : undefined}
        onClick={() => {
          afterNavigate?.();
          setDetailId(null);
          setView('incoming');
        }}
      >
        <CalendarDays aria-hidden="true" />
        {t('Próximas estreias')}
      </button>
      <button
        className={view === 'explore' ? 'selected' : ''}
        aria-current={view === 'explore' ? 'page' : undefined}
        onClick={() => {
          afterNavigate?.();
          setDetailId(null);
          setView('explore');
        }}
      >
        <Compass aria-hidden="true" />
        {t(' Explorar ')}
      </button>
      <button
        className={view === 'stats' ? 'selected' : ''}
        aria-current={view === 'stats' ? 'page' : undefined}
        onClick={() => {
          afterNavigate?.();
          setDetailId(null);
          setView('stats');
        }}
      >
        <ChartNoAxesCombined aria-hidden="true" />
        {t(' Estatísticas ')}
      </button>
      <button
        aria-current={view === 'friends' ? 'page' : undefined}
        className={view === 'friends' ? 'selected' : ''}
        onClick={() => {
          afterNavigate?.();
          setDetailId(null);
          setView('friends');
        }}
      >
        <Users aria-hidden="true" />
        {t('Amigos')}
      </button>
    </nav>
  );
  return (
    <div className="home-shell">
      <aside className="home-sidebar">
        <div className="brand">
          <img src="/nextplay-symbol.svg" width={36} height={36} alt="" />
          <span>NextPlay</span>
        </div>
        <p className="nav-caption">{t(' SEU UNIVERSO ')}</p>
        {libraryNavigation()}
        <div className="sidebar-note">
          <Bookmark aria-hidden="true" />
          <p>
            {t(' Boas histórias merecem ')}
            <br />
            {t(' um lugar na sua vida. ')}
          </p>
        </div>
      </aside>
      <MobileNavigation
        view={view}
        navigate={(destination) => {
          setDetailId(null);
          setHistoryMode(false);
          if (destination === 'add') edit(null);
          else setView(destination);
        }}
      >
        {libraryNavigation}
      </MobileNavigation>
      <main className="home-main" ref={pageRef}>
        <header className="home-topbar">
          <span>
            {t(' Minha biblioteca ')}
            <span className="breadcrumb-dot">/</span>{' '}
            {detailItem
              ? detailItem.title
              : view === 'acervo'
                ? t('Minha Coleção')
                : view === 'incoming'
                  ? t('Próximas estreias')
                  : view === 'achievements'
                    ? t('Conquistas')
                    : view === 'account'
                      ? t(' Minha conta ')
                      : view === 'friends'
                        ? t('Amigos')
                        : view === 'stats'
                          ? t('Suas estatísticas')
                          : view === 'add'
                            ? t('Adicionar título')
                            : view === 'explore'
                              ? t('Explorar')
                              : views.find((item) => item.id === view)?.label}
          </span>
          <div className="home-topbar-actions">
            <ThemePicker compact account />
            <div className="home-account">
              <button
                className="account-link"
                onClick={() => {
                  setDetailId(null);
                  setView('account');
                }}
                aria-label={t(' Minha conta ')}
                aria-current={view === 'account' ? 'page' : undefined}
              >
                <span className="avatar" aria-hidden="true">
                  {user.avatar ? (
                    <img src={user.avatar} alt="" />
                  ) : (
                    (user.displayName || user.email).charAt(0).toUpperCase()
                  )}
                </span>
                <span className="account-label">
                  <strong>{t(' Minha conta ')}</strong>
                  <small>{user.displayName || user.email}</small>
                  <AchievementTitle />
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('Sair da conta')}
                disabled={busy}
                onClick={() => void logout()}
              >
                <LogOut aria-hidden="true" />
              </Button>
            </div>
          </div>
        </header>
        <div className="home-content">
          <PageBoundary key={detailId ? 'details' : view}>
            {view === 'all' && !detailItem && (
              <RecentWatched
                items={items}
                open={setDetailId}
                more={() => {
                  setHistoryMode(true);
                  setCategory('all');
                  setSearch('');
                  setView('completed');
                }}
              />
            )}
            {!detailItem &&
              view !== 'account' &&
              view !== 'achievements' &&
              view !== 'acervo' &&
              view !== 'incoming' &&
              view !== 'friends' && (
                <section className="home-heading">
                  <div>
                    <span className="home-kicker">
                      {t(' TUDO O QUE VOCÊ CURTE, AQUI. ')}
                    </span>
                    <h1>
                      {view === 'stats'
                        ? t('Suas estatísticas')
                        : view === 'add'
                          ? t('Adicione suas próximas histórias')
                          : view === 'explore'
                            ? t('Encontre sua próxima história')
                            : view === 'all'
                              ? t('Qual é a próxima história?')
                              : views.find((item) => item.id === view)?.label}
                    </h1>
                    <p>
                      {view === 'explore'
                        ? t(
                            'Sugestões da nossa coleção de títulos, inspiradas no que você curte.',
                          )
                        : t('Para assistir, jogar ou ler. No seu tempo.')}
                    </p>
                  </div>
                  <Button
                    className="home-primary"
                    onClick={() =>
                      view === 'add' ? setView('all') : edit(null)
                    }
                    disabled={loading || Boolean(error)}
                  >
                    {view === 'add' ? (
                      t('← Meu acompanhamento')
                    ) : (
                      <>
                        <Plus aria-hidden="true" /> {t(' Adicionar título ')}
                      </>
                    )}
                  </Button>
                </section>
              )}
            {view === 'achievements' ? (
              <Achievements />
            ) : view === 'acervo' ? (
              <Collector
                onExpired={onExpired}
                readingItems={items}
                readingDisabled={loading || Boolean(error)}
                onReadingChanged={(item) => {
                  // O atalho atualiza a biblioteca sem tirar a pessoa da coleção de exemplares.
                  setItems((current) => [
                    item,
                    ...current.filter((entry) => entry.id !== item.id),
                  ]);
                }}
              />
            ) : view === 'account' ? (
              <Account
                user={user}
                onSaved={onUserChanged}
                onExpired={onExpired}
              />
            ) : view === 'friends' ? (
              <Friends
                onExpired={onExpired}
                onNameChanged={(displayName) =>
                  onUserChanged({ ...user, displayName })
                }
              />
            ) : detailItem ? (
              <TitleDetails
                item={detailItem}
                back={() => setDetailId(null)}
                edit={edit}
                changed={updateItem}
                onProgress={() => setReload((value) => value + 1)}
                onWatched={returnHome}
                onExpired={onExpired}
                removed={(id) => {
                  setItems((current) =>
                    current.filter((item) => item.id !== id),
                  );
                  setDetailId(null);
                }}
              />
            ) : view === 'incoming' ? (
              <Incoming
                items={items}
                open={setDetailId}
                onExpired={onExpired}
              />
            ) : view === 'stats' ? (
              <Stats items={items} onExpired={onExpired} />
            ) : view === 'add' ? (
              <section
                className="add-title-page"
                aria-label={t('Adicionar títulos')}
              >
                {catalogMode || editing ? (
                  <CatalogSearch
                    key={kind}
                    initialKind={kind}
                    onKindChange={setKind}
                    choose={(title) => {
                      setEditing(null);
                      setSelectedTitle(title);
                      setKind(title.kind);
                      setCatalogMode(false);
                    }}
                    onExpired={onExpired}
                    items={items}
                    changed={updateItem}
                    edit={edit}
                    manual={(initialKind) => {
                      if (initialKind) setKind(initialKind);
                      setEditing(null);
                      setSelectedTitle(null);
                      setCatalogMode(false);
                    }}
                  />
                ) : (
                  <div className="manual-title-page">
                    <h2>
                      {t(
                        selectedTitle
                          ? 'Seu acompanhamento'
                          : ' Cadastro manual ',
                      )}
                    </h2>
                    {editor}
                  </div>
                )}
              </section>
            ) : view === 'explore' ? (
              <Explore
                onExpired={onExpired}
                items={items}
                changed={(item) => updateItem(item, true)}
                edit={edit}
              />
            ) : (
              <Tabs
                value={category}
                onValueChange={(value) => setCategory(value as 'all' | Kind)}
                className="collection-tabs"
              >
                <div className="collection-tabs-scroll">
                  <TabsList
                    aria-label={t('Tipo de título na coleção')}
                    variant="line"
                  >
                    {(['all', 'movie', 'series', 'game', 'book'] as const).map(
                      (key) => {
                        const Icon = key === 'all' ? Library : icons[key];
                        const count = items.filter(
                          (item) =>
                            (key === 'all' || item.kind === key) &&
                            matchesCollection(item, view),
                        ).length;
                        return (
                          <TabsTrigger key={key} value={key}>
                            <Icon aria-hidden="true" />
                            {key === 'all' ? t('Todos') : categories[key]}
                            <span className="tab-count">{count}</span>
                          </TabsTrigger>
                        );
                      },
                    )}
                  </TabsList>
                </div>
                <TabsContent value={category}>
                  <section
                    className="collection-section"
                    aria-labelledby="collection-title"
                  >
                    {view === 'completed' && (
                      <div className="history-mode">
                        <Button
                          variant={historyMode ? 'default' : 'outline'}
                          onClick={() => {
                            setHistoryMode(true);
                            if (category === 'game' || category === 'book')
                              setCategory('all');
                          }}
                        >
                          {t('Últimos assistidos')}
                        </Button>
                        <Button
                          variant={!historyMode ? 'default' : 'outline'}
                          onClick={() => setHistoryMode(false)}
                        >
                          {t('Títulos concluídos')}
                        </Button>
                      </div>
                    )}
                    {view === 'all' && (
                      <div className="collection-density">
                        <label htmlFor="collection-density">
                          {t(' Exibição ')}
                        </label>
                        <NativeSelect
                          id="collection-density"
                          value={density}
                          disabled={savingDensity}
                          onChange={(event) =>
                            changeDensity(event.target.value)
                          }
                        >
                          <option value="compact">{t(' Enxuto ')}</option>
                          <option value="details">
                            {t(' Mais informações ')}
                          </option>
                        </NativeSelect>
                      </div>
                    )}
                    <div className="collection-toolbar">
                      <div>
                        <h2 id="collection-title">
                          {category === 'all'
                            ? t(
                                view === 'completed' && historyMode
                                  ? 'Últimos assistidos'
                                  : view === 'coming-soon'
                                    ? 'Em breve'
                                    : 'Seu acompanhamento',
                              )
                            : categories[category]}
                          <span>{visible.length}</span>
                        </h2>
                      </div>
                      <div className="collection-search">
                        <Search aria-hidden="true" />
                        <Input
                          aria-label={t('Buscar na sua coleção')}
                          placeholder={t('Buscar título ou produtora…')}
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                        />
                      </div>
                    </div>
                    {(notice || error) && (
                      <div className="home-error" role="alert">
                        {notice || error}
                        {error && (
                          <>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setLoading(true);
                                setReload(reload + 1);
                              }}
                            >
                              {t(' Tentar novamente ')}
                            </Button>
                            <Button variant="link" onClick={onExpired}>
                              {t(' Voltar ao login ')}
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                    {loading ? (
                      <PageLoading label={t('Carregando sua coleção…')} />
                    ) : error && !items.length ? null : visible.length ? (
                      <div
                        className={`item-grid${compactCards ? ' compact-cards' : ''}`}
                      >
                        {visible.map((item) => {
                          const Icon = icons[item.kind];
                          const minimalCover = compactCards;
                          return (
                            <article
                              key={item.id}
                              aria-label={item.title}
                              title={minimalCover ? item.title : undefined}
                              className={`library-card ${item.kind}`}
                            >
                              <div
                                className={`item-cover ${item.coverUrl ? 'has-poster' : ''}`}
                              >
                                <ReleaseBadge item={item} />
                                <Icon aria-hidden="true" />
                                {item.coverUrl && (
                                  <img
                                    className="library-poster"
                                    src={item.coverUrl}
                                    alt={t('Capa de {0}', item.title)}
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                    onError={(event) => {
                                      event.currentTarget.style.display =
                                        'none';
                                    }}
                                  />
                                )}
                                <span>{categories[item.kind]}</span>
                                <div
                                  className="collection-kind-badge"
                                  title={categories[item.kind]}
                                >
                                  <Icon aria-hidden="true" />
                                  <span className="sr-only">
                                    {categories[item.kind]}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className="open-title-details"
                                  aria-label={t(
                                    'Ver detalhes de {0}',
                                    item.title,
                                  )}
                                  onClick={() => setDetailId(item.id)}
                                />
                                <Button
                                  className="edit-item"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={t('Editar {0}', item.title)}
                                  onClick={() => edit(item)}
                                >
                                  <Pencil aria-hidden="true" />
                                </Button>
                                <QuickActions
                                  iconOnly
                                  owned={item}
                                  changed={updateItem}
                                  edit={edit}
                                  onExpired={onExpired}
                                />
                                {/* Sem páginas registradas, mostramos um selo de estado,
                                    nunca uma barra que possa sugerir leitura concluída. */}
                                {item.kind === 'book' &&
                                  item.status === 'active' && (
                                    <div className="book-reading-marker">
                                      <strong>
                                        <BookOpen aria-hidden="true" />
                                        {statusNames.book.active}
                                      </strong>
                                    </div>
                                  )}
                                {item.kind === 'series' &&
                                  item.episodeProgress?.initialized &&
                                  item.episodeProgress.total > 0 && (
                                    <div className="series-cover-progress">
                                      <div className="series-cover-progress-label">
                                        <strong>
                                          {Math.min(
                                            100,
                                            Math.round(
                                              (item.episodeProgress.watched /
                                                item.episodeProgress.total) *
                                                100,
                                            ),
                                          )}
                                          {t(' % assistido ')}
                                        </strong>
                                        <small>
                                          {Math.max(
                                            0,
                                            item.episodeProgress.total -
                                              item.episodeProgress.watched,
                                          )}{' '}
                                          {t(' episódios restantes ')}
                                        </small>
                                      </div>
                                      <progress
                                        value={Math.min(
                                          item.episodeProgress.watched,
                                          item.episodeProgress.total,
                                        )}
                                        max={item.episodeProgress.total}
                                        aria-label={t(
                                          'Progresso de {0}',
                                          item.title,
                                        )}
                                        aria-valuetext={t(
                                          '{0} de {1} episódios assistidos',
                                          item.episodeProgress.watched,
                                          item.episodeProgress.total,
                                        )}
                                      />
                                    </div>
                                  )}
                              </div>
                              <div
                                className={`item-info ${minimalCover && item.coverUrl ? 'cover-only-info' : ''}`}
                              >
                                <div
                                  className={
                                    minimalCover && item.coverUrl
                                      ? 'sr-only'
                                      : undefined
                                  }
                                >
                                  <span
                                    className={`item-status ${item.status}`}
                                  >
                                    <span />
                                    {item.kind === 'series' &&
                                    item.caughtUp &&
                                    item.status !== 'completed'
                                      ? t('Em dia')
                                      : statusNames[item.kind][item.status]}
                                  </span>
                                  <h3>{item.title}</h3>
                                  {view === 'completed' && historyMode && (
                                    <WatchedWhen item={item} />
                                  )}
                                  <OriginalTitle
                                    title={item.title}
                                    originalTitle={item.originalTitle}
                                  />
                                </div>
                                {item.kind === 'series' && (
                                  <SeriesResume
                                    item={item}
                                    compact={compactCards}
                                    edit={edit}
                                    onProgress={() =>
                                      setReload((value) => value + 1)
                                    }
                                    onExpired={onExpired}
                                  />
                                )}
                                {!compactCards && item.completedOn && (
                                  <small className="completion-summary">
                                    {item.kind === 'movie'
                                      ? t('Assistido')
                                      : t(
                                          item.kind === 'book'
                                            ? 'Lido'
                                            : 'Concluído',
                                        )}{' '}
                                    {t(' em ')} {dateLabel(item.completedOn)}
                                    {item.stars ? ` · ${item.stars} ★` : ''}
                                  </small>
                                )}
                                {!compactCards && item.year && (
                                  <small className="catalog-year">
                                    {item.year}
                                  </small>
                                )}
                                {!compactCards && item.sourceUrl && (
                                  <a
                                    className="catalog-source"
                                    href={item.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {item.kind === 'book'
                                      ? 'Google Books'
                                      : item.catalogId?.startsWith('tmdb:')
                                        ? 'TMDB'
                                        : 'IGDB'}{' '}
                                    ↗
                                  </a>
                                )}
                                {!compactCards && item.notes && (
                                  <p>{item.notes}</p>
                                )}
                                {!compactCards && (
                                  <QuickActions
                                    compact={compactCards}
                                    owned={item}
                                    changed={updateItem}
                                    edit={edit}
                                    onExpired={onExpired}
                                  />
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="collection-empty">
                        <span className="empty-icon">
                          <Library aria-hidden="true" />
                        </span>
                        <h3>
                          {items.length
                            ? t('Nenhum título por aqui.')
                            : t('Toda coleção começa com uma história.')}
                        </h3>
                        <p>
                          {items.length
                            ? t(
                                'Experimente outra busca ou adicione um título a esta seleção.',
                              )
                            : t(
                                'Salve aquele filme, a série da vez, seu próximo jogo ou livro.',
                              )}
                        </p>
                        <Button
                          className="home-primary"
                          onClick={() => edit(null)}
                        >
                          <Plus aria-hidden="true" />
                          {items.length
                            ? t('Adicionar título')
                            : t('Adicionar meu primeiro título')}
                        </Button>
                        <div className="empty-types">
                          <Film />
                          <Tv />
                          <Gamepad2 />
                        </div>
                      </div>
                    )}
                  </section>
                </TabsContent>
              </Tabs>
            )}
          </PageBoundary>
          <footer className="home-footer">
            {t(' Sua coleção. Seu ritmo. ')}
            <span>NextPlay</span>
            <small className="development-credit">
              {t('Desenvolvido por {0}', 'IMJ Sistemas e Tecnologia Ltda')}
            </small>
          </footer>
          <details className="catalog-credits">
            <summary>{t(' Créditos dos catálogos ')}</summary>
            <a
              href="https://www.themoviedb.org"
              target="_blank"
              rel="noreferrer"
            >
              <img
                src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
                alt="TMDB"
                width={82}
              />
            </a>
            <p>
              This product uses the TMDB API but is not endorsed or certified by
              TMDB.
            </p>
            <p>
              {t(' Dados de jogos fornecidos por ')}{' '}
              <a href="https://www.igdb.com" target="_blank" rel="noreferrer">
                IGDB
              </a>
              .
            </p>
          </details>
        </div>
      </main>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!saving) setOpen(value);
        }}
      >
        <DialogContent
          className="item-dialog title-edit-dialog"
          showCloseButton={false}
        >
          <DialogTitle>
            {editing
              ? t('Atualizar título')
              : t('Uma nova história na coleção')}
          </DialogTitle>
          <DialogDescription>
            {t('Ajuste o acompanhamento, sua avaliação e suas anotações.')}
          </DialogDescription>
          {editor}
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default function HomeWithReviews(props: Parameters<typeof Home>[0]) {
  return (
    <AchievementProvider key={props.user.id} onExpired={props.onExpired}>
      <ReviewProvider>
        <Home {...props} />
      </ReviewProvider>
    </AchievementProvider>
  );
}
