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

- [ ] **ORCH-01**: Sistema calcula SLA automaticamente (10 dias aberta, 3 dias pedidos, 5 dias reaberta)
- [ ] **ORCH-02**: Sistema classifica tipologia e subtipologia com apoio de regras e IA
- [ ] **ORCH-03**: Sistema resolve situacao operacional (aberta, reaberta, vencida, em risco, pendente)
- [ ] **ORCH-04**: Sistema decide acao regulatoria (responder, reclassificar, reencaminhar, cancelar)
- [ ] **ORCH-05**: Sistema seleciona capability correta por tipologia + situacao
- [ ] **ORCH-06**: Policy Validator verifica aderencia as regras do Manual antes de cada avanco
- [ ] **ORCH-07**: Regras de reclassificacao, reencaminhamento e cancelamento seguem Manual Anatel
- [ ] **ORCH-08**: Tratamento distinto para reclamacoes abertas vs reabertas vs pedidos regulatorios

### MCP Server / Capability Runtime

- [ ] **MCP-01**: Registry de capabilities com versionamento
- [ ] **MCP-02**: Step Engine interpreta fluxo e controla sequencia de etapas
- [ ] **MCP-03**: Skill Router resolve qual skill executar em cada step
- [ ] **MCP-04**: Execution Context Manager mantem contexto entre etapas
- [ ] **MCP-05**: Artifact Store persiste output de cada step
- [ ] **MCP-06**: Retry Manager permite reprocessar etapa individual
- [ ] **MCP-07**: Execution Logger registra execucao tecnica completa
- [ ] **MCP-08**: Operador pode avancar manualmente pelas etapas (step-by-step)

### Step Processor UI

- [ ] **STEP-01**: Tela mostra execucao em etapas com botao "avancar"
- [ ] **STEP-02**: Cada etapa exibe input, processamento e output (ArtifactViewer)
- [ ] **STEP-03**: Etapas que exigem humano bloqueiam avanco automatico
- [ ] **STEP-04**: Tela de demo com 4 colunas: dados ticket, etapa atual, artefato gerado, revisao humana

### Steps Designer

- [ ] **DSGN-01**: Admin pode criar fluxo de steps por tipologia
- [ ] **DSGN-02**: Admin pode criar variacao por situacao regulatoria
- [ ] **DSGN-03**: Admin pode criar condicao por SLA
- [ ] **DSGN-04**: Admin pode criar condicao por procedencia/improcedencia
- [ ] **DSGN-05**: Admin pode criar desvio por nivel de risco
- [ ] **DSGN-06**: Admin pode definir skills por etapa (binding)
- [ ] **DSGN-07**: Admin pode definir modelo LLM por etapa
- [ ] **DSGN-08**: Admin pode marcar etapa como "exige humano"
- [ ] **DSGN-09**: Designer visual para criar/editar fluxos

### Skills Catalog

- [ ] **SKLL-01**: LoadComplaintSkill — carrega dados da reclamacao
- [ ] **SKLL-02**: NormalizeComplaintTextSkill — normaliza texto da reclamacao
- [ ] **SKLL-03**: ComputeSlaSkill — calcula prazo regulatorio
- [ ] **SKLL-04**: ClassifyTypologySkill — classifica tipologia com IA
- [ ] **SKLL-05**: DetermineRegulatoryActionSkill — decide acao regulatoria
- [ ] **SKLL-06**: ValidateReclassificationNeedSkill — valida necessidade de reclassificacao
- [ ] **SKLL-07**: ValidateReencaminhamentoNeedSkill — valida necessidade de reencaminhamento
- [ ] **SKLL-08**: ValidateCancelamentoNeedSkill — valida necessidade de cancelamento
- [ ] **SKLL-09**: RetrieveManualContextSkill — recupera contexto do Manual Anatel
- [ ] **SKLL-10**: RetrieveIQITemplateSkill — recupera template IQI por tipologia
- [ ] **SKLL-11**: BuildMandatoryChecklistSkill — monta checklist de itens obrigatorios
- [ ] **SKLL-12**: GenerateTreatmentArtifactSkill — gera artefato de tratamento
- [ ] **SKLL-13**: ApplyPersonaToneSkill — aplica tom da persona na resposta
- [ ] **SKLL-14**: DraftFinalResponseSkill — gera rascunho da resposta final
- [ ] **SKLL-15**: ComplianceCheckSkill — avalia conformidade regulatoria
- [ ] **SKLL-16**: HumanDiffCaptureSkill — captura diff entre IA e humano
- [ ] **SKLL-17**: PersistMemorySkill — salva caso na memoria
- [ ] **SKLL-18**: TrackTokenUsageSkill — registra consumo de tokens
- [ ] **SKLL-19**: AuditTrailSkill — registra trilha de auditoria
- [ ] **SKLL-20**: Cada skill registra: input, output, status, tempo, custo, modelo, versao prompt, versao template, erros

