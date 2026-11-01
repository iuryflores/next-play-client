import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { t } from './i18n';

export default function CompanyRankingEntry({
  company,
}: {
  company: { name: string; logoUrl?: string | null; count: number };
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="company-ranking-entry">
      <span className="company-ranking-logo" aria-hidden="true">
        {company.logoUrl && !failed ? (
          <img
            src={company.logoUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        ) : (
          <Building2 />
        )}
      </span>
      <div>
        <strong>{company.name}</strong>
        <span>{t('{0} títulos', company.count)}</span>
      </div>
    </div>
  );
}
