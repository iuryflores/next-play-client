import type { ReactElement } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { t } from './i18n';

const descriptions: Record<string, string> = {
  all: 'Acompanhe filmes, séries, jogos e livros e combine filtros de status para escolher o que ver.',
  'coming-soon':
    'Veja os próximos lançamentos da sua lista e os episódios que estão chegando.',
  acervo: 'Organize os exemplares e as edições que você possui na sua coleção.',
  achievements:
    'Veja suas conquistas, acompanhe o progresso e escolha um título para seu perfil.',
  challenges:
    'Crie metas pessoais com prazo e acompanhe seu progresso em filmes, jogos e livros.',
  explore: 'Descubra títulos e sugestões para adicionar à sua biblioteca.',
  stats:
    'Explore seus hábitos, tempo dedicado, avaliações e preferências de entretenimento.',
  friends:
    'Encontre amigos, gerencie conexões e acesse atividades, listas e a comunidade.',
  add: 'Busque um filme, série, jogo ou livro para adicionar ao seu acompanhamento.',
  account:
    'Gerencie seu perfil, preferências e integrações com outras plataformas.',
  menu: 'Abra o menu para acessar todas as páginas da sua biblioteca.',
};

export default function NavigationHint({
  destination,
  children,
}: {
  destination: string;
  children: ReactElement;
}) {
  return (
    <TooltipProvider delay={350}>
      <Tooltip>
        {/* O próprio botão recebe o gatilho, preservando foco, cliques e o layout do menu. */}
        <TooltipTrigger render={children} />
        <TooltipContent
          side="right"
          sideOffset={10}
          className="max-w-64 text-sm leading-relaxed"
        >
          {t(descriptions[destination])}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
