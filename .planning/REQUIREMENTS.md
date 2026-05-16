# Requirements: BKO Agent

**Defined:** 2026-03-17
**Core Value:** Cada reclamacao tratada com conformidade regulatoria, artefatos rastreaveis, HITL obrigatorio, sem perder prazo

## v1 Requirements

### Database & Schema

- [ ] **DB-01**: Schema completo com ~35 entidades em 5 dominios (Operacao, Regulatorio, Orquestracao, Execucao, Memoria)
- [ ] **DB-02**: Tabelas de operacao: complaint, complaint_detail, complaint_history, complaint_attachment
- [ ] **DB-03**: Tabelas regulatorias: tipology, subtipology, situation, regulatory_rule, regulatory_action, persona, response_template, mandatory_info_rule
- [ ] **DB-04**: Tabelas de orquestracao: capability, capability_version, step_definition, step_transition_rule, skill_definition, step_skill_binding
- [ ] **DB-05**: Tabelas de execucao: ticket_execution, step_execution, artifact, llm_call, token_usage, human_review, audit_log
- [ ] **DB-06**: Tabelas de memoria: kb_document, kb_document_version, kb_chunk, case_memory, human_feedback_memory, style_memory
- [ ] **DB-07**: Extensao pgvector habilitada para busca vetorial
- [ ] **DB-08**: Seed data com tipologias, situacoes, regras regulatorias iniciais
- [ ] **DB-09**: Mock data injection a partir da planilha de reclamacoes

### Auth & RBAC

- [ ] **AUTH-01**: Usuario pode fazer login com email/senha
- [ ] **AUTH-02**: Sessao persiste entre refresh do navegador
- [ ] **AUTH-03**: Perfis segregados (operador, supervisor, admin)
- [ ] **AUTH-04**: RBAC controla acesso a funcionalidades por perfil

### Ticket Management

- [ ] **TICK-01**: Operador pode ver fila de reclamacoes com filtros (tipologia, SLA, status, risco, etapa atual)
- [ ] **TICK-02**: Operador pode ver detalhe do ticket (solicitacao, dados complementares, anexos, historico)
- [ ] **TICK-03**: Operador pode iniciar processamento de um ticket
- [ ] **TICK-04**: Sistema exibe SLA calculado e indicador de risco (no prazo, em risco, vencido)
- [ ] **TICK-05**: Operador pode ver todos os artefatos produzidos por ticket
- [ ] **TICK-06**: Operador pode ver logs de execucao por ticket

### Regulatory Orchestration

- [x] **ORCH-01**: Sistema calcula SLA automaticamente (10 dias aberta, 3 dias pedidos, 5 dias reaberta)
- [x] **ORCH-02**: Sistema classifica tipologia e subtipologia com apoio de regras e IA
- [x] **ORCH-03**: Sistema resolve situacao operacional (aberta, reaberta, vencida, em risco, pendente)
- [x] **ORCH-04**: Sistema decide acao regulatoria (responder, reclassificar, reencaminhar, cancelar)
- [x] **ORCH-05**: Sistema seleciona capability correta por tipologia + situacao
- [x] **ORCH-06**: Policy Validator verifica aderencia as regras do Manual antes de cada avanco
- [x] **ORCH-07**: Regras de reclassificacao, reencaminhamento e cancelamento seguem Manual Anatel
- [x] **ORCH-08**: Tratamento distinto para reclamacoes abertas vs reabertas vs pedidos regulatorios

### MCP Server / Capability Runtime

- [x] **MCP-01**: Registry de capabilities com versionamento
- [x] **MCP-02**: Step Engine interpreta fluxo e controla sequencia de etapas
- [x] **MCP-03**: Skill Router resolve qual skill executar em cada step
- [x] **MCP-04**: Execution Context Manager mantem contexto entre etapas
- [x] **MCP-05**: Artifact Store persiste output de cada step
- [x] **MCP-06**: Retry Manager permite reprocessar etapa individual
- [x] **MCP-07**: Execution Logger registra execucao tecnica completa
- [x] **MCP-08**: Operador pode avancar manualmente pelas etapas (step-by-step)

### Step Processor UI

- [x] **STEP-01**: Tela mostra execucao em etapas com botao "avancar"
- [x] **STEP-02**: Cada etapa exibe input, processamento e output (ArtifactViewer)
- [x] **STEP-03**: Etapas que exigem humano bloqueiam avanco automatico
- [x] **STEP-04**: Tela de demo com 4 colunas: dados ticket, etapa atual, artefato gerado, revisao humana

