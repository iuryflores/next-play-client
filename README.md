# NextPlay

Primeira tela de login em React + TypeScript + Vite, com a identidade visual aprovada.

## Estrutura

`nextplay/brand` contém a marca, `nextplay/client` é a raiz do frontend e `nextplay/server` fica reservado à API. `src/App.tsx` contém a tela de login, `src/main.tsx` inicializa o React e `src/index.css` contém os estilos. `index.html`, configurações, componentes e dependências ficam diretamente em `client`.

## Desenvolvimento

Requer Node 22.13 ou superior. Dentro desta pasta:

```sh
npm install
npm run dev
```

Use `npm run build` para compilar e `npm run lint` para verificar o código.

O desenvolvimento usa `http://localhost:3000`. `npm run build` verifica o TypeScript e gera os arquivos estáticos em `dist`; `npm run preview` permite conferir esse build localmente. A configuração de hospedagem foi adaptada para esse formato, mas a migração não republica automaticamente a prévia hospedada.

O lint completo do scaffold apresenta apontamentos preexistentes nos componentes genéricos em `components/ui` e em `hooks/use-mobile.ts`. Para verificar esta tela separadamente, use `npx oxlint src` e `npx tsc --noEmit`.

## Escopo desta etapa

- Layout responsivo em português, com logo original.
- Seleção entre e-mail/senha e telefone internacional com código SMS.
- Botão de acesso com Google.
- Validação nativa de campos obrigatórios, e-mail e formato básico do telefone.
- Alternância de visibilidade da senha e mensagens acessíveis.

**A autenticação ainda não está conectada.** Os botões informam a indisponibilidade; não enviam SMS, não abrem OAuth e não criam sessões. Os dados digitados não são armazenados nem transmitidos. O padrão de telefone é apenas uma validação visual básica; o provedor deverá normalizar e validar os números no servidor.

Após a escolha do serviço, conectar os três fluxos, incluindo confirmação de SMS, erros e estados de carregamento, recuperação de conta e sessões verificadas no servidor. Não usar senhas ou dados locais como prova de autenticação.

Os arquivos originais da marca estão em `../brand`. A fonte Inter pode ser adicionada depois; a tela usa Segoe UI/sans-serif como alternativa, sem requisições externas de fontes.