### AI Service

- [ ] **AI-01**: Prompt Builder monta contexto por etapa (ticket, regras, template IQI, persona, memoria, checklist)
- [ ] **AI-02**: Model Selector configuravel — pagina de cadastro de modelos por tipo de funcionalidade
- [ ] **AI-03**: Estrategia multi-modelo (menor para classificacao, maior para composicao)
- [ ] **AI-04**: Fallback configuravel entre modelos
- [ ] **AI-05**: Complaint Parsing Agent extrai dados estruturados da reclamacao
- [ ] **AI-06**: Draft Generator gera rascunho e artefatos intermediarios
- [ ] **AI-07**: Compliance Evaluator avalia aderencia regulatoria e completude
- [ ] **AI-08**: Final Response Composer consolida resposta final
- [ ] **AI-09**: Token Usage Tracker captura consumo e custo por chamada
- [ ] **AI-10**: Politica de temperatura por etapa

### Human-in-the-Loop (HITL)

- [ ] **HITL-01**: Operador pode ver texto gerado pela IA
- [ ] **HITL-02**: Operador pode editar texto e ver diff entre IA e humano
- [ ] **HITL-03**: Operador pode preencher checklist regulatorio
- [ ] **HITL-04**: Operador pode adicionar observacoes
- [ ] **HITL-05**: Operador pode aprovar resposta final
- [ ] **HITL-06**: Sistema persiste diff e motivo da correcao para aprendizado
- [ ] **HITL-07**: Politica de HITL por risco (nivel de revisao varia por criticidade)

### Knowledge Base

- [ ] **KB-01**: Ingestao do Manual Anatel (chunking + indexacao)
- [ ] **KB-02**: Ingestao do Guia IQI por tipologia
- [ ] **KB-03**: Busca vetorial para contexto textual (pgvector)
- [ ] **KB-04**: Busca estruturada para regras e templates (SQL)
- [ ] **KB-05**: Template Resolver por tipologia/situacao/desfecho
- [ ] **KB-06**: Mandatory Info Resolver (itens obrigatorios por caso)
- [ ] **KB-07**: Versionamento documental (documentos podem mudar ao longo do tempo)
- [ ] **KB-08**: KB Manager no frontend (upload, versioning)

### Memory & Learning

- [ ] **MEM-01**: Memoria de caso (reclamacao original, decisao, resposta final, desfecho)
- [ ] **MEM-02**: Memoria de correcao humana (texto IA, texto humano, diff, motivo, tipo)
- [ ] **MEM-03**: Memoria de estilo (tom por tipologia, construcoes preferidas, expressoes proibidas)
- [ ] **MEM-04**: Busca de casos similares na nova execucao
- [ ] **MEM-05**: Busca de correcoes humanas similares
- [ ] **MEM-06**: Sugestao de padroes de resposta aprovados

### Personas

- [ ] **PERS-01**: Cadastro governado de personas (nome, tipologia, formalidade, empatia, assertividade)
- [ ] **PERS-02**: Persona define estrutura de resposta, expressoes obrigatorias e proibidas
- [ ] **PERS-03**: Personas pre-configuradas: Cobranca (objetiva), Portabilidade (explicativa), Qualidade (empatica), Cancelamento (defensavel)

### Configuration & Admin

