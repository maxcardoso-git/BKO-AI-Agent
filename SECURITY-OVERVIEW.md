# BKO Agent — Visão Geral de Segurança da Solução

**Documento:** Descrição técnica para avaliação pela área de segurança  
**Versão:** v2.0 — Milestone "Operator Workflow"  
**Data:** Maio de 2026  
**Responsável técnico:** TIM — Engenharia de Backoffice  

---

## 1. Contexto e Objetivo

O **BKO Agent** é uma plataforma interna de backoffice para automação do tratamento de reclamações regulatórias da Anatel. A solução é composta por:

- **Backend API** (NestJS / Node.js) — lógica de negócio, orquestração de pipeline de IA, persistência
- **Frontend Operacional** (Next.js) — interface para operadores, supervisores e administradores
- **Banco de dados** (PostgreSQL + pgvector) — dados operacionais e vetoriais para IA
- **Pipeline de IA** — integração com LLMs via Anthropic/OpenAI para geração assistida de resposta

A solução é **interna** — não possui acesso público e opera exclusivamente em rede corporativa.

---

## 2. Arquitetura de Autenticação e Autorização

### 2.1 Fluxo Principal de Login (SUPERVISOR / ADMIN)

```
Usuário → POST /api/auth/login (email + senha)
        → Validação de credenciais + hash bcrypt
        → Emissão de JWT assinado (RS256 ou HS256)
        → JWT armazenado no cliente (Zustand + cookies de sessão)
        → Todas as requisições subsequentes: Bearer {JWT}
```

**Tokens JWT:**
- Assinados com segredo via variável de ambiente (`JWT_SECRET`)
- Expiração configurável (padrão: 1 hora)
- Payload: `{ sub: userId, role: UserRole, iat, exp }`
- Estratégia: `JwtStrategy` verifica o JWT e busca o usuário no banco a cada requisição (garante revogação por `isActive = false`)

### 2.2 Fluxo de Token Opaco para Operadores

Operadores de campo (role `OPERATOR`) não utilizam login com senha. Recebem um **token opaco de acesso pessoal** gerado pelo ADMIN:

```
ADMIN → POST /api/admin/access-tokens/generate { userId, ttlDays? }
      → Gera token: crypto.randomBytes(32).toString('hex') (64 chars hex)
      → Armazena hash na tabela access_token com expiresAt e isActive
      → ADMIN copia o token e envia ao operador (exibido UMA ÚNICA VEZ)

Operador → Acessa URL /processar?token=<opaque_token>
         → Frontend chama POST /api/auth/token-exchange { token }
         → Backend valida: isActive + expiresAt > now + atualiza lastUsedAt
         → Retorna JWT padrão
         → Frontend armazena JWT e redireciona para /processar (sem token na URL)
```

**Propriedades de segurança do token opaco:**
- 256 bits de entropia (32 bytes aleatórios = 64 chars hexadecimais)
- Única exibição: mostrado apenas no momento da geração via modal "Copiar"
- TTL configurável (padrão: 30 dias); pode ser revogado individualmente
- `lastUsedAt` atualizado a cada uso para auditoria
- Endpoint `/api/auth/token-exchange` é público (`@Public()`) mas rate-limiting aplicável

### 2.3 RBAC (Role-Based Access Control)

Três papéis com permissões distintas:

| Role | Acesso |
|------|--------|
| `OPERATOR` | `/processar` apenas: buscar protocolo, tomar lock, preencher nota, iniciar pipeline |
| `SUPERVISOR` | Tudo do OPERATOR + `/tickets` (fila), `/admin/locks` (gerenciar bloqueios) |
| `ADMIN` | Tudo do SUPERVISOR + `/admin/tokens` (emitir/revogar tokens), configurações de sistema |

**Implementação no backend:**
- `JwtAuthGuard` como `APP_GUARD` global — todas as rotas protegidas por padrão
- `RolesGuard` como `APP_GUARD` global — verifica `@Roles()` decorator
- `@Public()` decorator para opt-out explícito (usado apenas em `/auth/login` e `/auth/token-exchange`)
- Endpoints técnicos de pipeline (`GET /executions/:id/steps`) restritos a `SUPERVISOR` e `ADMIN`

**Implementação no frontend:**
- Middleware Next.js verifica cookies de sessão (`bko-session`, `bko-role`)
- Hook `useRequireAuth(roles)` redireciona client-side para `/unauthorized`
- Sidebar filtra itens de menu por role do usuário autenticado

---

## 3. Proteção de Dados em Trânsito e em Repouso

### 3.1 Em Trânsito
- Toda comunicação entre frontend e backend via HTTPS (TLS) em produção
- Tokens JWT transmitidos via header `Authorization: Bearer` (não em query string)
- Token opaco trafega somente no primeiro acesso via URL (`?token=`); após exchange, é removido da URL e nunca mais exposto

### 3.2 Em Repouso
- Senhas de usuário armazenadas com `bcrypt` (salt rounds: 10)
- Tokens opacos armazenados como texto plano no banco (necessário para comparação direta — não hashável sem troca do protocolo de validação)
- JWTs não armazenados no servidor; stateless
- Dados do banco PostgreSQL em servidor dedicado (72.61.52.70:5433), acesso via credenciais de serviço, não expostas ao frontend