### Steps Designer

- [x] **DSGN-01**: Admin pode criar fluxo de steps por tipologia
- [x] **DSGN-02**: Admin pode criar variacao por situacao regulatoria
- [x] **DSGN-03**: Admin pode criar condicao por SLA
- [x] **DSGN-04**: Admin pode criar condicao por procedencia/improcedencia
- [x] **DSGN-05**: Admin pode criar desvio por nivel de risco
- [x] **DSGN-06**: Admin pode definir skills por etapa (binding)
- [x] **DSGN-07**: Admin pode definir modelo LLM por etapa
- [x] **DSGN-08**: Admin pode marcar etapa como "exige humano"
- [x] **DSGN-09**: Designer visual para criar/editar fluxos

### Skills Catalog

- [x] **SKLL-01**: LoadComplaintSkill — carrega dados da reclamacao
- [x] **SKLL-02**: NormalizeComplaintTextSkill — normaliza texto da reclamacao
- [x] **SKLL-03**: ComputeSlaSkill — calcula prazo regulatorio
- [x] **SKLL-04**: ClassifyTypologySkill — classifica tipologia com IA
- [x] **SKLL-05**: DetermineRegulatoryActionSkill — decide acao regulatoria
- [x] **SKLL-06**: ValidateReclassificationNeedSkill — valida necessidade de reclassificacao
- [x] **SKLL-07**: ValidateReencaminhamentoNeedSkill — valida necessidade de reencaminhamento
- [x] **SKLL-08**: ValidateCancelamentoNeedSkill — valida necessidade de cancelamento
- [x] **SKLL-09**: RetrieveManualContextSkill — recupera contexto do Manual Anatel
- [x] **SKLL-10**: RetrieveIQITemplateSkill — recupera template IQI por tipologia
- [x] **SKLL-11**: BuildMandatoryChecklistSkill — monta checklist de itens obrigatorios
- [x] **SKLL-12**: GenerateTreatmentArtifactSkill — gera artefato de tratamento
- [x] **SKLL-13**: ApplyPersonaToneSkill — aplica tom da persona na resposta
- [x] **SKLL-14**: DraftFinalResponseSkill — gera rascunho da resposta final
- [x] **SKLL-15**: ComplianceCheckSkill — avalia conformidade regulatoria
- [x] **SKLL-16**: HumanDiffCaptureSkill — captura diff entre IA e humano
- [x] **SKLL-17**: PersistMemorySkill — salva caso na memoria
- [x] **SKLL-18**: TrackTokenUsageSkill — registra consumo de tokens
- [x] **SKLL-19**: AuditTrailSkill — registra trilha de auditoria
- [x] **SKLL-20**: Cada skill registra: input, output, status, tempo, custo, modelo, versao prompt, versao template, erros

### AI Service

- [x] **AI-01**: Prompt Builder monta contexto por etapa (ticket, regras, template IQI, persona, memoria, checklist)
- [x] **AI-02**: Model Selector configuravel — pagina de cadastro de modelos por tipo de funcionalidade
- [x] **AI-03**: Estrategia multi-modelo (menor para classificacao, maior para composicao)
- [x] **AI-04**: Fallback configuravel entre modelos
- [x] **AI-05**: Complaint Parsing Agent extrai dados estruturados da reclamacao
- [x] **AI-06**: Draft Generator gera rascunho e artefatos intermediarios
- [x] **AI-07**: Compliance Evaluator avalia aderencia regulatoria e completude
- [x] **AI-08**: Final Response Composer consolida resposta final
- [x] **AI-09**: Token Usage Tracker captura consumo e custo por chamada
- [x] **AI-10**: Politica de temperatura por etapa

### Human-in-the-Loop (HITL)

- [x] **HITL-01**: Operador pode ver texto gerado pela IA
- [x] **HITL-02**: Operador pode editar texto e ver diff entre IA e humano
- [x] **HITL-03**: Operador pode preencher checklist regulatorio
- [x] **HITL-04**: Operador pode adicionar observacoes
- [x] **HITL-05**: Operador pode aprovar resposta final
- [x] **HITL-06**: Sistema persiste diff e motivo da correcao para aprendizado
- [x] **HITL-07**: Politica de HITL por risco (nivel de revisao varia por criticidade)

### Knowledge Base

