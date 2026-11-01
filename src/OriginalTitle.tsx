import { t } from './i18n';
export default function OriginalTitle({
  title,
  originalTitle,
}: {
  title: string;
  originalTitle?: string;
}) {
  if (
    !originalTitle?.trim() ||
    originalTitle.trim().toLocaleLowerCase() ===
      title.trim().toLocaleLowerCase()
  )
    return null;
  return (
    <small className="original-title" title={t('Título original')}>
      {originalTitle}
    </small>
  );
}
