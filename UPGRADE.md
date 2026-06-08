# Atualização BKO — guia de upgrade

> Última atualização: **2026-06-08**. Inclui: correção do import Turbina
> (dedup + alias Modalidade→tipologia), tela de Templates (nome da tipologia +
> filtro) e o re-map de dados das reclamações que estavam em "Outros".

Esta atualização tem **3 partes**: backend, frontend e um **re-map que roda 1
vez**. Façam na ordem.

## 1) Pegar o código novo

```bash
cd <pasta-do-repo>/bko
git pull origin main
```

## 2) Backend (alias Modalidade→tipologia + correção de import)

```bash
cd BKO-AI-Agent/backend
npm install
npm run build
pm2 restart bko-backend        # ou: docker compose restart / systemctl … (conforme o setup)
```

> O backend é iniciado via `nest start`, que recompila no boot. Numa máquina
> carregada o restart pode levar de alguns segundos a vários minutos antes da
> porta (3111) voltar. Não está travado — acompanhe com
> `ss -ltn | grep :3111`.

## 3) Frontend (tela de Templates: nome da tipologia + filtro)

```bash
cd ../../BKO-Console
npm install
npm run build
pm2 restart bko-console        # ou o nome do processo de vocês
```

## 4) Re-map dos dados — **rodar 1 vez**

Corrige as reclamações **já gravadas** que caíam no fallback "Outros" (antes do
alias existir). A partir da raiz do repo `bko`:

```bash
bash BKO-AI-Agent/backend/scripts/run-remap.sh
```

O script sozinho: lê as credenciais do `BKO-AI-Agent/backend/.env`, acha o
container do Postgres (`docker ps`) e roda o SQL — imprimindo
**preview → UPDATE (em transação) → distribuição final**. Ao final, a tipologia
**"Outros" deve estar zerada**.

### Variantes manuais (caso o script não sirva ao ambiente)

```bash
# Docker:
docker exec -i -e PGPASSWORD=<senha> <container_postgres> \
  psql -U <user> -d <db> \
  < BKO-AI-Agent/backend/scripts/remap-modalidade-tipologia.sql

# psql no host:
PGPASSWORD=<senha> psql -h <host> -p <port> -U <user> -d <db> \
  -f BKO-AI-Agent/backend/scripts/remap-modalidade-tipologia.sql
```

## Observações

- **Não há migration** (nenhuma mudança de schema) — não rodar `migration:run`.
- O re-map é **idempotente** (pode rodar 2x sem dano) e roda em transação.
- O mapa assume tipologias com as keys padrão `plano_servicos`, `qualidade`,
  `cobranca`, `atendimento`. Se o cadastro usar keys diferentes, essas
  Modalidades não são atualizadas (seguro, sem erro) — ajuste o mapa em
  `scripts/remap-modalidade-tipologia.sql`.
- Conferência final: abrir a tela **Templates** (deve mostrar o **nome** da
  tipologia + o **filtro**) e checar no banco que **"Outros" = 0**:

  ```sql
  SELECT COALESCE(t.label,'(sem tipologia)') AS tipologia, count(c.id)
  FROM complaint c LEFT JOIN tipology t ON c."tipologyId" = t.id
  GROUP BY 1 ORDER BY 2 DESC;
  ```

## O que mudou (resumo técnico)

| Área | Mudança |
|---|---|
| `backend` import Turbina | dedup de protocolo in-batch + insert tolerante a colisão (uma colisão não derruba mais o lote inteiro) |
| `backend` import Turbina | `MODALIDADE_TIPOLOGY_ALIAS`: roteia Modalidades verbosas da ANATEL para a tipologia com IQI |
| `backend` script | `scripts/remap-modalidade-tipologia.sql` + `scripts/run-remap.sh` |
| `frontend` Templates | mostra **nome** da tipologia (não o UUID) + **filtro** de tipologia na lista |
