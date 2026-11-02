import { useId, useRef, useState } from 'react';
import { Clock3, Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { libraryRequest, type LibraryItem } from './library';
import { ApiError } from './auth';
import { t } from './i18n';
import './game-time.css';

export default function GameTimeAction({
  item,
  changed,
  onExpired,
}: {
  item: LibraryItem;
  changed: (item: LibraryItem) => void;
  onExpired: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'add' | 'total'>('add');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const fieldId = useId();
  const total = item.playtimeMinutes || 0;
  function choose(value: 'add' | 'total') {
    setMode(value);
    setError('');
    setHours(value === 'total' ? String(Math.floor(total / 60)) : '');
    setMinutes(value === 'total' ? String(total % 60) : '');
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (pending.current) return;
        setOpen(value);
        if (value) choose('add');
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="game-time-trigger"
            aria-label={t('Registrar tempo de jogo em {0}', item.title)}
          />
        }
      >
        <Gamepad2 aria-hidden="true" />
        {t('Joguei')}
      </DialogTrigger>
      <DialogContent className="game-time-dialog">
        <div className="game-time-heading">
          <span aria-hidden="true">
            <Gamepad2 />
          </span>
          <div>
            <DialogTitle>{t('Registrar tempo de jogo')}</DialogTitle>
            <DialogDescription>{item.title}</DialogDescription>
          </div>
        </div>
        <div className="game-time-current">
          <Clock3 aria-hidden="true" />
          <span>
            {t('Total registrado')}
            <strong>
              {Math.floor(total / 60)}h{String(total % 60).padStart(2, '0')}min
            </strong>
          </span>
        </div>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending.current) return;
            const entered = Number(hours || 0) * 60 + Number(minutes || 0);
            if (
              !Number.isInteger(entered) ||
              entered < (mode === 'add' ? 1 : 0) ||
              entered > 6000000
            ) {
              setError(t('Informe um tempo de jogo válido.'));
              return;
            }
            pending.current = true;
            setBusy(true);
            setError('');
            try {
              // A API soma ao total atual no banco, mesmo que outra aba tenha registrado tempo.
              const result = await libraryRequest<{ item: LibraryItem }>(
                'PATCH',
                item.id,
                { mode, minutes: entered },
                'playtime',
              );
              changed(result.item);
              setOpen(false);
            } catch (reason) {
              if (reason instanceof ApiError && reason.status === 401)
                onExpired();
              else
                setError(
                  reason instanceof Error
                    ? reason.message
                    : t('Não foi possível salvar. Tente novamente.'),
                );
            } finally {
              pending.current = false;
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className="game-time-mode">
            <legend className="sr-only">{t('Como registrar o tempo?')}</legend>
            <label>
              <input
                type="radio"
                name={`${fieldId}-mode`}
                checked={mode === 'add'}
                onChange={() => choose('add')}
              />
              {t('Adicionar tempo jogado')}
            </label>
            <label>
              <input
                type="radio"
                name={`${fieldId}-mode`}
                checked={mode === 'total'}
                onChange={() => choose('total')}
              />
              {t('Atualizar total de horas')}
            </label>
          </fieldset>
          <p className="game-time-help">
            {t(
              mode === 'add'
                ? 'Quanto tempo você jogou?'
                : 'Qual é o total de tempo jogado agora?',
            )}
          </p>
          <div className="game-time-inputs">
            <label htmlFor={`${fieldId}-hours`}>
              {t('Horas')}
              <Input
                id={`${fieldId}-hours`}
                type="number"
                inputMode="numeric"
                min={0}
                max={100000}
                step={1}
                value={hours}
                placeholder="0"
                onChange={(event) => setHours(event.target.value)}
                disabled={busy}
                autoFocus
              />
            </label>
            <label htmlFor={`${fieldId}-minutes`}>
              {t('Minutos')}
              <Input
                id={`${fieldId}-minutes`}
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                step={1}
                value={minutes}
                placeholder="0"
                onChange={(event) => setMinutes(event.target.value)}
                disabled={busy}
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="home-error">
              {error}
            </p>
          )}
          <div className="game-time-footer">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              {t('Cancelar')}
            </Button>
            <Button type="submit" disabled={busy}>
              {t(busy ? 'Salvando…' : 'Salvar tempo')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