- [x] **KB-01**: Ingestao do Manual Anatel (chunking + indexacao)
- [x] **KB-02**: Ingestao do Guia IQI por tipologia
- [x] **KB-03**: Busca vetorial para contexto textual (pgvector)
- [x] **KB-04**: Busca estruturada para regras e templates (SQL)
- [x] **KB-05**: Template Resolver por tipologia/situacao/desfecho
- [x] **KB-06**: Mandatory Info Resolver (itens obrigatorios por caso)
- [x] **KB-07**: Versionamento documental (documentos podem mudar ao longo do tempo)
- [x] **KB-08**: KB Manager no frontend (upload, versioning)

### Memory & Learning

- [x] **MEM-01**: Memoria de caso (reclamacao original, decisao, resposta final, desfecho)
- [x] **MEM-02**: Memoria de correcao humana (texto IA, texto humano, diff, motivo, tipo)
- [x] **MEM-03**: Memoria de estilo (tom por tipologia, construcoes preferidas, expressoes proibidas)
- [x] **MEM-04**: Busca de casos similares na nova execucao
- [x] **MEM-05**: Busca de correcoes humanas similares
- [x] **MEM-06**: Sugestao de padroes de resposta aprovados

### Personas

- [x] **PERS-01**: Cadastro governado de personas (nome, tipologia, formalidade, empatia, assertividade)
- [x] **PERS-02**: Persona define estrutura de resposta, expressoes obrigatorias e proibidas
- [x] **PERS-03**: Personas pre-configuradas: Cobranca (objetiva), Portabilidade (explicativa), Qualidade (empatica), Cancelamento (defensavel)

### Configuration & Admin

- [x] **CONF-01**: Cadastro de personas
- [x] **CONF-02**: Cadastro de templates de resposta
- [x] **CONF-03**: Cadastro de steps
- [x] **CONF-04**: Cadastro de skills
- [x] **CONF-05**: Cadastro de capabilities
- [x] **CONF-06**: Configuracao de modelos LLM (provider, modelo, custo, uso por funcionalidade)
- [x] **CONF-07**: Todas configuracoes editaveis sem recompilar aplicacao

### Observability & Audit

- [x] **OBS-01**: Logs por ticket (etapa, skill, duracao, status, erro, prompt id, modelo, tokens, custo)
- [x] **OBS-02**: Painel de tempo medio por etapa
- [x] **OBS-03**: Painel de custo medio por ticket
- [x] **OBS-04**: Painel de taxa de erro por skill
- [x] **OBS-05**: Painel de etapas com maior intervencao humana
- [x] **OBS-06**: Painel de tipologias com maior risco regulatorio
- [x] **OBS-07**: Painel de tokens e custos
- [x] **OBS-08**: Trace Explorer para debug ponta a ponta
- [x] **OBS-09**: Score de conformidade por ticket (aderencia, completude, linguagem, risco)

### Security & LGPD

- [x] **SEC-01**: Mascaramento de CPF/telefone no frontend
- [x] **SEC-02**: Segregacao de perfis (operador, supervisor, admin)
- [x] **SEC-03**: Redaction em logs de prompt (dados sensiveis)
- [x] **SEC-04**: Trilha de acesso auditavel
- [x] **SEC-05**: Versionamento de prompts e templates

### Artifacts

- [x] **ART-01**: Extracao estruturada do ticket
- [x] **ART-02**: Classificacao de tipologia
- [x] **ART-03**: Classificacao de situacao
- [x] **ART-04**: Decisao regulatoria
- [x] **ART-05**: Checklist de obrigatorios
- [x] **ART-06**: Evidencias do caso
- [x] **ART-07**: Template selecionado
- [x] **ART-08**: Rascunho de resposta
- [x] **ART-09**: Parecer de conformidade
- [x] **ART-10**: Diff humano
- [x] **ART-11**: Resposta final

## v2 Requirements — Operator Workflow

**Defined:** 2026-04-10
**Goal:** Simplificar UX para usuário final via bloco de notas e fluxo aprovar/reprovar/corrigir que alimenta training da IA. Remover dependência de tabelas externas (faturas/descontos) do pipeline.

### Schema & Data Model

