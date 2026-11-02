import { useEffect, useEffectEvent, useState, type SubmitEvent } from 'react';
import {
  Users,
  Share2,
  ArrowLeft,
  RefreshCw,
  Star,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { ApiError } from './auth';
import type { LibraryItem } from './library';
import { categories } from './library';
import { AchievementIcon } from './AchievementProvider';
import { language, t } from './i18n';
import { notifySaved } from './notifications';
import PageLoading from './PageLoading';
import './social.css';
import './lists.css';

type Settings = {
  shareFollowers: boolean;
  shareComparison: boolean;
  isCritic: boolean;
  bio: string;
  tastes: string;
  favoriteActors: string[];
  favoriteDirectors: string[];
  favoriteAuthors: string[];
  publicProfile: boolean;
  shareActivity: boolean;
  backlogAlerts: boolean;
  favoriteIds: string[];
};
type Title = {
  key: string;
  title: string;
  kind: LibraryItem['kind'];
  coverUrl: string;
  year: string;
  viewerItemId: string | null;
};
type Activity = {
  id: string;
  type: 'added' | 'started' | 'completed';
  recordedAt: string;
  title: Title;
  actor: {
    id: string;
    name: string;
    avatar: string;
    profileAvailable: boolean;
  };
};
type Feed = { activities: Activity[]; nextBefore: string | null };
type Profile = {
  followersCount: number;
  followingCount: number;
  followsYou: boolean;
  following: boolean;
  isCritic: boolean;
  shareComparison: boolean;
  bio: string;
  tastes: string;
  favoriteActors: string[];
  favoriteDirectors: string[];
  favoriteAuthors: string[];
  id: string;
  mine: boolean;
  published: boolean;
  name: string;
  avatar: string;
  totalXp: number;
  level: number;
  achievement: { title: string; family: string } | null;
  favorites: Title[];
  completed: Title[];
  totalCompleted: number;
  nextBefore: string | null;
};
async function request<T>(
  path: string,
  body?: object,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch('/api/social' + path, {
    method: body ? 'PATCH' : 'GET',
    credentials: 'same-origin',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000),
    ...(body
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data)
    throw new ApiError(
      response.status,
      data?.message || t('Não foi possível carregar.'),
    );
  return data;
}
function Cover({
  title,
  onOpen,
}: {
  title: Title;
  onOpen: (id: string) => void;
}) {
  const content = (
    <>
      <div className="social-cover">
        {title.coverUrl ? (
          <img
            src={title.coverUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <Star aria-hidden="true" />
        )}
      </div>
      <strong>{title.title}</strong>
      <small>
        {categories[title.kind]}
        {title.year ? ' · ' + title.year : ''}
      </small>
    </>
  );
  return title.viewerItemId ? (
    <button
      type="button"
      className="social-title"
      onClick={() => onOpen(title.viewerItemId!)}
      aria-label={t('Ver detalhes de {0}', title.title)}
    >
      {content}
    </button>
  ) : (
    <article className="social-title">{content}</article>
  );
}
export default function Social({
  userId,
  items,
  profileId,
  onProfile,
  onOpenTitle,
  onExpired,
  onHistory,
}: {
  userId: string;
  items: LibraryItem[];
  profileId?: string;
  onProfile: (id?: string) => void;
  onOpenTitle: (id: string) => void;
  onExpired: () => void;
  onHistory: () => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [people, setPeople] = useState<
    { id: string; name: string; isCritic: boolean }[]
  >([]);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [comparison, setComparison] = useState<{
    commonTitles: number;
    ratedInCommon: number;
    ratingAgreement: number | null;
    genreOverlap: number | null;
  } | null>(null);
  const expired = useEffectEvent(onExpired);
  useEffect(() => {
    if (profileId) return;
    const controller = new AbortController();
    void request<{ profiles: typeof people }>(
      '/discover',
      undefined,
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted) setPeople(data.profiles);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [profileId]);
  const candidates = items
    .filter((item) => item.status === 'completed' && !item.archived)
    .sort((a, b) => a.title.localeCompare(b.title, language));
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      request<Settings>('/settings', undefined, controller.signal),
      profileId
        ? request<Profile>(
            '/profiles/' + profileId,
            undefined,
            controller.signal,
          )
        : request<Feed>('/feed', undefined, controller.signal),
    ])
      .then(([options, result]) => {
        if (controller.signal.aborted) return;
        setSettings(options);
        if (profileId) setProfile(result as Profile);
        else setFeed(result as Feed);
        setError('');
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        if (reason instanceof ApiError && reason.status === 401) expired();
        else
          setError(
            reason instanceof Error
              ? reason.message
              : t('Não foi possível carregar.'),
          );
      });
    return () => controller.abort();
  }, [profileId, revision]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else
        setError(
          reason instanceof Error
            ? reason.message
            : t('Não foi possível salvar.'),
        );
    } finally {
      setBusy(false);
    }
  }
  function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    void run(async () => {
      const favoriteIds = settings.favoriteIds.filter((id) =>
        candidates.some((item) => item.id === id),
      );
      const saved = await request<Settings>('/settings', {
        ...settings,
        favoriteIds,
        favoriteActors: [
          ...new Set(
            settings.favoriteActors.map((name) => name.trim()).filter(Boolean),
          ),
        ],
        favoriteDirectors: [
          ...new Set(
            settings.favoriteDirectors
              .map((name) => name.trim())
              .filter(Boolean),
          ),
        ],
        favoriteAuthors: [
          ...new Set(
            settings.favoriteAuthors.map((name) => name.trim()).filter(Boolean),
          ),
        ],
      });
      setSettings(saved);
      if (profileId === userId)
        setProfile(await request<Profile>('/profiles/' + userId));
      notifySaved(t('Preferências sociais salvas.'));
    });
  }
  return (
    <section className="social-page">
      <header className="social-toolbar">
        <h1>{t(profileId ? 'Perfil social' : 'Atividades dos amigos')}</h1>
        <div>
          {profileId && (
            <Button variant="outline" onClick={() => onProfile()}>
              <ArrowLeft aria-hidden="true" />
              {t('Atividades')}
            </Button>
          )}
          {profileId !== userId && (
            <Button variant="outline" onClick={() => onProfile(userId)}>
              <Settings2 aria-hidden="true" />
              {t('Meu perfil social')}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('Atualizar dados')}
            onClick={() => setRevision((value) => value + 1)}
            disabled={busy}
          >
            <RefreshCw aria-hidden="true" />
          </Button>
        </div>
      </header>
      {error && (
        <p role="alert" className="home-error">
          {error}
        </p>
      )}
      {!error && !(profileId ? profile : feed) && (
        <PageLoading label={t('Carregando…')} />
      )}
      {settings && (!profileId || profileId === userId) && (
        <details className="social-settings" open={profileId === userId}>
          <summary>{t('Compartilhamento e favoritos')}</summary>
          <form onSubmit={save}>
            {(['shareFollowers', 'shareComparison', 'isCritic'] as const).map(
              (field) => (
                <label className="social-check" key={field}>
                  <input
                    type="checkbox"
                    checked={settings[field]}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        [field]: event.target.checked,
                      })
                    }
                  />
                  {t(
                    field === 'shareFollowers'
                      ? 'Compartilhar novas atividades com seguidores do meu perfil público'
                      : field === 'shareComparison'
                        ? 'Permitir comparação agregada de gostos com amigos'
                        : 'Identificar meu perfil como crítico autodeclarado',
                  )}
                </label>
              ),
            )}
            <label className="social-text-field">
              {t('Bio')}
              <textarea
                rows={3}
                maxLength={500}
                value={settings.bio}
                onChange={(event) =>
                  setSettings({ ...settings, bio: event.target.value })
                }
              />
            </label>
            <label className="social-text-field">
              {t('Preferências e gostos')}
              <textarea
                rows={3}
                maxLength={500}
                value={settings.tastes}
                onChange={(event) =>
                  setSettings({ ...settings, tastes: event.target.value })
                }
              />
            </label>
            {(
              [
                'favoriteActors',
                'favoriteDirectors',
                'favoriteAuthors',
              ] as const
            ).map((field) => (
              <label className="social-text-field" key={field}>
                {t(
                  field === 'favoriteActors'
                    ? 'Atores favoritos'
                    : field === 'favoriteDirectors'
                      ? 'Diretores favoritos'
                      : 'Autores favoritos',
                )}
                <textarea
                  rows={3}
                  maxLength={1009}
                  value={settings[field].join('\n')}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      [field]: event.target.value.split('\n').slice(0, 10),
                    })
                  }
                />
                <small>
                  {t(
                    'Até dez nomes, um por linha. Publicados apenas com o perfil.',
                  )}
                </small>
              </label>
            ))}
            <label className="social-check">
              <input
                type="checkbox"
                checked={settings.publicProfile}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    publicProfile: event.target.checked,
                  })
                }
              />
              {t('Publicar meu perfil para usuários do app')}
            </label>
            <p>
              {t(
                'Compartilha apenas títulos concluídos e não arquivados e os favoritos escolhidos. Anotações e avaliações individuais continuam privadas.',
              )}
            </p>
            <label className="social-check">
              <input
                type="checkbox"
                checked={settings.shareActivity}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    shareActivity: event.target.checked,
                  })
                }
              />
              {t('Compartilhar novas atividades com amigos')}
            </label>
            <p>
              {t(
                'Somente novas ações após ativar. Desativar oculta o feed; reativar não publica o histórico anterior.',
              )}
            </p>
            <label className="social-check">
              <input
                type="checkbox"
                checked={settings.backlogAlerts}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    backlogAlerts: event.target.checked,
                  })
                }
              />
              {t('Avisar quando um amigo concluir algo do meu Para depois')}
            </label>
            <fieldset className="social-favorite-picker">
              <legend>{t('Meus favoritos')}</legend>
              <p>
                {t(
                  'Escolha até dez títulos concluídos, na ordem que devem aparecer.',
                )}
              </p>
              {Array.from({ length: 10 }, (_, index) => index).map((index) => (
                <label key={index}>
                  {t('Favorito {0}', index + 1)}
                  <NativeSelect
                    value={settings.favoriteIds[index] || ''}
                    onChange={(event) => {
                      const ids = [...settings.favoriteIds];
                      ids[index] = event.target.value;
                      setSettings({ ...settings, favoriteIds: ids });
                    }}
                  >
                    <option value="">{t('Nenhum')}</option>
                    {candidates.map((item) => (
                      <option
                        value={item.id}
                        key={item.id}
                        disabled={settings.favoriteIds.some(
                          (id, pos) => id === item.id && pos !== index,
                        )}
                      >
                        {item.title} · {categories[item.kind]}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
              ))}
            </fieldset>
            <Button type="submit" disabled={busy}>
              {t(busy ? 'Salvando…' : 'Salvar preferências sociais')}
            </Button>
          </form>
        </details>
      )}
      {!profileId && feed && (
        <>
          <section className="social-settings">
            <h2>{t('Descobrir pessoas e críticos')}</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () =>
                  setPeople(
                    (
                      await request<{ profiles: typeof people }>(
                        '/discover?q=' + encodeURIComponent(peopleQuery),
                      )
                    ).profiles,
                  ),
                );
              }}
            >
              <label>
                {t('Buscar por nome')}
                <input
                  maxLength={100}
                  value={peopleQuery}
                  onChange={(event) => setPeopleQuery(event.target.value)}
                />
              </label>
              <Button disabled={busy} type="submit">
                {t('Buscar')}
              </Button>
            </form>
            <div className="list-actions">
              {people.map((person) => (
                <Button
                  key={person.id}
                  variant="outline"
                  onClick={() => onProfile(person.id)}
                >
                  {person.name}
                  {person.isCritic ? ' · ' + t('Crítico autodeclarado') : ''}
                </Button>
              ))}
            </div>
          </section>
          <p className="social-help">
            {t(
              'Atividades compartilhadas por amigos aceitos. As datas indicam quando a ação foi registrada no app, não necessariamente o dia do consumo.',
            )}
          </p>
          {!feed.activities.length && (
            <div className="social-empty">
              <Users aria-hidden="true" />
              <p>
                {t(
                  'Ainda não há atividades compartilhadas. Seus amigos precisam habilitar o compartilhamento para aparecer aqui.',
                )}
              </p>
            </div>
          )}
          <div className="social-feed">
            {feed.activities.map((activity) => (
              <article key={activity.id} className="social-activity">
                <header>
                  <span className="friend-avatar" aria-hidden="true">
                    {activity.actor.name.charAt(0)}
                    {activity.actor.avatar && (
                      <img src={activity.actor.avatar} alt="" loading="lazy" />
                    )}
                  </span>
                  <div>
                    {activity.actor.profileAvailable ? (
                      <button
                        type="button"
                        className="social-person-link"
                        onClick={() => onProfile(activity.actor.id)}
                      >
                        {activity.actor.name}
                      </button>
                    ) : (
                      <strong>{activity.actor.name}</strong>
                    )}
                    <p>
                      {t(
                        activity.type === 'added'
                          ? 'Adicionou à lista'
                          : activity.type === 'started'
                            ? 'Começou a acompanhar'
                            : 'Registrou a conclusão',
                      )}
                    </p>
                  </div>
                  <time dateTime={activity.recordedAt}>
                    {new Date(activity.recordedAt).toLocaleString(language, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </time>
                </header>
                <Cover title={activity.title} onOpen={onOpenTitle} />
              </article>
            ))}
          </div>
          {feed.nextBefore && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const next = await request<Feed>(
                    '/feed?before=' + feed.nextBefore,
                  );
                  setFeed((current) => ({
                    ...next,
                    activities: [...current!.activities, ...next.activities],
                  }));
                })
              }
            >
              {t('Ver mais atividades')}
            </Button>
          )}
        </>
      )}
      {profileId && profile && (
        <>
          <header className="social-profile-header">
            <span className="friend-avatar" aria-hidden="true">
              {profile.name.charAt(0)}
              {profile.avatar && <img src={profile.avatar} alt="" />}
            </span>
            <div>
              <h2>{profile.name}</h2>
              <p>
                {t('Nível {0}', profile.level)} ·{' '}
                {profile.totalXp.toLocaleString(language)} XP
              </p>
              {profile.achievement && (
                <span>
                  <AchievementIcon family={profile.achievement.family} />{' '}
                  {t(profile.achievement.title)}
                </span>
              )}
            </div>
            <Button
              variant="outline"
              disabled={!profile.published}
              onClick={() =>
                void run(async () => {
                  await navigator.clipboard.writeText(
                    window.location.origin + '/social?perfil=' + profile.id,
                  );
                  notifySaved(t('Link do perfil copiado.'));
                })
              }
            >
              <Share2 aria-hidden="true" />
              {t('Copiar link do perfil')}
            </Button>
          </header>
          {!profile.mine && (
            <div className="list-actions">
              <Button
                disabled={busy}
                variant="outline"
                onClick={() =>
                  void run(async () => {
                    await request<{ following: boolean }>(
                      '/profiles/' + profile.id + '/follow',
                      { following: !profile.following },
                    );
                    setProfile(
                      await request<Profile>('/profiles/' + profile.id),
                    );
                  })
                }
              >
                {t(profile.following ? 'Deixar de seguir' : 'Seguir')}
              </Button>
              {settings?.shareComparison && profile.shareComparison && (
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() =>
                    void run(async () =>
                      setComparison(
                        await request('/profiles/' + profile.id + '/compare'),
                      ),
                    )
                  }
                >
                  {t('Comparar gostos')}
                </Button>
              )}
            </div>
          )}
          {profile.isCritic && <p>{t('Crítico autodeclarado')}</p>}
          <p>
            {t(
              '{0} seguidores · seguindo {1}',
              profile.followersCount,
              profile.followingCount,
            )}
            {profile.following && profile.followsYou
              ? ' · ' + t('Seguidores mútuos')
              : profile.followsYou
                ? ' · ' + t('Segue você')
                : ''}
          </p>
          {comparison && (
            <p>
              {t(
                '{0} títulos em comum · {1} notas comparáveis · concordância: {2}% · gêneros em comum: {3}%',
                comparison.commonTitles,
                comparison.ratedInCommon,
                comparison.ratingAgreement ?? '—',
                comparison.genreOverlap ?? '—',
              )}
            </p>
          )}
          {profile.mine && !profile.published && (
            <p className="social-help">
              {t(
                'Pré-visualização privada. Publique o perfil nas opções acima para outras pessoas poderem abri-lo.',
              )}
            </p>
          )}
          <h2>{t('Favoritos em destaque')}</h2>
          {profile.mine && (
            <Button variant="outline" onClick={onHistory}>
              {t('Meu histórico e retrospectivas')}
            </Button>
          )}
          {profile.bio && <p className="social-bio">{profile.bio}</p>}
          {profile.tastes && <p className="social-bio">{profile.tastes}</p>}
          {(
            ['favoriteActors', 'favoriteDirectors', 'favoriteAuthors'] as const
          ).map((field) =>
            profile[field]?.length ? (
              <p key={field}>
                <strong>
                  {t(
                    field === 'favoriteActors'
                      ? 'Atores favoritos'
                      : field === 'favoriteDirectors'
                        ? 'Diretores favoritos'
                        : 'Autores favoritos',
                  )}
                  :
                </strong>{' '}
                {profile[field].join(' · ')}
              </p>
            ) : null,
          )}
          {profile.favorites.length ? (
            <div className="social-titles social-top-four">
              {profile.favorites.map((title) => (
                <Cover key={title.key} title={title} onOpen={onOpenTitle} />
              ))}
            </div>
          ) : (
            <p>{t('Nenhum favorito em destaque.')}</p>
          )}
          <h2>
            {t('Títulos concluídos')} <small>({profile.totalCompleted})</small>
          </h2>
          <div className="social-titles">
            {profile.completed.map((title) => (
              <Cover key={title.key} title={title} onOpen={onOpenTitle} />
            ))}
          </div>
          {profile.nextBefore && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const next = await request<Profile>(
                    '/profiles/' + profileId + '?before=' + profile.nextBefore,
                  );
                  setProfile((current) => ({
                    ...next,
                    completed: [...current!.completed, ...next.completed],
                  }));
                })
              }
            >
              {t('Ver mais títulos')}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
