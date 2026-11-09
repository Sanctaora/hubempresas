# Colocando o Painel de Vendas no ar

Tudo fica na Vercel: o site, o banco de dados (Upstash Redis, grátis) e o login. Tempo: ~15 min.

## 1. GitHub
1. Entre em https://github.com/new → nome `lemcasa-vendas` → **Private** → **Create repository** (sem README).
2. Avise o Claude: ele envia o código para lá.

## 2. Vercel: criar o projeto
1. https://vercel.com/new → **Import** no repositório `lemcasa-vendas`.
2. Não mude nada (ela reconhece que é Vite) → **Deploy**. O primeiro deploy vai abrir o site, mas o login ainda não funciona, e isso é normal.

## 3. Vercel: ligar o banco
1. No projeto → aba **Storage** → **Create Database** → **Upstash** → **Upstash for Redis** → plano **Free** → região **São Paulo (gru1)** se aparecer.
2. Em "Connect to project", marque o `lemcasa-vendas` (todos os ambientes) → **Connect**.
   A Vercel cria sozinha as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN`.

## 4. Vercel: seu acesso de dono
Projeto → **Settings → Environment Variables** → adicione:

| Nome | Valor |
|---|---|
| `DONO_SENHA_INICIAL` | uma senha provisória qualquer. No primeiro login o painel pede para você criar a definitiva |

Seu usuário é `eduardo` (para usar outro, crie também `DONO_USUARIO`).
Depois: aba **Deployments** → no último, menu **⋯ → Redeploy**.

## 5. Primeiro uso
1. Abra o link do projeto (ex.: `lemcasa-vendas.vercel.app`) → entre com `eduardo` + `DONO_SENHA_INICIAL` → crie sua senha.
2. Menu **Equipe**: a equipe já vem preenchida (Renata, Michelli, Luna, Raquel, Milleny e Jane; o usuário é o nome em minúsculo).
   Em cada uma, clique **Criar acesso**. Aparece a senha de primeiro acesso com uma mensagem pronta: **Copiar mensagem** e mande pelo WhatsApp.
3. No primeiro login cada uma cria a própria senha.
4. Ainda em Equipe, ajuste os itens do **checklist** se quiser.
5. Menu **Listas → Subir lista**: escolha as planilhas (pode selecionar várias). Arquivo com o nome da vendedora (ex.: `Lista_Jane.xlsx`) vai direto para ela; os outros você escolhe para quem vai ou divide entre as 5.
   O nome do contato sai da coluna **Empresa**/Nome, e o telefone sai do **WhatsApp** (se vazio, do outro telefone). Subindo um arquivo só, dá para ajustar colunas e escolher o que a vendedora vê.

## Como funciona
- **Dono** (você): tudo, inclusive criar e desativar acessos.
- **Gerente**: sobe listas, acompanha, baixa Excel, edita o checklist e gera nova senha para vendedora que esquecer.
- **Vendedora**: vê só os contatos dela; marca checklist, situação, data de retorno e observação. Botão de WhatsApp direto no contato.
- A tela busca novidades sozinha a cada 3 minutos e quando a aba volta a ficar aberta (ou no botão **Atualizar**).
- Desativar uma pessoa (ou gerar senha nova) derruba na hora o login dela em todos os aparelhos.
- `.xls` antigo e `.ods` não são lidos: no Excel use **Salvar como → .xlsx**.

## Rodar no computador (opcional)
```bash
npm install
npm run dev
```
Sem o Redis, os dados ficam em `.dados-dev.json`. O usuário e a senha de dono vêm do `.env.local` (veja `.env.example`).
