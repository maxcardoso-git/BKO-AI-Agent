-- ============================================================================
-- Re-map: "Modalidade" verbosa da ANATEL  ->  tipologia interna (com IQI/persona)
-- ============================================================================
--
-- CONTEXTO
--   O importador casava Modalidade -> tipologia por igualdade EXATA de label,
--   entao Modalidades com descricao verbosa caiam no fallback "Outros" (sem
--   template IQI especifico). O importador ja foi corrigido (alias) para os
--   novos imports; ESTE script corrige as reclamacoes JA GRAVADAS no banco.
--
-- O QUE FAZ
--   Atualiza complaint."tipologyId" (e slaBusinessDays) das reclamacoes cujas
--   Modalidades estao no mapa abaixo, apontando para a tipologia correta.
--   IDEMPOTENTE: so altera linhas que ainda nao estao na tipologia certa, e
--   so se a tipologia de destino existir (mesmas keys do cadastro padrao:
--   plano_servicos, qualidade, cobranca, atendimento). Rodar 2x nao causa dano.
--
-- COMO RODAR (na VPS, dentro do container do Postgres):
--   docker exec -i -e PGPASSWORD=<senha> <container_postgres> \
--     psql -U <db_user> -d <db_name> -f - < remap-modalidade-tipologia.sql
--
-- SEGURO: o UPDATE roda em transacao. Confira o PREVIEW (passo 1) antes de
--   confiar no resultado; se algo parecer errado, e so nao deixar commitar.
-- ============================================================================

SET client_encoding TO 'UTF8';

\echo '== (1) PREVIEW: quantas reclamacoes seriam re-mapeadas por Modalidade =='
WITH alias(modalidade, tkey) AS (VALUES
  ('Plano de serviços, Oferta, Bônus, Promoções e Mensagens Publicitárias','plano_servicos'),
  ('Qualidade, Funcionamento e Reparo','qualidade'),
  ('Bloqueio, desbloqueio ou Suspensão','cobranca'),
  ('Instalação ou Ativação ou Habilitação','qualidade'),
  ('Dados cadastrais ou número da linha','atendimento'),
  ('Ressarcimento','cobranca'),
  ('Crédito Pré-pago','cobranca')
)
SELECT a.modalidade, t.label AS destino, count(c.id) AS a_atualizar
FROM alias a
JOIN tipology t ON t.key = a.tkey
LEFT JOIN complaint c ON c.modalidade = a.modalidade AND c."tipologyId" IS DISTINCT FROM t.id
GROUP BY a.modalidade, t.label
ORDER BY a_atualizar DESC;

\echo '== (2) UPDATE (em transacao) =='
BEGIN;
WITH alias(modalidade, tkey) AS (VALUES
  ('Plano de serviços, Oferta, Bônus, Promoções e Mensagens Publicitárias','plano_servicos'),
  ('Qualidade, Funcionamento e Reparo','qualidade'),
  ('Bloqueio, desbloqueio ou Suspensão','cobranca'),
  ('Instalação ou Ativação ou Habilitação','qualidade'),
  ('Dados cadastrais ou número da linha','atendimento'),
  ('Ressarcimento','cobranca'),
  ('Crédito Pré-pago','cobranca')
)
UPDATE complaint c
SET "tipologyId" = t.id, "slaBusinessDays" = t."slaBusinessDays"
FROM alias a JOIN tipology t ON t.key = a.tkey
WHERE c.modalidade = a.modalidade
  AND c."tipologyId" IS DISTINCT FROM t.id;
COMMIT;

\echo '== (3) VERIFICACAO: distribuicao final por tipologia (Outros deve zerar) =='
SELECT COALESCE(t.label, '(sem tipologia)') AS tipologia, count(c.id) AS n
FROM complaint c LEFT JOIN tipology t ON c."tipologyId" = t.id
GROUP BY 1 ORDER BY 2 DESC;