- [ ] **CONF-01**: Cadastro de personas
- [ ] **CONF-02**: Cadastro de templates de resposta
- [ ] **CONF-03**: Cadastro de steps
- [ ] **CONF-04**: Cadastro de skills
- [ ] **CONF-05**: Cadastro de capabilities
- [ ] **CONF-06**: Configuracao de modelos LLM (provider, modelo, custo, uso por funcionalidade)
- [ ] **CONF-07**: Todas configuracoes editaveis sem recompilar aplicacao

### Observability & Audit

- [ ] **OBS-01**: Logs por ticket (etapa, skill, duracao, status, erro, prompt id, modelo, tokens, custo)
- [ ] **OBS-02**: Painel de tempo medio por etapa
- [ ] **OBS-03**: Painel de custo medio por ticket
- [ ] **OBS-04**: Painel de taxa de erro por skill
- [ ] **OBS-05**: Painel de etapas com maior intervencao humana
- [ ] **OBS-06**: Painel de tipologias com maior risco regulatorio
- [ ] **OBS-07**: Painel de tokens e custos
- [ ] **OBS-08**: Trace Explorer para debug ponta a ponta
- [ ] **OBS-09**: Score de conformidade por ticket (aderencia, completude, linguagem, risco)

### Security & LGPD

- [ ] **SEC-01**: Mascaramento de CPF/telefone no frontend
- [ ] **SEC-02**: Segregacao de perfis (operador, supervisor, admin)
- [ ] **SEC-03**: Redaction em logs de prompt (dados sensiveis)
- [ ] **SEC-04**: Trilha de acesso auditavel
- [ ] **SEC-05**: Versionamento de prompts e templates

### Artifacts

- [ ] **ART-01**: Extracao estruturada do ticket
- [ ] **ART-02**: Classificacao de tipologia
- [ ] **ART-03**: Classificacao de situacao
- [ ] **ART-04**: Decisao regulatoria
- [ ] **ART-05**: Checklist de obrigatorios
- [ ] **ART-06**: Evidencias do caso
- [ ] **ART-07**: Template selecionado
- [ ] **ART-08**: Rascunho de resposta
- [ ] **ART-09**: Parecer de conformidade
- [ ] **ART-10**: Diff humano
- [ ] **ART-11**: Resposta final