### 3.3 Dados Sensíveis
- Conteúdo de reclamações (texto livre com possíveis dados pessoais — LGPD)
- Números de protocolo Anatel
- Logs de auditoria com timestamps e userId (append-only, sem deleção)
- Nenhum dado de cartão/pagamento processado pela plataforma

---

## 4. Controle de Acesso a Recursos

### 4.1 Ticket Lock (Bloqueio de Ticket)

Mecanismo de controle de concorrência para evitar que dois operadores tratem o mesmo ticket simultaneamente:

- `POST /api/complaints/:id/lock` — adquire bloqueio (TTL: 15 minutos)
- Implementação: `DELETE + INSERT` transacional na tabela `ticket_lock` (unique constraint em `complaintId`)
- 409 Conflict retornado se ticket já bloqueado por outro usuário (com nome do bloqueante para exibição)
- `POST /api/complaints/:id/lock/renew` — renova bloqueio (chamado automaticamente pelo frontend a cada 10 minutos)
- `DELETE /api/complaints/:id/lock/force` — forçar liberação (apenas `SUPERVISOR` / `ADMIN`)
- `GET /api/admin/locks` — lista todos os locks ativos (apenas `SUPERVISOR` / `ADMIN`)

### 4.2 Notas do Operador (Bloco de Notas)

- `POST /api/complaints/:id/notes` — salva nota do operador
- Implementação transacional: desativa versão anterior (`isActive = false`) e insere nova versão
- Histórico completo de notas preservado (imutável)
- Nota ativa injetada no contexto do LLM para geração de resposta

### 4.3 Isolamento de Endpoints Técnicos

- Visão técnica do pipeline de execução (steps, artefatos de IA, chamadas LLM) restrita a `SUPERVISOR` e `ADMIN`
- `OPERATOR` não consegue acessar logs internos do pipeline, tokens de custo de LLM, nem configurações

---

## 5. Validação e Prevenção de Injeção

- **SQL Injection:** TypeORM com QueryBuilder parametrizado; campos de ordenação validados via whitelist (`allowedSortFields`) antes de interpolação
- **Input Validation:** `ValidationPipe` global com `transform: true` no NestJS; DTOs com class-validator decorators
- **UUID Validation:** `ParseUUIDPipe` em todos os parâmetros de rota UUID — rejeita entradas malformadas com 400
- **XSS:** Dados de usuário renderizados via React (escaping automático); conteúdo de reclamações renderizado como texto, não HTML
- **CORS:** Configurado explicitamente no NestJS com origens permitidas (apenas frontend interno)

---

## 6. Auditoria e Rastreabilidade

- **audit_log:** Tabela append-only com `entityType`, `entityId`, `action`, `userId`, `metadata`, `timestamp` — registra todas as ações sensíveis
- **llm_call:** Registro de cada chamada ao LLM com modelo, custo estimado, step de execução
- **token_usage:** Custo de tokens por ticket e por etapa
- **ticket_timing_event:** Timestamps de eventos do ciclo de vida do ticket (criação, lock, início pipeline, notas, etc.)
- **step_execution:** Estado de cada etapa do pipeline com status, artefatos e retentativas

Todos os logs são associados a um `userId` (traçabilidade por operador).

---

## 7. Infraestrutura e Deploy

| Componente | Tecnologia | Porta | Exposição |
|---|---|---|---|
| Backend API | NestJS + PM2 | 3111 | Interna (nginx proxy) |
| Frontend | Next.js | 3000 | Interna (nginx) |
| Banco de Dados | PostgreSQL 15 + pgvector | 5433 | Apenas backend |
| LLM Provider | Anthropic Claude / OpenAI | HTTPS externo | Apenas backend |

**Variáveis de ambiente sensíveis** (não commitadas, gerenciadas via `.env`):
- `DATABASE_URL` — connection string PostgreSQL
- `JWT_SECRET` — segredo de assinatura JWT
- `SESSION_SECRET` — segredo de criptografia de sessão
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` — chaves de API LLM

---

## 8. Considerações e Recomendações

| Tópico | Status | Recomendação |
|--------|--------|-------------|
| HTTPS/TLS | A implementar em produção | Configurar via nginx + certificado interno |
| Rate Limiting | A implementar | Adicionar `@nestjs/throttler` nos endpoints de auth |
| Token opaco (hash) | Armazenado em claro | Considerar armazenar hash SHA-256 do token (não afeta UX) |
| Rotação de JWT_SECRET | Manual atualmente | Implementar rotação periódica ou usar RS256 com par de chaves |
| MFA | Não implementado | Avaliar para role ADMIN em acessos ao painel de configuração |
| Penetration Testing | Não realizado | Recomendado antes de expansão de acesso |
| Dados pessoais em logs | `rawText` pode conter PII | Avaliar mascaramento em `audit_log.metadata` (LGPD Art. 6) |
| Sessão de token opaco | TTL fixo de 30 dias | Avaliar TTL mais curto (7 dias) para maior segurança |

---

## 9. Contato Técnico

Para dúvidas sobre a arquitetura ou revisão do código-fonte, contatar a equipe de Engenharia de Backoffice da TIM.

---

*Este documento reflete o estado da plataforma em Maio de 2026 (v2.0 — Milestone Operator Workflow). Atualizações devem ser solicitadas a cada nova versão com mudanças de segurança relevantes.*