- [ ] **SCHEMA-01**: Nova tabela `complaint_user_note` (id, complaintId, userId, content text, parameters jsonb, version int, createdAt, updatedAt) com FK para complaint e user
- [ ] **SCHEMA-02**: Migration adiciona campo `enrichedText` em complaint (computed: rawText + última nota ativa do operador)
- [ ] **SCHEMA-03**: Migration adiciona valores `rejected` e `corrected` no enum/status de human_review
- [ ] **SCHEMA-04**: Migration adiciona campo `rejectionReason` (text nullable) em human_review

### Pipeline Simplification

- [ ] **PIPE-01**: Pipeline reduzido para 14 steps (remove `retrieve_discounts` e `retrieve_invoices`)
- [ ] **PIPE-02**: Skill `LoadComplaint` lê última nota do operador e produz `enrichedText` no output
- [ ] **PIPE-03**: Skill `DraftFinalResponse` recebe nota do operador no contexto do prompt LLM
- [ ] **PIPE-04**: Tabelas `discount` e `invoice` mantidas no schema mas não consultadas pelo pipeline (preservação histórica para auditoria v1)
- [ ] **PIPE-05**: Skill `BuildMandatoryChecklist` não exige campos derivados de fatura/desconto

### Operator UI — Tela de Processamento

- [ ] **OPUI-01**: Rota `/processar` adicionada à sidebar para perfis OPERATOR, SUPERVISOR, ADMIN
- [ ] **OPUI-02**: Campo de busca aceita protocolo Anatel (15 dígitos) e protocolo interno (TRAINING-XXXX, ANT-XXXX-XXXX)
- [ ] **OPUI-03**: Após busca, exibe cabeçalho com: protocolo, tipologia (preliminar do banco), SLA, indicador de risco, texto original da reclamação
- [ ] **OPUI-04**: Bloco de notas com campos estruturados editáveis: plano contratado, valor cobrado, motivo declarado, data ocorrência
- [ ] **OPUI-05**: Bloco de notas com textarea livre para observação adicional
- [ ] **OPUI-06**: Operador pode salvar a nota como rascunho antes de iniciar processamento
- [ ] **OPUI-07**: Edições subsequentes da nota criam nova versão (histórico preservado, versão mais recente é ativa)
- [ ] **OPUI-08**: Botão "Iniciar Processamento" valida que pelo menos um campo da nota foi preenchido, persiste nota e chama `startExecution`
- [ ] **OPUI-09**: Durante processamento, mostra indicador de progresso (etapa atual + barra de progresso 0/14 → 14/14)

### Validation UI — Tela de Validação

- [ ] **VALUI-01**: Ao concluir o pipeline (paused_human), redireciona automaticamente para `/processar/:protocolo/validar`
- [ ] **VALUI-02**: Tela exibe rascunho IA em editor editável, score de conformidade, contexto usado (template, KB chunks, nota do operador)
- [ ] **VALUI-03**: Botão "Aprovar" usa rascunho atual como resposta final, marca human_review como `approved`, finaliza execução
- [ ] **VALUI-04**: Botão "Corrigir" salva texto editado + campo "razão da correção" obrigatório, marca human_review como `corrected`, finaliza execução
- [ ] **VALUI-05**: Botão "Reprovar" abre modal com campo "motivo da rejeição" obrigatório, marca human_review como `rejected`, cancela execução (status `cancelled`)
- [ ] **VALUI-06**: Após reprovação, operador pode reiniciar processamento com nota atualizada (nova execução)
- [ ] **VALUI-07**: Tela técnica multi-coluna (`/tickets/[id]/execution/[execId]`) restrita a ADMIN e SUPERVISOR

### Training Memory Integration

- [ ] **TRAIN-01**: Correção (texto editado + razão) persiste em `human_feedback_memory` com `feedbackType: 'correction'`, incluindo embedding do texto IA original
- [ ] **TRAIN-02**: Rejeição (motivo) persiste em `human_feedback_memory` com `feedbackType: 'rejection'`, incluindo embedding do texto IA rejeitado
- [ ] **TRAIN-03**: `MemoryRetrievalService.findSimilarFeedback` recupera correções/rejeições similares por embedding e tipologia
- [ ] **TRAIN-04**: Skill `DraftFinalResponse` injeta exemplos de correções aprovadas no prompt do LLM
- [ ] **TRAIN-05**: Admin pode listar feedbacks por tipologia em `/admin/feedback` (read-only audit)

### RBAC & Routing

