# BKO Agent - Plataforma de Tratamento Regulatorio Anatel

## What This Is

Plataforma de backoffice para a TIM que automatiza o tratamento de reclamacoes regulatorias da Anatel, combinando orquestracao configuravel por steps/skills, motor de regras regulatorias, geracao assistida por LLM com human-in-the-loop, base de conhecimento (Manual Anatel + Guia IQI), memoria de casos/correcoes e trilha auditavel completa. A solucao nao substitui a decisao humana — ela apoia e acelera o tratamento mantendo conformidade regulatoria.

## Core Value

Cada reclamacao deve ser classificada, tratada segundo as regras do Manual Anatel, gerar artefatos rastreaveis por etapa, produzir resposta com validacao humana obrigatoria, e persistir trilha auditavel completa — sem jamais perder prazo regulatorio.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Frontend Backoffice**
- [ ] Dashboard executivo com metricas operacionais
- [ ] Fila de reclamacoes com filtros (tipologia, SLA, status, risco, etapa)
- [ ] Detalhe do ticket (solicitacao, dados complementares, anexos, historico)
- [ ] Processador step-by-step com botao "avancar" e artefatos por etapa
- [ ] Editor HITL (texto gerado, checklist regulatorio, diff IA vs humano, observacoes)
- [ ] Cadastro de personas, templates, steps, skills, capabilities
- [ ] Configuracao de modelos LLM por tipo de funcionalidade
- [ ] Painel de tokens/custos por ticket e por etapa
- [ ] Central de logs e auditoria
- [ ] KB Manager (upload e versionamento de documentos)

**API / BFF**
- [ ] Autenticacao e RBAC
- [ ] CRUD de tickets com paginacao e filtros
- [ ] Endpoints de execucao (start, advance-step, human-review, finalize)
- [ ] Endpoints de artefatos e logs por ticket
- [ ] APIs de cadastros (personas, templates, steps, skills, capabilities, LLMs)
- [ ] APIs de observabilidade (tokens, custos, metricas)

**Motor de Orquestracao Regulatoria**
- [ ] SLA Calculator por tipo e situacao
- [ ] Classificador de tipologia e subtipologia
- [ ] Resolver de situacao (aberta, reaberta, vencida, em risco)
- [ ] Decisor de acao regulatoria (responder, reclassificar, reencaminhar, cancelar)
- [ ] Seletor de capability por tipologia + situacao
- [ ] Policy Validator (regras do Manual antes do avanco)

**MCP Server / Runtime**
- [ ] Registry de capabilities versionadas
- [ ] Step Engine (interpreta fluxo e sequencia de etapas)
- [ ] Skill Router (resolve skill por step)
- [ ] Execution Context Manager (contexto entre etapas)
- [ ] Artifact Store (persiste outputs por step)
- [ ] Retry Manager (reprocessar etapa individual)

**Servico de IA**
- [ ] Prompt Builder (monta contexto por etapa: ticket, regras, template, persona, memoria)
- [ ] Model Selector configuravel (modelo por tipo de uso)
- [ ] Complaint Parsing Agent (extracao estruturada)
- [ ] Draft Generator (rascunho de resposta e artefatos)
- [ ] Compliance Evaluator (aderencia regulatoria)
- [ ] Final Response Composer
- [ ] Token Usage Tracker por chamada

**Base de Conhecimento (KB/RAG)**
- [ ] Ingestao documental (Manual Anatel, Guia IQI, planilhas)
- [ ] Indexacao vetorial com pgvector
- [ ] Recuperacao estruturada (regras, templates, obrigatoriedades)
- [ ] Template Resolver por tipologia/situacao
- [ ] Mandatory Info Resolver (itens obrigatorios por caso)
- [ ] Versionamento documental

**Memoria e Aprendizado**
- [ ] Memoria de caso (reclamacao, decisao, resposta, desfecho)
- [ ] Memoria de correcao humana (texto IA, texto final, diff, motivo)
- [ ] Memoria de estilo (tom por tipologia, expressoes aprovadas/proibidas)
- [ ] Similarity Matcher (busca casos semelhantes)

