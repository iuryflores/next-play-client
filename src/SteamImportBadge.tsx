import { t } from './i18n';
export default function SteamImportBadge({ appId }: { appId?: string }) {
  // IDs válidos viram links de loja com host fixo, nunca URLs fornecidas pelo arquivo importado.
  if (!appId || !/^[1-9]\d{0,14}$/.test(appId)) return null;
  return (
    <a
      className="steam-import-tag"
      href={'https://store.steampowered.com/app/' + appId}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('Ver jogo na Steam')}
    >
      {t('Importado da Steam')}
    </a>
  );
}