- [ ] **RBAC-01**: Sidebar item `/processar` visível para OPERATOR, SUPERVISOR, ADMIN
- [ ] **RBAC-02**: Sidebar item `/tickets` (lista técnica atual) visível apenas para SUPERVISOR e ADMIN
- [ ] **RBAC-03**: Perfil OPERATOR tem `/processar` como rota inicial após login (em vez de `/tickets`)
- [ ] **RBAC-04**: Tela técnica de execução (`/tickets/[id]/execution/[execId]`) retorna 403 para perfil OPERATOR

### Token-Based Access

- [ ] **AUTH-TOKEN-01**: Tabela `access_token` (id, userId, token VARCHAR(64) único, expiresAt, lastUsedAt nullable, isActive, createdAt) com FK para user
- [ ] **AUTH-TOKEN-02**: Token gerado automaticamente ao criar usuário (UUID seguro, expiresAt = createdAt + TTL default)
- [ ] **AUTH-TOKEN-03**: Admin pode gerar novo token e revogar tokens em `/admin/tokens` (lista, botão "Novo Token", botão "Revogar")
- [ ] **AUTH-TOKEN-04**: Rota `/processar?token=XXX` valida token (existe, ativo, não expirado), cria sessão temporária, redireciona para `/processar` removendo token da URL
- [ ] **AUTH-TOKEN-05**: Token inválido/expirado retorna tela de erro com mensagem "Token expirado, contate o administrador"
- [ ] **AUTH-TOKEN-06**: `lastUsedAt` atualiza a cada acesso (telemetria de uso)
- [ ] **AUTH-TOKEN-07**: TTL default configurável (variável de ambiente `TOKEN_DEFAULT_TTL_DAYS`, default 30 dias) com override por token na criação

### Audit & Timing

- [ ] **AUDIT-TIMING-01**: Tabela `ticket_timing_event` (id, complaintId, executionId nullable, milestone VARCHAR, occurredAt, userId nullable) registrando eventos: `ticket_created`, `note_saved`, `execution_started`, `paused_human`, `decision_made`, `approved`, `completed`
- [ ] **AUDIT-TIMING-02**: Endpoint `GET /api/complaints/:id/timing` retorna métricas calculadas: tempo_total, tempo_sla, tempo_revisao_humana, tempo_nota_a_processamento, tempo_aprovacao_a_conclusao
- [ ] **AUDIT-TIMING-03**: Página `/admin/audit/timings` com tabela de tickets + tempos (filtros: tipologia, período, perfil de usuário)
- [ ] **AUDIT-TIMING-04**: Painel de observabilidade ganha métrica `human_review_avg_time` (tempo médio entre `paused_human` e `decision_made`)
- [ ] **AUDIT-TIMING-05**: Cada `ticket_timing_event` registra `userId` quando ação é humana (note_saved, decision_made, approved, completed); `userId` é null para eventos automáticos (execution_started, paused_human)

### Ticket Locking

- [ ] **LOCK-01**: Tabela `ticket_lock` (id, complaintId UNIQUE, userId, lockedAt, expiresAt) — constraint UNIQUE em complaintId garante 1 lock por ticket
- [ ] **LOCK-02**: Ao buscar ticket em `/processar`, sistema cria lock (TTL configurável, default 30min) se inexistente ou expirado; renova `expiresAt` em cada ação do mesmo usuário
- [ ] **LOCK-03**: Outro usuário tentando acessar ticket bloqueado vê mensagem "Ticket sendo tratado por {nome_usuario} desde {hora_relativa}" + botão para forçar (apenas SUPERVISOR/ADMIN)
- [ ] **LOCK-04**: Lock é liberado quando: (a) decisão final do operador (aprovar/corrigir/reprovar), (b) admin força liberação, (c) `expiresAt` ultrapassa `now()` sem renovação
- [ ] **LOCK-05**: Audit registra `responsavelFinal` no ticket = último userId que tomou ação (decisão final ou edição da nota)

## Future Requirements (v3+)

### Sandbox de Avaliacao

- **SAND-01**: Comparar IA x humano em lote
- **SAND-02**: Metricas de acuracia por tipologia

### Notificacoes

- **NOTF-01**: Alerta de SLA proximo do vencimento
- **NOTF-02**: Alerta de ticket em risco

### Integracao Real