## v2 Requirements

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
| DB-01 | Phase 1 | Pending |
| DB-02 | Phase 1 | Pending |
| DB-03 | Phase 1 | Pending |
| DB-04 | Phase 1 | Pending |
| DB-05 | Phase 1 | Pending |
| DB-06 | Phase 1 | Pending |
| DB-07 | Phase 1 | Pending |
| DB-08 | Phase 1 | Pending |
| DB-09 | Phase 1 | Pending |
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
| ORCH-01 | Phase 3 | Pending |
| ORCH-02 | Phase 3 | Pending |
| ORCH-03 | Phase 3 | Pending |
| ORCH-04 | Phase 3 | Pending |
| ORCH-05 | Phase 3 | Pending |
| ORCH-06 | Phase 3 | Pending |
| ORCH-07 | Phase 3 | Pending |
| ORCH-08 | Phase 3 | Pending |
| MCP-01 | Phase 3 | Pending |
| MCP-02 | Phase 3 | Pending |
| MCP-03 | Phase 3 | Pending |
| MCP-04 | Phase 3 | Pending |
| MCP-05 | Phase 3 | Pending |
| MCP-06 | Phase 3 | Pending |
| MCP-07 | Phase 3 | Pending |
| MCP-08 | Phase 3 | Pending |
| AI-01 | Phase 4 | Pending |
| AI-02 | Phase 4 | Pending |
| AI-03 | Phase 4 | Pending |
| AI-04 | Phase 4 | Pending |
| AI-05 | Phase 4 | Pending |
| AI-06 | Phase 4 | Pending |
| AI-07 | Phase 4 | Pending |
| AI-08 | Phase 4 | Pending |
| AI-09 | Phase 4 | Pending |
| AI-10 | Phase 4 | Pending |
| KB-01 | Phase 4 | Pending |
| KB-02 | Phase 4 | Pending |
| KB-03 | Phase 4 | Pending |
| KB-04 | Phase 4 | Pending |
| KB-05 | Phase 4 | Pending |
| KB-06 | Phase 4 | Pending |
| KB-07 | Phase 4 | Pending |
| KB-08 | Phase 4 | Pending |
| SKLL-01 | Phase 5 | Pending |
| SKLL-02 | Phase 5 | Pending |
| SKLL-03 | Phase 5 | Pending |
| SKLL-04 | Phase 5 | Pending |
| SKLL-05 | Phase 5 | Pending |
| SKLL-06 | Phase 5 | Pending |
| SKLL-07 | Phase 5 | Pending |
| SKLL-08 | Phase 5 | Pending |
| SKLL-09 | Phase 5 | Pending |
| SKLL-10 | Phase 5 | Pending |
| SKLL-11 | Phase 5 | Pending |
| SKLL-12 | Phase 5 | Pending |
| SKLL-13 | Phase 5 | Pending |
| SKLL-14 | Phase 5 | Pending |
| SKLL-15 | Phase 5 | Pending |
| SKLL-16 | Phase 5 | Pending |
| SKLL-17 | Phase 5 | Pending |
| SKLL-18 | Phase 5 | Pending |
| SKLL-19 | Phase 5 | Pending |
| SKLL-20 | Phase 5 | Pending |
| ART-01 | Phase 5 | Pending |
| ART-02 | Phase 5 | Pending |
| ART-03 | Phase 5 | Pending |
| ART-04 | Phase 5 | Pending |
| ART-05 | Phase 5 | Pending |
| ART-06 | Phase 5 | Pending |
| ART-07 | Phase 5 | Pending |
| ART-08 | Phase 5 | Pending |
| ART-09 | Phase 5 | Pending |
| ART-10 | Phase 5 | Pending |
| ART-11 | Phase 5 | Pending |
| STEP-01 | Phase 6 | Pending |
| STEP-02 | Phase 6 | Pending |
| STEP-03 | Phase 6 | Pending |
| STEP-04 | Phase 6 | Pending |
| HITL-01 | Phase 6 | Pending |
| HITL-02 | Phase 6 | Pending |
| HITL-03 | Phase 6 | Pending |
| HITL-04 | Phase 6 | Pending |
| HITL-05 | Phase 6 | Pending |
| HITL-06 | Phase 6 | Pending |
| HITL-07 | Phase 6 | Pending |
| DSGN-01 | Phase 6 | Pending |
| DSGN-02 | Phase 6 | Pending |
| DSGN-03 | Phase 6 | Pending |
| DSGN-04 | Phase 6 | Pending |
| DSGN-05 | Phase 6 | Pending |
| DSGN-06 | Phase 6 | Pending |
| DSGN-07 | Phase 6 | Pending |
| DSGN-08 | Phase 6 | Pending |
| DSGN-09 | Phase 6 | Pending |
| MEM-01 | Phase 7 | Pending |
| MEM-02 | Phase 7 | Pending |
| MEM-03 | Phase 7 | Pending |
| MEM-04 | Phase 7 | Pending |
| MEM-05 | Phase 7 | Pending |
| MEM-06 | Phase 7 | Pending |
| PERS-01 | Phase 7 | Pending |
| PERS-02 | Phase 7 | Pending |
| PERS-03 | Phase 7 | Pending |
| CONF-01 | Phase 7 | Pending |
| CONF-02 | Phase 7 | Pending |
| CONF-03 | Phase 7 | Pending |
| CONF-04 | Phase 7 | Pending |
| CONF-05 | Phase 7 | Pending |
| CONF-06 | Phase 7 | Pending |
| CONF-07 | Phase 7 | Pending |
| OBS-01 | Phase 7 | Pending |
| OBS-02 | Phase 7 | Pending |
| OBS-03 | Phase 7 | Pending |
| OBS-04 | Phase 7 | Pending |
| OBS-05 | Phase 7 | Pending |
| OBS-06 | Phase 7 | Pending |
| OBS-07 | Phase 7 | Pending |
| OBS-08 | Phase 7 | Pending |
| OBS-09 | Phase 7 | Pending |
| SEC-01 | Phase 7 | Pending |
| SEC-02 | Phase 7 | Pending |
| SEC-03 | Phase 7 | Pending |
| SEC-04 | Phase 7 | Pending |
| SEC-05 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 111 total
- Mapped to phases: 111
- Unmapped: 0

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-17 after roadmap creation*
