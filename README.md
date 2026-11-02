# NextPlay

Login e biblioteca pessoal em React + TypeScript + Vite, com a identidade visual aprovada.

## Biblioteca

O NextPlay acompanha filmes, séries, jogos e **livros**. Para livros, os estados são **Quero ler**, **Lendo** e **Lido**. Filmes, séries e jogos usam os rótulos equivalentes.

A tela inicial permite adicionar, editar e remover títulos, registrar anotações, buscar pelo nome e filtrar por categoria e estado. Os dados são persistidos no MongoDB por usuário. “Adicionar título” pesquisa filmes e séries no TMDB e jogos no IGDB, mostrando capa, ano e sinopse. Livros continuam no cadastro manual, também disponível como alternativa para as outras categorias.

## Catálogos externos

As credenciais ficam somente em `server/.env`: `TMDB_API_ACCESS_TOKEN` (preferencial) ou `TMDB_API_KEY`; `IGDB_CLIENT_ID` e `IGDB_CLIENT_SECRET`. O NestJS obtém e renova o token Twitch por client credentials. Depois de alterar `.env`, reinicie a API no seu terminal para garantir que as novas variáveis foram carregadas.

`GET /api/catalog/search?kind=movie|series|game&q=...` exige sessão. As buscas têm limite de 30 por minuto por conta e cache de 10 minutos, limitado a 500 entradas no processo. Chamadas IGDB são serializadas com intervalo mínimo de 300 ms. Esses controles em memória são adequados à instância local; para múltiplas instâncias, será necessário compartilhá-los.

Ao importar, o frontend envia apenas a referência `catalogId` junto do acompanhamento. A API consulta os detalhes oficiais e salva capa, ano, sinopse e fonte no item da coleção. Referências são únicas por conta, evitando duplicar o mesmo título do provedor. Em itens importados, o usuário edita o status e as anotações; o título e a categoria continuam vinculados ao catálogo. Itens manuais existentes continuam funcionando e não são associados automaticamente a resultados externos.

