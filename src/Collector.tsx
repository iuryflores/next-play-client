import { useEffect, useEffectEvent, useState, type SubmitEvent } from 'react';
import {
  BookOpen,
  ChevronDown,
  Package,
  Eye,
  Copy,
  Film,
  Gamepad2,
  Library,
  Pencil,
  Plus,
  Trash2,
  Tv,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import CatalogSearch, { type CatalogTitle } from './CatalogSearch';
import { ApiError } from './auth';
import {
  collectorRequest,
  type CopyInput,
  type CollectorKind,
  type OwnedCopy,
} from './collector-client';
import { categories, type Kind, type LibraryItem } from './library';
import CollectorBookReading from './CollectorBookReading';
import CollectorBookDetails from './CollectorBookDetails';
import { t } from './i18n';
import { notifySaved } from './notifications';
import PageLoading from './PageLoading';
import { prepareCollectorPhoto } from './collector-photo';
import './collector.css';

const icons = {
  movie: Film,
  series: Tv,
  game: Gamepad2,
  book: BookOpen,
  other: Package,
};
const collectorCategories = { ...categories, other: t('Outros') };
const emptyCopy = (): CopyInput => ({
  title: '',
  kind: 'movie',
  format: 'physical',
  platform: '',
  edition: '',
  notes: '',
});
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();

export default function Collector({
  onExpired,
  readingItems,
  readingDisabled,
  onReadingChanged,
}: {
  onExpired: () => void;
  readingItems: LibraryItem[];
  readingDisabled: boolean;
  onReadingChanged: (item: LibraryItem) => void;
}) {
  const [copies, setCopies] = useState<OwnedCopy[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickerKind, setPickerKind] = useState<Kind>('movie');
  const [form, setForm] = useState<CopyInput | null>(null);
  const [bookDetails, setBookDetails] = useState<{
    authors?: string[];
    isbn?: string;
    publisher?: string;
  } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<OwnedCopy | null>(null);
  const [details, setDetails] = useState<OwnedCopy | null>(null);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<CollectorKind | 'all'>('all');
  const [format, setFormat] = useState('all');
  const [objectCategory, setObjectCategory] = useState('all');
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const objectCategories = [
    ...new Map(
      copies
        .filter((copy) => copy.kind === 'other' && copy.category)
        .map((copy) => [normalize(copy.category!), copy.category!]),
    ).entries(),
  ];
  const expired = useEffectEvent(onExpired);
  const physical = copies.filter((copy) => copy.format === 'physical').length;
  const digital = copies.length - physical;
  useEffect(() => {
    const controller = new AbortController();
    void collectorRequest<{ copies: OwnedCopy[] }>(
      'GET',
      '',
      undefined,
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setCopies(data.copies);
          setError('');
        }
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        if (reason instanceof ApiError && reason.status === 401) expired();
        else setError(t('Não foi possível acessar sua coleção.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  const visible = copies.filter(
    (copy) =>
      (kind === 'all' || copy.kind === kind) &&
      (format === 'all' || copy.format === format) &&
      (kind !== 'other' ||
        objectCategory === 'all' ||
        normalize(copy.category || '') === objectCategory) &&
      normalize(
        [copy.title, copy.platform, copy.edition, copy.category].join(' '),
      ).includes(normalize(search)),
  );
  function openForm(
    copy?: OwnedCopy,
    duplicate = false,
    initialKind?: CollectorKind,
  ) {
    setPhotoPreview(copy && !duplicate ? copy.coverUrl || '' : '');
    setBookDetails(copy?.kind === 'book' ? copy : null);
    setEditing(copy && !duplicate ? copy.id : null);
    // Copiar aqui cria um novo exemplar, sem reutilizar seu ID nem copiar status de consumo.
    setForm(
      copy
        ? {
            title: copy.title,
            kind: copy.kind,
            format: copy.format,
            platform: copy.platform,
            edition: copy.edition,
            notes: copy.notes,
            ...(copy.kind === 'other' ? { category: copy.category || '' } : {}),
            ...(copy.catalogId ? { catalogId: copy.catalogId } : {}),
          }
        : {
            ...emptyCopy(),
            kind: initialKind ?? (kind === 'all' ? 'movie' : kind),
          },
    );
    setFormError('');
    setPicking(false);
  }
  function choose(title: CatalogTitle) {
    // A prévia ajuda a confirmar a edição; os metadados são validados no servidor ao salvar.
    setBookDetails(title.kind === 'book' ? title : null);
    setEditing(null);
    setForm({
      ...emptyCopy(),
      title: title.title,
      kind: title.kind,
      catalogId: title.catalogId,
    });
    setFormError('');
    setPicking(false);
  }
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || saving || photoBusy) return;
    setSaving(true);
    setFormError('');
    try {
      const { copy } = await collectorRequest<{ copy: OwnedCopy }>(
        editing ? 'PATCH' : 'POST',
        editing || '',
        form,
      );
      setCopies((current) => [
        copy,
        ...current.filter((item) => item.id !== copy.id),
      ]);
      setForm(null);
      if (copy.kind === 'other') {
        // O objeto recém-salvo fica visível mesmo se havia busca ou categoria filtrada.
        setKind('other');
        setObjectCategory('all');
        setSearch('');
        setFormat('all');
      }
      notifySaved(t('Cópia salva na coleção.'));
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else
        setFormError(
          reason instanceof ApiError
            ? reason.message
            : t('Não foi possível salvar a cópia.'),
        );
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!removing || saving) return;
    setSaving(true);
    setFormError('');
    try {
      await collectorRequest('DELETE', removing.id);
      setCopies((current) => current.filter((copy) => copy.id !== removing.id));
      setRemoving(null);
      notifySaved(t('Cópia removida da coleção.'));
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else
        setFormError(
          reason instanceof ApiError
            ? reason.message
            : t('Não foi possível remover a cópia.'),
        );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="collector-page" aria-labelledby="collector-heading">
      <header className="collector-heading">
        <div>
          <span className="home-kicker">{t('MODO COLECIONADOR')}</span>
          <h1 id="collector-heading">{t('Minha Coleção')}</h1>
          <p>
            {t('As obras e os objetos que você coleciona, em um só lugar.')}
          </p>
        </div>
        {/* O catálogo aberto já possui suas ações; não repetimos atalhos de inclusão no cabeçalho. */}
        {!picking && (
          <div className="collector-entry-actions">
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={loading || saving}
                render={<Button className="home-primary" />}
              >
                <Plus aria-hidden="true" />
                {t('Adicionar item')}
                <ChevronDown aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="collector-add-menu" align="end">
                {(Object.keys(collectorCategories) as CollectorKind[]).map(
                  (itemKind) => {
                    const Icon = icons[itemKind];
                    return (
                      <DropdownMenuItem
                        key={itemKind}
                        onClick={() => {
                          // Uma entrada reúne todos os tipos; objetos são manuais e obras mantêm seu catálogo.
                          if (itemKind === 'other')
                            openForm(undefined, false, 'other');
                          else {
                            setPickerKind(itemKind);
                            setPicking(true);
                            setFormError('');
                          }
                        }}
                      >
                        <Icon aria-hidden="true" />
                        {collectorCategories[itemKind]}
                      </DropdownMenuItem>
                    );
                  },
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </header>
      <p className="collector-scope">
        <Library aria-hidden="true" />
        {t(
          'Seu acompanhamento e suas avaliações continuam separados da sua coleção.',
        )}
      </p>
      {picking ? (
        <div className="add-title-page">
          <Button variant="ghost" onClick={() => setPicking(false)}>
            {t('Voltar à minha coleção')}
          </Button>
          <Button
            variant="outline"
            onClick={() => openForm(undefined, false, pickerKind)}
          >
            {t('Cadastrar manualmente')}
          </Button>
          <CatalogSearch
            key={pickerKind}
            initialKind={pickerKind}
            onKindChange={setPickerKind}
            items={[]}
            onExpired={onExpired}
            changed={() => {}}
            edit={() => {}}
            select={choose}
            manual={(initialKind) => openForm(undefined, false, initialKind)}
          />
        </div>
      ) : (
        <>
          <div className="collector-totals" aria-live="polite">
            <span>
              {t(
                copies.length === 1
                  ? '{0} cópia na coleção'
                  : '{0} cópias na coleção',
                copies.length,
              )}
            </span>
            <span>
              {t(physical === 1 ? '{0} física' : '{0} físicas', physical)}
            </span>
            <span>
              {t(digital === 1 ? '{0} digital' : '{0} digitais', digital)}
            </span>
          </div>
          <Tabs
            value={kind}
            onValueChange={(value) => {
              setKind(value as CollectorKind | 'all');
              if (value === 'other') setFormat('all');
            }}
            className="collection-tabs"
          >
            <div className="collection-tabs-scroll">
              <TabsList
                aria-label={t('Tipo de título na coleção')}
                variant="line"
              >
                {(
                  ['all', 'movie', 'series', 'game', 'book', 'other'] as const
                ).map((category) => {
                  const Icon = category === 'all' ? Library : icons[category];
                  // As contagens representam exemplares possuídos, incluindo cópias e edições repetidas.
                  const count = copies.filter(
                    (copy) => category === 'all' || copy.kind === category,
                  ).length;
                  return (
                    <TabsTrigger key={category} value={category}>
                      <Icon aria-hidden="true" />
                      {category === 'all'
                        ? t('Todos')
                        : collectorCategories[category]}
                      <span className="tab-count">{count}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>
            <TabsContent value={kind}>
              <div className="collector-filters">
                <label>
                  {t('Buscar na coleção')}
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t('Título, plataforma ou edição')}
                  />
                </label>
                <label>
                  {t('Formato')}
                  <NativeSelect
                    aria-label={t('Formato')}
                    value={format}
                    onChange={(event) => setFormat(event.target.value)}
                  >
                    <option value="all">{t('Todos os formatos')}</option>
                    <option value="physical">{t('Físico')}</option>
                    <option value="digital">{t('Digital')}</option>
                  </NativeSelect>
                </label>
                {kind === 'other' && (
                  <label>
                    {t('Categoria do objeto')}
                    <NativeSelect
                      aria-label={t('Categoria do objeto')}
                      value={objectCategory}
                      onChange={(event) =>
                        setObjectCategory(event.target.value)
                      }
                    >
                      <option value="all">{t('Todas as categorias')}</option>
                      {objectCategories.map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                )}
              </div>
              {error && (
                <div className="home-error" role="alert">
                  {error}
                  <Button
                    variant="link"
                    onClick={() => {
                      setLoading(true);
                      setRevision((value) => value + 1);
                    }}
                  >
                    {t('Tentar novamente')}
                  </Button>
                </div>
              )}
              {loading ? (
                <PageLoading label={t('Carregando coleção…')} />
              ) : !visible.length ? (
                <div className="collection-empty">
                  <Library aria-hidden="true" />
                  <h2>
                    {t(
                      copies.length
                        ? 'Nenhuma cópia com esses filtros.'
                        : 'Sua coleção começa com a primeira cópia.',
                    )}
                  </h2>
                  <p>
                    {t(
                      'Você pode possuir várias edições e cópias da mesma obra.',
                    )}
                  </p>
                </div>
              ) : (
                <div className="collector-grid">
                  {visible.map((copy) => {
                    const Icon = icons[copy.kind];
                    return (
                      <article
                        className={`collector-card${copy.kind === 'book' ? ' collector-book-card' : copy.kind === 'other' ? ' collector-object-card' : ''}`}
                        key={copy.id}
                        aria-label={[
                          copy.title,
                          copy.edition?.trim(),
                          copy.platform?.trim(),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      >
                        <div className="collector-copy-heading">
                          <div className="collector-cover">
                            {copy.coverUrl ? (
                              <img
                                src={copy.coverUrl}
                                alt=""
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <Icon aria-hidden="true" />
                            )}
                          </div>
                          <div>
                            <small>
                              {copy.kind === 'other'
                                ? copy.category
                                : collectorCategories[copy.kind]}{' '}
                              ·{' '}
                              {t(
                                copy.format === 'physical'
                                  ? 'Físico'
                                  : 'Digital',
                              )}
                              {copy.kind === 'book' && copy.year
                                ? ` · ${copy.year}`
                                : ''}
                            </small>
                            <h2>{copy.title}</h2>
                            {copy.kind !== 'book' && copy.year && (
                              <small>{copy.year}</small>
                            )}
                            {copy.kind === 'book' && (
                              <>
                                {copy.authors?.length ? (
                                  <p>{copy.authors.join(' · ')}</p>
                                ) : null}
                                {copy.publisher && <p>{copy.publisher}</p>}
                                {copy.catalogId?.startsWith(
                                  'googlebooks:book:',
                                ) && (
                                  <a
                                    className="collector-book-source"
                                    href={`https://books.google.com/books?id=${encodeURIComponent(copy.catalogId.slice(17))}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {t('Ver no Google Books')}
                                  </a>
                                )}
                              </>
                            )}
                            {/* Campos opcionais não criam linhas vazias nem avisos repetidos no card. */}
                            {copy.edition?.trim() && <p>{copy.edition}</p>}
                            {copy.platform?.trim() && <p>{copy.platform}</p>}
                          </div>
                        </div>
                        {copy.notes && (
                          <p className="collector-notes">{copy.notes}</p>
                        )}
                        {copy.kind === 'book' && (
                          <CollectorBookReading
                            copy={copy}
                            items={readingItems}
                            disabled={readingDisabled}
                            changed={onReadingChanged}
                            onExpired={onExpired}
                          />
                        )}
                        <div className="collector-actions">
                          {copy.kind === 'book' && (
                            <Button
                              variant="outline"
                              size="icon"
                              title={t('Ver detalhes de {0}', copy.title)}
                              aria-label={t('Ver detalhes de {0}', copy.title)}
                              onClick={() => setDetails(copy)}
                            >
                              <Eye aria-hidden="true" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size={copy.kind === 'book' ? 'icon' : 'default'}
                            title={t('Editar cópia de {0}', copy.title)}
                            aria-label={t('Editar cópia de {0}', copy.title)}
                            onClick={() => openForm(copy)}
                          >
                            <Pencil aria-hidden="true" />
                            {copy.kind !== 'book' && t('Editar')}
                          </Button>
                          <Button
                            variant="outline"
                            size={copy.kind === 'book' ? 'icon' : 'default'}
                            title={t(
                              'Adicionar outra cópia de {0}',
                              copy.title,
                            )}
                            aria-label={t(
                              'Adicionar outra cópia de {0}',
                              copy.title,
                            )}
                            onClick={() => openForm(copy, true)}
                          >
                            <Copy aria-hidden="true" />
                            {copy.kind !== 'book' && t('Outra cópia')}
                          </Button>
                          <Button
                            variant={copy.kind === 'book' ? 'outline' : 'ghost'}
                            size={copy.kind === 'book' ? 'icon' : 'default'}
                            title={t('Remover cópia de {0}', copy.title)}
                            aria-label={t('Remover cópia de {0}', copy.title)}
                            onClick={() => {
                              setRemoving(copy);
                              setFormError('');
                            }}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
      <CollectorBookDetails
        copy={details}
        items={readingItems}
        close={() => setDetails(null)}
      />
      <Dialog
        open={form !== null}
        onOpenChange={(open) => {
          if (!open && !saving && !photoBusy) setForm(null);
        }}
      >
        <DialogContent
          className="collector-dialog"
          showCloseButton={!saving && !photoBusy}
        >
          <DialogTitle>
            {t(editing ? 'Editar cópia' : 'Adicionar item à coleção')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Cada exemplar é independente. Salvar aqui não altera seu acompanhamento.',
            )}
          </DialogDescription>
          {form && (
            <form onSubmit={(event) => void save(event)}>
              {form.kind === 'book' && bookDetails && (
                <p className="collector-hint">
                  {[
                    bookDetails.authors?.join(' · '),
                    bookDetails.publisher,
                    bookDetails.isbn && `ISBN: ${bookDetails.isbn}`,
                  ]
                    .filter(Boolean)
                    .join(' — ')}
                </p>
              )}
              <fieldset disabled={saving || photoBusy}>
                <label>
                  {t(form.kind === 'other' ? 'Nome' : 'Título')}
                  <Input
                    required
                    maxLength={200}
                    value={form.title}
                    readOnly={!!form.catalogId}
                    onChange={(event) =>
                      setForm({ ...form, title: event.target.value })
                    }
                  />
                </label>
                <div className="collector-form-pair">
                  <label>
                    {t('Tipo de item')}
                    <NativeSelect
                      aria-label={t('Tipo de item')}
                      value={form.kind}
                      disabled={!!form.catalogId}
                      onChange={(event) => {
                        const nextKind = event.target.value as CollectorKind;
                        setPhotoPreview('');
                        const {
                          photo: _photo,
                          category: _category,
                          ...rest
                        } = form;
                        setForm({
                          ...rest,
                          kind: nextKind,
                          ...(nextKind === 'other'
                            ? { format: 'physical', category: '', photo: '' }
                            : {}),
                        });
                      }}
                    >
                      {Object.entries(collectorCategories).map(
                        ([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ),
                      )}
                    </NativeSelect>
                  </label>
                  {form.kind !== 'other' && (
                    <label>
                      {t('Formato')}
                      <NativeSelect
                        aria-label={t('Formato')}
                        value={form.format}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            format: event.target.value as CopyInput['format'],
                          })
                        }
                      >
                        <option value="physical">{t('Físico')}</option>
                        <option value="digital">{t('Digital')}</option>
                      </NativeSelect>
                    </label>
                  )}
                </div>
                {form.kind === 'other' && (
                  <>
                    <label>
                      {t('Categoria do objeto')}
                      <Input
                        required
                        maxLength={60}
                        list="collector-object-categories"
                        placeholder={t('Ex.: Carrinhos, Action figures')}
                        value={form.category || ''}
                        onChange={(event) =>
                          setForm({ ...form, category: event.target.value })
                        }
                      />
                    </label>
                    <datalist id="collector-object-categories">
                      {objectCategories.map(([key, label]) => (
                        <option key={key} value={label}>
                          {label}
                        </option>
                      ))}
                    </datalist>
                    <label>
                      {t('Foto do objeto (opcional)')}
                      <Input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = '';
                          if (!file) return;
                          setPhotoBusy(true);
                          setFormError('');
                          void prepareCollectorPhoto(file)
                            .then((photo) => {
                              setPhotoPreview(photo);
                              setForm((current) =>
                                current ? { ...current, photo } : current,
                              );
                            })
                            .catch(() =>
                              setFormError(
                                t(
                                  'Não foi possível preparar a foto. Escolha JPG, PNG ou WebP de até 10 MB.',
                                ),
                              ),
                            )
                            .finally(() => setPhotoBusy(false));
                        }}
                      />
                    </label>
                    {photoBusy && <output>{t('Preparando foto…')}</output>}
                    {photoPreview && (
                      <div className="collector-photo-preview">
                        <img
                          src={photoPreview}
                          alt={t('Prévia da foto do objeto')}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setPhotoPreview('');
                            setForm({ ...form, photo: '' });
                          }}
                        >
                          {t('Remover foto')}
                        </Button>
                      </div>
                    )}
                  </>
                )}
                {form.kind !== 'other' && (
                  <>
                    <label>
                      {t('Plataforma ou suporte')}
                      <Input
                        maxLength={100}
                        placeholder={t('Ex.: PlayStation 5, Steam, Blu-ray')}
                        value={form.platform}
                        onChange={(event) =>
                          setForm({ ...form, platform: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      {t('Edição')}
                      <Input
                        maxLength={150}
                        placeholder={t(
                          'Ex.: edição de colecionador, capa dura',
                        )}
                        value={form.edition}
                        onChange={(event) =>
                          setForm({ ...form, edition: event.target.value })
                        }
                      />
                    </label>
                  </>
                )}
                <label>
                  {t('Observações privadas')}
                  <textarea
                    maxLength={2000}
                    rows={3}
                    value={form.notes}
                    onChange={(event) =>
                      setForm({ ...form, notes: event.target.value })
                    }
                  />
                </label>
              </fieldset>
              {formError && (
                <p className="home-error" role="alert">
                  {formError}
                </p>
              )}
              <div className="collector-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || photoBusy}
                  onClick={() => setForm(null)}
                >
                  {t('Cancelar')}
                </Button>
                <Button
                  type="submit"
                  className="home-primary"
                  disabled={
                    saving ||
                    photoBusy ||
                    !form.title.trim() ||
                    (form.kind === 'other' && !form.category?.trim())
                  }
                >
                  {t(saving ? 'Salvando…' : 'Salvar item')}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setRemoving(null);
        }}
      >
        <DialogContent className="collector-dialog" showCloseButton={!saving}>
          <DialogTitle>{t('Remover esta cópia?')}</DialogTitle>
          <DialogDescription>
            {t(
              'Somente este exemplar será removido. As outras cópias e o acompanhamento serão preservados.',
            )}
          </DialogDescription>
          <p>
            {removing?.title} · {removing?.edition || t('Sem edição informada')}
          </p>
          {formError && (
            <p className="home-error" role="alert">
              {formError}
            </p>
          )}
          <div className="collector-actions">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setRemoving(null)}
            >
              {t('Cancelar')}
            </Button>
            <Button
              className="collector-remove"
              disabled={saving}
              onClick={() => void remove()}
            >
              {t(saving ? 'Removendo…' : 'Remover cópia')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