- **INTG-01**: Integracao real com sistema Turbina
- **INTG-02**: Integracao com sistema de tickets Anatel

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile app | PoC de backoffice desktop-only |
| Integracao real Turbina | Apenas mock para PoC |
| Real-time chat | Fora do escopo de backoffice |
| Multi-tenant | PoC single-tenant |
| OAuth/SSO corporativo | Auth simples para PoC |
| Auto-aprovacao de respostas | HITL obrigatorio por compliance |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 1 | Complete |
| DB-02 | Phase 1 | Complete |
| DB-03 | Phase 1 | Complete |
| DB-04 | Phase 1 | Complete |
| DB-05 | Phase 1 | Complete |
| DB-06 | Phase 1 | Complete |
| DB-07 | Phase 1 | Complete |
| DB-08 | Phase 1 | Complete |
| DB-09 | Phase 1 | Complete |
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| TICK-01 | Phase 2 | Pending |
| TICK-02 | Phase 2 | Pending |
| TICK-03 | Phase 2 | Pending |
| TICK-04 | Phase 2 | Pending |
| TICK-05 | Phase 2 | Pending |
| TICK-06 | Phase 2 | Pending |
| ORCH-01 | Phase 3 | Complete |
| ORCH-02 | Phase 3 | Complete |
| ORCH-03 | Phase 3 | Complete |
| ORCH-04 | Phase 3 | Complete |
| ORCH-05 | Phase 3 | Complete |
| ORCH-06 | Phase 3 | Complete |
| ORCH-07 | Phase 3 | Complete |
| ORCH-08 | Phase 3 | Complete |
| MCP-01 | Phase 3 | Complete |
| MCP-02 | Phase 3 | Complete |
| MCP-03 | Phase 3 | Complete |
| MCP-04 | Phase 3 | Complete |
| MCP-05 | Phase 3 | Complete |
| MCP-06 | Phase 3 | Complete |
| MCP-07 | Phase 3 | Complete |
| MCP-08 | Phase 3 | Complete |
| AI-01 | Phase 4 | Complete |
| AI-02 | Phase 4 | Complete |
| AI-03 | Phase 4 | Complete |
| AI-04 | Phase 4 | Complete |
| AI-05 | Phase 4 | Complete |
| AI-06 | Phase 4 | Complete |
| AI-07 | Phase 4 | Complete |
| AI-08 | Phase 4 | Complete |
| AI-09 | Phase 4 | Complete |
| AI-10 | Phase 4 | Complete |
| KB-01 | Phase 4 | Complete |
| KB-02 | Phase 4 | Complete |
| KB-03 | Phase 4 | Complete |
| KB-04 | Phase 4 | Complete |
| KB-05 | Phase 4 | Complete |
| KB-06 | Phase 4 | Complete |
| KB-07 | Phase 4 | Complete |
| KB-08 | Phase 4 | Complete |
| SKLL-01 | Phase 5 | Complete |
| SKLL-02 | Phase 5 | Complete |
| SKLL-03 | Phase 5 | Complete |
| SKLL-04 | Phase 5 | Complete |
| SKLL-05 | Phase 5 | Complete |
| SKLL-06 | Phase 5 | Complete |
| SKLL-07 | Phase 5 | Complete |
| SKLL-08 | Phase 5 | Complete |
| SKLL-09 | Phase 5 | Complete |
| SKLL-10 | Phase 5 | Complete |
| SKLL-11 | Phase 5 | Complete |
| SKLL-12 | Phase 5 | Complete |
| SKLL-13 | Phase 5 | Complete |
| SKLL-14 | Phase 5 | Complete |
| SKLL-15 | Phase 5 | Complete |
| SKLL-16 | Phase 5 | Complete |
| SKLL-17 | Phase 5 | Complete |
| SKLL-18 | Phase 5 | Complete |
| SKLL-19 | Phase 5 | Complete |
| SKLL-20 | Phase 5 | Complete |
| ART-01 | Phase 5 | Complete |
| ART-02 | Phase 5 | Complete |
| ART-03 | Phase 5 | Complete |
| ART-04 | Phase 5 | Complete |
| ART-05 | Phase 5 | Complete |
| ART-06 | Phase 5 | Complete |
| ART-07 | Phase 5 | Complete |
| ART-08 | Phase 5 | Complete |
| ART-09 | Phase 5 | Complete |
| ART-10 | Phase 5 | Complete |
| ART-11 | Phase 5 | Complete |
| STEP-01 | Phase 6 | Complete |
| STEP-02 | Phase 6 | Complete |
| STEP-03 | Phase 6 | Complete |
| STEP-04 | Phase 6 | Complete |
| HITL-01 | Phase 6 | Complete |
| HITL-02 | Phase 6 | Complete |
| HITL-03 | Phase 6 | Complete |
| HITL-04 | Phase 6 | Complete |
| HITL-05 | Phase 6 | Complete |
| HITL-06 | Phase 6 | Complete |
| HITL-07 | Phase 6 | Complete |
| DSGN-01 | Phase 6 | Complete |
| DSGN-02 | Phase 6 | Complete |
| DSGN-03 | Phase 6 | Complete |
| DSGN-04 | Phase 6 | Complete |
| DSGN-05 | Phase 6 | Complete |
| DSGN-06 | Phase 6 | Complete |
| DSGN-07 | Phase 6 | Complete |
| DSGN-08 | Phase 6 | Complete |
| DSGN-09 | Phase 6 | Complete |
| MEM-01 | Phase 7 | Complete |
| MEM-02 | Phase 7 | Complete |
| MEM-03 | Phase 7 | Complete |
| MEM-04 | Phase 7 | Complete |
| MEM-05 | Phase 7 | Complete |
| MEM-06 | Phase 7 | Complete |
| PERS-01 | Phase 7 | Complete |
| PERS-02 | Phase 7 | Complete |
| PERS-03 | Phase 7 | Complete |
| CONF-01 | Phase 7 | Complete |
| CONF-02 | Phase 7 | Complete |
| CONF-03 | Phase 7 | Complete |
| CONF-04 | Phase 7 | Complete |
| CONF-05 | Phase 7 | Complete |
| CONF-06 | Phase 7 | Complete |
| CONF-07 | Phase 7 | Complete |
| OBS-01 | Phase 7 | Complete |
| OBS-02 | Phase 7 | Complete |
| OBS-03 | Phase 7 | Complete |
| OBS-04 | Phase 7 | Complete |
| OBS-05 | Phase 7 | Complete |
| OBS-06 | Phase 7 | Complete |
| OBS-07 | Phase 7 | Complete |
| OBS-08 | Phase 7 | Complete |
| OBS-09 | Phase 7 | Complete |
| SEC-01 | Phase 7 | Complete |
| SEC-02 | Phase 7 | Complete |
| SEC-03 | Phase 7 | Complete |
| SEC-04 | Phase 7 | Complete |
| SEC-05 | Phase 7 | Complete |
| SCHEMA-01 | Phase 8 | Pending |
| SCHEMA-02 | Phase 8 | Pending |
| SCHEMA-03 | Phase 8 | Pending |
| SCHEMA-04 | Phase 8 | Pending |
| PIPE-01 | Phase 8 | Pending |
| PIPE-02 | Phase 8 | Pending |
| PIPE-03 | Phase 8 | Pending |
| PIPE-04 | Phase 8 | Pending |
| PIPE-05 | Phase 8 | Pending |
| OPUI-01 | Phase 9 | Pending |
| OPUI-02 | Phase 9 | Pending |
| OPUI-03 | Phase 9 | Pending |
| OPUI-04 | Phase 9 | Pending |
| OPUI-05 | Phase 9 | Pending |
| OPUI-06 | Phase 9 | Pending |
| OPUI-07 | Phase 9 | Pending |
| OPUI-08 | Phase 9 | Pending |
| OPUI-09 | Phase 9 | Pending |
| RBAC-01 | Phase 9 | Pending |
| RBAC-02 | Phase 9 | Pending |
| RBAC-03 | Phase 9 | Pending |
| RBAC-04 | Phase 9 | Pending |
| VALUI-01 | Phase 10 | Pending |
| VALUI-02 | Phase 10 | Pending |
| VALUI-03 | Phase 10 | Pending |
| VALUI-04 | Phase 10 | Pending |
| VALUI-05 | Phase 10 | Pending |
| VALUI-06 | Phase 10 | Pending |
| VALUI-07 | Phase 10 | Pending |
| TRAIN-01 | Phase 10 | Pending |
| TRAIN-02 | Phase 10 | Pending |
| TRAIN-03 | Phase 10 | Pending |
| TRAIN-04 | Phase 10 | Pending |
| TRAIN-05 | Phase 10 | Pending |

**Coverage:**
- v1 requirements: 111 total — mapped to phases: 111 — unmapped: 0
- v2 requirements: 28 total — mapped to phases: 28 — unmapped: 0

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-05-06 after v2 roadmap creation*
