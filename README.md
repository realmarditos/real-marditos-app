# Real Marditos FC: app da patota (V1 a V4)

PWA em React + Vite, com Supabase como banco de dados e login. Funciona no navegador e pode ser instalado na tela inicial do celular, como um app.

## O que tem na V1

**Membros:** login com celular e senha, cadastro com o código do clube, "Quem é você?" no primeiro acesso, início com o próximo jogo e o Vou / Não vou, ranking, partidas, perfil e editor de avatar em pixel art.

**Diretoria:** membros e notas por atributo, abertura da lista e controle de presença, convidados, sorteio equilibrado, súmula, avisos e código do clube (este só para o presidente).

**V4:** conquistas (Invicto, Pé de rato, Rei da noite, Bagre de ouro, Veterano), duplas e rivalidades (melhor dupla, carrasco, freguês), reações e comentários nas partidas, eventos com confirmação e acompanhantes, aniversariantes do mês e a retrospectiva do ano em dezembro e janeiro.

**V3:** caixa da patota. Mensalidade por categoria (linha, goleiro, afastado), Pix com QR code e copia e cola com o valor preenchido, "Já paguei" com comprovante, confirmação pelo tesoureiro, cobrança no WhatsApp, lembrete no app a partir do dia 5, gastos e entradas por categoria. Saldo e lançamentos ficam só com a diretoria; a galera vê a tabela de pagamentos do mês e a **prestação de contas mensal** que a diretoria publica.

**V2:** votação aberta de MVP (+1 ponto) e bagre da noite, que fecha 24h depois do jogo; Marditos da Noite, com a foto do time vencedor e a galeria do ano; card FIFA de cada jogador para compartilhar.

---

## Testar sem servidor (modo demo)

```bash
npm install
npm run dev:demo
```

Abre o app com um banco de mentira no navegador, já com a patota cadastrada. O selo **DEMO** no topo troca de usuário e reinicia os dados. Código do clube: `MARDITOS`. Contas prontas: **Pedro** e **Japa**, as duas com PIN `1234`.

`npm run build:demo` gera um único `dist-demo/index.html` que funciona sozinho.

---

## Passo a passo para colocar no ar

### 1. Criar o projeto no Supabase

1. Crie uma conta em [supabase.com](https://supabase.com) e um projeto novo. O plano Free resolve; escolha a região **São Paulo**.
2. Vá em **Authentication › Sign In / Providers › Email** e **desligue a confirmação de e-mail** ("Confirm email"). O app usa nome + PIN e não envia e-mail.

### 2. Criar o banco

1. Abra o **SQL Editor** do Supabase, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
2. Abra `supabase/seed.sql` e **troque `TROQUE-ESTE-CODIGO`** pelo código do clube que vocês vão usar. Depois cole o arquivo no SQL Editor e rode.
   - O seed já cadastra os 17 jogadores com a pontuação atual do ranking.

### 3. Rodar no computador

Precisa ter o [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
npm install
cp .env.example .env.local
```

Preencha o `.env.local` com a **Project URL** e a chave **anon / publishable**, que ficam em **Project Settings › API** no Supabase. Depois:

```bash
npm run dev
```

O endereço que aparecer no terminal abre o app.

### 4. Virar presidente

1. No app, toque em "Criar conta", digite o código do clube, escolha **Pedro** e crie seu PIN de 4 números.
2. No SQL Editor do Supabase, rode:

```sql
update players set role = 'presidente' where name = 'Pedro';
```

3. Feche e abra o app de novo: o botão **Diretoria** aparece no início. A partir daí, você define tesoureiro e organizador pelo próprio app, em Membros › editar › Permissão.

### 5. Publicar na internet (Vercel, grátis)

1. Suba esta pasta para um repositório no GitHub.
2. Em [vercel.com](https://vercel.com), clique em **Add New › Project** e importe o repositório.
3. Em **Environment Variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os mesmos valores do `.env.local`.
4. Clique em **Deploy**. O link gerado é o app da patota.

O `vercel.json` já está pronto. Se preferir a Netlify, o arquivo `public/_redirects` faz o mesmo papel.

### 6. Instalar no celular

- **Android (Chrome):** abra o link e toque em ⋮ › **Adicionar à tela inicial**.
- **iPhone (Safari):** abra o link e toque em Compartilhar › **Adicionar à Tela de Início**.

---

## Como funciona

| Regra | Onde está |
| --- | --- |
| Pontos: vitória 3, empate 1, derrota 0, presença 1 | Tabela `club_settings` |
| Limite da lista: 12; quem confirma depois vai para a lista de espera | `club_settings.max_players` |
| Confirmação até 14h; a lista fecha quando os times são postados | `set_rsvp` em `schema.sql` |
| Ranking = pontos iniciais + pontos de cada súmula da temporada | Função `ranking()` |
| Notas visíveis só para presidente e organizador | Políticas da tabela `player_ratings` |
| Votação: só quem jogou vota, pode votar em si mesmo, fecha 24h após o fim do jogo | `cast_vote` e `vote_deadline` |
| MVP vale +1 ponto quando a votação fecha; no empate, todos os empatados levam | `vote_winners()` e `ranking()` |
| Fotos do Marditos da Noite no bucket `fotos` do Storage (criado pelo schema) | Final do `schema.sql` |
| Mensalidade do mês criada para todos ao abrir o app; valor pela categoria naquele momento | `ensure_month_dues` |
| Atrasado = não pago depois do dia de vencimento (10) | `isLate` em `src/lib/types.ts` |
| Comprovantes em pasta privada: só o dono, o presidente e o tesoureiro veem | Bucket `comprovantes` |
| Saldo = saldo inicial + mensalidades pagas + entradas − gastos (só diretoria) | `cash_balance()` |
| Prestação mensal: resumo calculado no banco e publicado pela diretoria | `publish_cash_report()` |
| Conquistas, duplas, rivalidades e retrospectiva calculadas a partir das súmulas e votações | `src/lib/stats.ts` |
| Carrasco: quem te venceu mais do que perdeu pra você (mínimo 2 jogos contra) | `rivalries()` |
| Retrospectiva liberada em dezembro e janeiro | `wrappedAvailable()` |

**Permissões:** o presidente pode tudo. O organizador cuida de membros, notas, jogo e súmula. O tesoureiro cuida do caixa (confirmar pagamentos, lançar gastos, valores e Pix) e publica avisos. O membro confirma presença, vota, paga e edita o próprio perfil.

**Primeiro uso do caixa:** em Diretoria › Caixa › Configurar, cadastre a chave Pix e o saldo que já existe em caixa.

**Login:** nome + PIN de 4 números. Esqueceu o PIN? O presidente define um novo em Diretoria › Membros › editar jogador. Cada um troca o próprio PIN no Perfil.

**Avatares:** kit próprio de pixel art 32×32 do Real Marditos, desenhado por código em `src/lib/pixelAvatar.ts`, sem dependência externa: 8 tons de pele, 15 cabelos, 8 cores de cabelo, 8 olhos, 6 sobrancelhas, 9 bocas, 9 barbas, 5 óculos, 6 chapéus, 6 detalhes e 4 camisas (azul, branca, preta e goleiro).

**Cards do pódio:** 1º, 2º e 3º do ranking ganham card nas cores ouro, prata e bronze.

## Estrutura

```
supabase/schema.sql   tabelas, permissões e funções
supabase/seed.sql     jogadores e pontos iniciais
src/lib/              Supabase, login, sorteio, avatar, tipos
src/pages/            telas dos membros
src/pages/admin/      telas da diretoria
brand/                logos vetorizadas (SVG)
public/               ícones do app e logos em PNG
```