Referências: [TMDB — busca](https://developer.themoviedb.org/reference/search-movie), [IGDB — autenticação](https://api-docs.igdb.com/#authentication). A interface inclui os créditos dos provedores.

## Explorar

O menu Explorar usa somente `GET /api/library/explore` e o MongoDB, sem consultar provedores. A coleção `catalog_titles` guarda dados dos títulos separadamente de `library_items`, que mantém proprietário, status e anotações privados. Títulos importados e manuais alimentam esse catálogo comum, que permanece mesmo após remover um título da coleção pessoal. Ao adicionar uma sugestão já cadastrada, o servidor reaproveita os dados locais.

As sugestões são separadas por categoria e ordenadas pela frequência dos gêneros na coleção do usuário. Títulos novos têm prioridade, seguidos pelos já adicionados, que exibem status e ações rápidas. Opções sem gêneros em comum também aparecem como alternativa. Sem gêneros, a tela mostra opções do catálogo local sem classificá-las como personalizadas; sem candidatos, apresenta um estado vazio. Não há busca externa nem preenchimento fictício de sugestões.

Novas importações trazem os gêneros do TMDB/IGDB. No cadastro e na edição há um campo de gêneros, separado por vírgulas (até oito), inclusive para livros. Títulos antigos são incorporados ao catálogo na inicialização usando apenas dados já salvos: preencha seus gêneros na edição para personalizar as sugestões, pois não fazemos consultas externas para completar registros antigos.

`test/explore.test.cjs` verifica sugestões nas quatro categorias, exclusão de títulos próprios, importação local, privacidade do acompanhamento e ausência de chamadas externas, usando MongoDB isolado.

`src/Home.tsx` e `src/home.css` compõem a tela inicial. `src/library.ts` consome `GET/POST /api/library` e `PATCH/DELETE /api/library/:id`. No backend, `src/library/library.module.ts` implementa as operações protegidas pela sessão, com validação de origem nas mutações e filtro obrigatório pelo proprietário. O teste `test/library.test.cjs` usa banco isolado para validar persistência e impedir acesso entre contas.

## Estrutura

## Episódios de séries

Nas séries importadas do TMDB, **Ver episódios** abre o acompanhamento por temporada. Ao abrir a série, o app importa automaticamente as temporadas e os episódios necessários, caso ainda não estejam no banco, e retoma no primeiro episódio regular não assistido. `series_seasons` guarda os dados compartilhados e `episode_progress` guarda as marcações por item da conta, com data e índice único de temporada/episódio. Ler progresso e marcar/desmarcar usam somente MongoDB. Atualizar temporadas/episódios consulta explicitamente o TMDB e preserva as marcações.

A interface abre os detalhes do próximo episódio, com sinopse, estreia, imagem e duração quando disponíveis. Já assisti salva e avança automaticamente, inclusive entre temporadas; ao reabrir, o destino é calculado pelo progresso salvo. Especiais ficam disponíveis na seleção manual e não interrompem a sequência regular. Episódios futuros não podem ser marcados antes da data de estreia. Marcar uma série TMDB como concluída importa as temporadas necessárias e registra como assistidos todos os episódios regulares já lançados. Marcações anteriores e suas datas são preservadas. Desmarcar um episódio reabre a série como em andamento. Séries manuais não têm lista automática até serem adicionadas pelo catálogo TMDB.

O módulo `server/src/episodes/episodes.module.ts` protege leitura, importação e marcação pela propriedade do item, e exige origem válida nas mutações. `test/episodes.test.cjs` valida importação, cache persistente, atualização, marcação idempotente, datas futuras e isolamento entre contas em banco de teste separado.

## Conclusão e comunidade

Ao marcar como concluído, `completedAt` registra o instante da primeira conclusão e `completedOn` guarda a data de calendário escolhida (a interface usa o dia local atual). A data pode ser corrigida sem alterar o instante original. Avaliações opcionais incluem 1–5 estrelas, sentimento e nome livre de personagem favorito. Voltar a um status não concluído remove esses campos e o voto; a interface avisa antes de salvar.

Os comentários ficam em `title_comments`, associados à chave do título, separados das anotações privadas. Ler, publicar ou excluir exige ter o título na própria coleção; só o autor pode excluir seu comentário. A interface usa identificadores de participante por título, sem expor e-mails. A listagem mostra 30 comentários por página. Votos são contados por pessoa e nome normalizado de personagem, sem buscar elenco nas APIs externas. Remover um título da coleção não apaga os comentários já publicados.

`test/reviews.test.cjs` verifica datas, validação de notas, votos, comentários compartilhados, proteção por conta e origem e exclusão restrita ao autor.

`nextplay/brand` contém a marca, `nextplay/client` é a raiz do frontend e `nextplay/server` fica reservado à API. `src/App.tsx` contém a tela de login, `src/main.tsx` inicializa o React e `src/index.css` contém os estilos. `index.html`, configurações, componentes e dependências ficam diretamente em `client`.

## Desenvolvimento

Requer Node 22.13 ou superior. Dentro desta pasta:

```sh
npm install
npm run dev
```

Use `npm run build` para compilar e `npm run lint` para verificar o código.

O desenvolvimento usa `http://localhost:5174`. Se mudar essa porta, ajuste também `CLIENT_ORIGIN` no backend. `npm run build` verifica o TypeScript e gera os arquivos estáticos em `dist`; `npm run preview` permite conferir esse build localmente. A prévia hospedada não foi republicada nem conectada à API local.

O lint completo do scaffold apresenta apontamentos preexistentes nos componentes genéricos em `components/ui` e em `hooks/use-mobile.ts`. Para verificar esta tela separadamente, use `npx oxlint src` e `npx tsc --noEmit`.

## Escopo desta etapa

### Conquistas e títulos (implementação local)

O menu **Conquistas** acompanha 11 famílias e 54 metas: Primeiro play (1 filme), Só mais um episódio (5 em 5 episódios no mesmo dia, até 100), Temporada encerrada (1/5/10/25 temporadas regulares), Cinéfilo (10/25/50/100 filmes), Devorador de páginas (5/10/25/50 livros) Colecionador (10/25/50/100 itens possuídos), Até o último episódio (1/5/10/25 séries concluídas), Universo em episódios (25/100/250/500 episódios), De volta aos clássicos (5/10/25/50 filmes anteriores a 2000), Na cadeira do crítico (5/10/25/50 filmes assistidos avaliados) e Hoje tem final (uma temporada completa no mesmo dia, com marcações individuais). Conquistas concedidas ficam na conta; itens removidos não apagam medalhas. A posse continua independente de leitura/consumo.

Cada família tem emoji e cor próprios, presentes no card, no perfil e na celebração. Famílias de quatro níveis mostram quatro estrelas, preenchidas conforme os desbloqueios; maratonas usam estrela e contador até 20. O título pode ser atualizado para o nível mais recente conquistado. Ao desbloquear, uma celebração central mostra medalha, confetes, brilho e animações. Várias conquistas entram em sequência; “Próxima conquista” confirma somente a atual e “Voltar ao app” dispensa o lote. Pendências ficam no servidor e retornam se a apresentação for interrompida. O efeito respeita movimento reduzido. No painel, escolha um título desbloqueado para aparecer no perfil e na navegação; todas as metas de maratona podem ser expandidas.

O frontend sincroniza ao entrar, ao retornar à aba e após salvar consumo/episódios/posse, agrupando eventos próximos. Nenhuma contagem é confiada ao cliente. O servidor usa o fuso IANA do navegador para agrupar marcações individuais novas; lotes, conclusões integrais, especiais e registros legados não simulam uma maratona de hoje. Histórico de filmes, livros, posse e temporadas pode conceder medalhas retroativas. Falhas de sincronização não bloqueiam a biblioteca. Sem novas variáveis de ambiente; sem commit/push/deploy.

### Desempenho (implementação local)

O login baixa a entrada do aplicativo; biblioteca, Estatísticas, Minha Coleção, Explorar, Amigos e detalhes têm módulos separados, carregados conforme a navegação. Os estilos continuam compartilhados para preservar os temas claro/escuro. A sessão é consultada em paralelo aos provedores de login. Falhas de carregamento de uma tela oferecem recarga explícita, sem atualização automática da página.

Na medição de 01/11/2026, a entrada JavaScript do build local passou de aproximadamente 682 KB para 341 KB, sem contar os módulos carregados posteriormente. O site publicado ainda entregava 667 KB de JavaScript sem compressão e com `Cache-Control: no-cache`. Os templates do Nginx agora preparam gzip para JS/CSS/SVG públicos; o servidor PM2 permite cache longo apenas em assets com hash. HTML e nomes fixos continuam revalidando; o marcador de deploy usa `no-store`. Essas alterações de entrega dependem de um próximo deploy.

O Explorar começa com uma página sorteada (até 20 candidatos), preenchendo a grade e buscando outras páginas conforme necessário. Mantém variedade entre visitas e rolagem automática. As consultas a TMDB/Google Books continuam sujeitas à latência dos provedores. As otimizações permanecem sem commit/push.

Para filmes e séries, o sorteio dá mais peso às páginas populares dentro dos gêneros preferidos, mantendo todas as páginas válidas e evitando repetições até terminar o ciclo. A ordem de afinidade/popularidade retornada pela API é preservada nos cards iniciais, ao carregar mais e nas sugestões de Adicionar item. Livros mantêm sua própria ordem por título, autor e editora. A mudança não acrescenta chamadas ao catálogo. `tests/explore-pages.test.mjs` verifica o viés e a variedade com gerador determinístico; `tests/explore-selection.test.mjs` cobre prioridade, novidades e ausência de duplicatas.

### Aparência (implementação local)

Em **Minha conta → Configurações → Aparência**, escolha Claro, Escuro ou Usar tema do dispositivo. A mesma escolha está disponível no rodapé do login. A mudança é imediata e fica salva apenas neste navegador (`nextplay.theme`), sem enviar dados à API. Outras abas acompanham a preferência; no modo automático, mudanças do sistema também são aplicadas. Se o armazenamento estiver bloqueado, a troca continua funcionando na sessão. As cores de campos, opções abertas, cards, navegação e diálogos seguem o tema; imagens e legendas sobre capas preservam o contraste próprio.

Alteração ainda sem commit, push ou versão publicada. `tests/theme.test.mjs` verifica preferência explícita, sistema, sincronização entre abas e armazenamento indisponível.

- Layout responsivo em português, com logo original.
- Seleção entre e-mail/senha e telefone internacional com código SMS.
- Botão de acesso com Google.
- Validação nativa de campos obrigatórios, e-mail e formato básico do telefone.
- Alternância de visibilidade da senha e mensagens acessíveis.

**Cadastro e login por e-mail estão conectados à API NestJS + MongoDB em `../server`.** Inicie o MongoDB, execute `npm run dev` em `server` e em `client`. O Vite encaminha `/api` para `http://127.0.0.1:3001`. O frontend usa cookies HttpOnly para consultar a sessão e oferece logout. Nenhuma senha ou token é salvo no localStorage. Use “Criar conta” para cadastrar o primeiro acesso; não há conta padrão.

Google e SMS ficam para uma próxima etapa: a API retorna indisponibilidade, sem simular login nem envio de códigos. Recuperação de senha está disponível por Gmail SMTP (configure o backend conforme seu README). Novas contas confirmam o e-mail antes do primeiro login, usando o mesmo SMTP. Após o login, a biblioteca da conta é carregada automaticamente.

Os arquivos originais da marca estão em `../brand`. A fonte Inter pode ser adicionada depois; a tela usa Segoe UI/sans-serif como alternativa, sem requisições externas de fontes.

As ações rápidas nos cards do Explorar e da biblioteca adicionam como planejado e marcam como concluído com a data local de hoje. Avaliações e comentários permanecem acessíveis em Avaliar e ver detalhes. O Explorar consulta somente títulos do MongoDB.

`npm run test:episodes` verifica início, avanço, retomada, troca de temporada, lacunas e especiais na seleção do próximo episódio.

## Consulta ao Rotten Tomatoes

Ao abrir os detalhes de um filme, as notas do Rotten Tomatoes são carregadas automaticamente. Para filmes vinculados ao TMDB, o backend resolve o título original pelo identificador do catálogo. As notas só são associadas automaticamente quando há uma única correspondência de título e ano; em caso de dúvida, o usuário pode escolher o filme ou ajustar a busca. Resultados ficam em cache por até dez minutos, mantendo o horário da consulta original. Ausência de nota aparece como “Sem nota”, preservando notas iguais a zero. Falhas não impedem a abertura dos detalhes e permitem tentar novamente.

O endpoint autenticado `GET /api/rotten-tomatoes/search?q=...` roda exclusivamente no backend e usa o limite de consultas do catálogo. A busca utiliza o índice de filmes do Rotten Tomatoes no Algolia; não usa cookies de conta nem senha. Respostas externas passam por validação, limite de tamanho e timeout. Essa integração depende de um endpoint do site e pode deixar de funcionar se suas regras de acesso ou formato mudarem.

A configuração gerada foi movida para `server/.env.rotten-tomatoes.local`, ignorada pelo Git. Os comandos `dev` e `start` do servidor carregam esse arquivo antes do `.env` existente. Reinicie o backend após mudar a configuração. No ambiente publicado, configure `ROTTEN_TOMATOES_ENABLED`, `ROTTEN_TOMATOES_ALGOLIA_APP_ID`, `ROTTEN_TOMATOES_ALGOLIA_INDEX` e `ROTTEN_TOMATOES_ALGOLIA_API_KEY` como variáveis exclusivas do servidor, sem prefixo `VITE_`. `ROTTEN_TOMATOES_COOKIE` não é utilizado. A publicação estática do frontend não publica o backend automaticamente.

Validação da integração: `node --test ../server/test/rotten-tomatoes.test.cjs` (utiliza a pasta vizinha do servidor e seus módulos, sem ler arquivos de ambiente).

## Estatísticas

O menu Estatísticas apresenta episódios assistidos, tempo em séries, séries concluídas e filmes assistidos. O tempo soma somente durações conhecidas de episódios marcados, uma vez por episódio. Durações ausentes e séries manuais/concluídas sem catálogo são sinalizadas; filmes e jogos não entram no tempo em séries. Os dados são calculados a partir da coleção atual da conta, sem incluir outras pessoas. Séries concluídas anteriormente são sincronizadas automaticamente ao abrir seus cards ou a tela de estatísticas.

Concluir uma série considera episódios regulares já lançados (sem especiais ou estreias futuras). A barra usa esse mesmo total; uma série em andamento pode ficar com 100% dos episódios já lançados assistidos.

## Deploy e versionamento

Consulte [DEPLOY.md](DEPLOY.md) para GitHub Actions, SSM, PM2, Nginx, portas, HTTPS e recuperação de versões.
