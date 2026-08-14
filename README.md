# AI Agent Workflow Builder

A full-stack, multi-tenant AI workflow orchestration platform inspired by tools like **n8n**, but purpose-built for chaining **AI-agent steps**.  
Built with **Nhost + Hasura + PostgreSQL + GraphQL**, a **Next.js/React frontend**, and a **Python backend execution service**.

---

## 🚀 Features

- Create and edit AI workflows
- Add and reorder workflow steps
- Attach manual and event-driven triggers
- Execute workflows through secured API boundaries
- Call LLM providers (e.g., Groq)
- Call external HTTP APIs
- Branch execution based on outputs
- Persist workflow results
- Pause/resume execution at approval gates
- Live step execution via GraphQL subscriptions
- Monitor organization usage/quota

---


---

## ⚙️ Tech Stack

**Frontend**
- Next.js 15
- React + TypeScript
- Nhost Authentication
- GraphQL
- CSS / App Router

**Backend**
- Python + FastAPI
- Workflow Execution Engine
- Hasura GraphQL Integration

**Data / Infra**
- Nhost
- Hasura GraphQL Engine
- PostgreSQL

---

## 📚 Core Domain Model

- **Organization**
  - Members (owner, editor, viewer)
  - Workflows
    - Workflow Steps
    - Workflow Triggers
    - Workflow Runs → Step Runs

---

## 🔑 Workflow Step Types

- `llm_call` → Call LLM provider
- `http_request` → Outbound HTTP request
- `db_write` → Persist results (owner-only)
- `notify` → External notification (owner-only)
- `conditional_branch` → Branch execution
- `approval_gate` → Pause until approval

---

## 🔒 Authorization Model

- **Layer 1 — Organization + Role**
  - Owner → Full control
  - Editor → Create/edit workflows, approve steps
  - Viewer → Read-only

- **Layer 2 — Step-Level Authorization**
  - Sensitive steps (`db_write`, `notify`, `webhook`) restricted to owners
  - Approval checked at execution time

---

## ▶️ Workflow Execution

1. Authenticate user
2. Verify org membership + role
3. Check quota
4. Create workflow run
5. Execute steps sequentially
6. Pause at approval gates
7. Resume after approval
8. Persist run state
9. Update usage counters

---

## 📡 GraphQL Operations

- **Queries** → Workflows, steps, triggers, latest run status
- **Mutations** → Create/edit workflows, steps, triggers
- **Approval Mutation** → Approve paused steps
- **Subscriptions** → Live step run updates

---

## 🔔 Triggers

- Manual (UI Run button)
- Webhook (Hasura Action)
- Scheduled (cron-like)
- Database Event (Hasura Event Trigger)

---

## 🖥️ Frontend Features

- Nhost authentication
- Organization-aware workflow builder
- Step + trigger management
- Workflow execution + run history
- Live step status
- Approval UI
- Usage/quota display

---

## 🛠️ Local Development

### Prerequisites
- Node.js 20+
- Python 3.10+
- Nhost project
- Hasura/PostgreSQL
- LLM provider API key

### Setup

```bash
git clone https://github.com/Namuu01/ai-agent-workflow-builder.git
cd ai-agent-workflow-builder