**Steps Designer**
- [ ] Criacao de fluxo por tipologia
- [ ] Variacao por situacao regulatoria
- [ ] Condicao por SLA e procedencia/improcedencia
- [ ] Desvio por nivel de risco
- [ ] Binding de skills por etapa
- [ ] Binding de modelo LLM por etapa
- [ ] Flag de etapa que exige humano

**Skills Catalog**
- [ ] 19 skills do documento (LoadComplaint, ClassifyTypology, ComputeSla, DetermineRegulatoryAction, RetrieveManualContext, RetrieveIQITemplate, BuildMandatoryChecklist, GenerateArtifact, ApplyPersonaTone, DraftFinalResponse, ComplianceCheck, HumanDiffCapture, PersistMemory, TrackTokenUsage, AuditTrail, ValidateReclassification, ValidateReencaminhamento, ValidateCancelamento, NormalizeComplaintText)
- [ ] Cada skill registra: input, output, status, tempo, custo, modelo, versao prompt, versao template, erros

**Observabilidade**
- [ ] Latencia por etapa
- [ ] Custo por ticket/etapa/modelo
- [ ] Taxa de erro por skill
- [ ] Taxa de intervencao humana
- [ ] Conformidade por tipologia
- [ ] Trace Explorer (debug ponta a ponta)

**Seguranca e LGPD**
- [ ] Mascaramento de CPF/telefone no front
- [ ] Segregacao de perfis
- [ ] Redaction em logs de prompt
- [ ] Trilha de acesso

**Dados e Persistencia**
- [ ] Schema completo (~35 entidades em 5 dominios)
- [ ] Mock data injection (planilha de reclamacoes)
- [ ] Mock do sistema Turbina (persistencia de respostas finais)

### Out of Scope

- Mobile app — web-first, PoC de backoffice desktop
- Integracao real com Turbina — apenas mock para PoC
- Real-time chat com consumidor — fora do escopo de backoffice
- Deploy multi-tenant — PoC single-tenant
- Autenticacao OAuth/SSO corporativa — auth simples para PoC

## Context

- Projeto para TIM Brasil, tratamento de reclamacoes regulatorias Anatel
- O Manual Anatel define prazos rigidos: 10 dias para reclamacao aberta, 3 dias para pedidos regulatorios, 5 dias para reaberta
- O Guia IQI fornece templates por tipologia com informacoes obrigatorias
- Existem 4 tipologias principais: Cobranca, Cancelamento, Portabilidade, Qualidade/Reparo
- 4 acoes regulatorias: Responder, Reclassificar, Reencaminhar, Cancelar
- Regras especificas para combo, portabilidade e fraude 0800
- O documento de arquitetura (37 paginas) detalha C4 ate nivel 3 de componentes
- Planilha de dados mock disponivel para injecao
- Servidor proprio disponivel: ssh root@72.61.52.70 com PostgreSQL

## Constraints

- **Tech Stack**: NestJS (backend), Next.js/React/Tailwind (frontend), PostgreSQL + pgvector (dados), Redis (cache/fila) — conforme documento de arquitetura
- **Infraestrutura**: Servidor dedicado em 72.61.52.70 com PostgreSQL
- **LLM**: Camada configuravel — pagina de cadastro de modelos por tipo de funcionalidade (classificacao, geracao, compliance check)
- **Regulatorio**: Conformidade com Manual Anatel e LGPD obrigatoria
- **HITL**: Revisao humana obrigatoria em toda resposta final (PoC nao permite auto-aprovacao)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Arquitetura completa (nao MVP) | Provar viabilidade da plataforma inteira na PoC | — Pending |
| NestJS no backend | Documento de arquitetura recomenda; aplicacao nova independente | — Pending |
| LLM provider-agnostic | Pagina de cadastro permite trocar modelos por funcionalidade sem recompilar | — Pending |
| PostgreSQL + pgvector | Busca vetorial e estruturada no mesmo banco; simplifica infra para PoC | — Pending |
| Aplicacao independente | Nao reutiliza servicos existentes do EngDB; codigo limpo | — Pending |

---
*Last updated: 2026-03-17 after initialization*
