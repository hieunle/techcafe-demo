# DN TechCafe 04_04_26 — Speaker notes

**Vietnamese version:** [DN-TechCafe-04-04-26-speaker-notes-vi.md](./DN-TechCafe-04-04-26-speaker-notes-vi.md)

**Deck:** *Copy of DN TechCafe 04_04_26 - New Master Slide.pptx* (PDF export)  
**Theme:** From ideas to impact — how software is evolving in the AI era (KMS TechCafe)  
**Your focus segments:** Agent instructions (prompting), multi-agent orchestration, RAG, and how they fit real products.

Use this doc as **bullet key points** for the room and **extended script** for rehearsal or a long-form version of the same story.

---

## How to use this document

| Section | Use when |
|--------|-----------|
| **Key points by slide** | On stage / presenter view — scan between slides |
| **Extended script** | Full narration, dry run, or sharing as a written companion |
| **Deep dives** | If audience asks “how do we actually build this?” |
| **Q&A bank** | Prep for technical and product questions |

---

## Opening hook (before / alongside slide 1)

### Key points

- Software is shifting from **screens and forms** to **goal-seeking systems** that reason, remember, call tools, and coordinate with each other.
- Today we’ll use a simple mental model: **agent = small operating system** — not “a smarter chatbot,” but a loop of **instructions + model + memory + tools + guardrails + structured output**.
- We’ll connect that to **how you prompt** (especially in multi-agent setups) and **how RAG** grounds answers in *your* data.

### Extended script (≈1–2 min)

> Good [morning/afternoon], everyone. Thanks for being here at KMS TechCafe.  
>  
> A lot of teams are experimenting with “AI features” right now. What’s changing is the *shape* of the software we ship. We’re moving from interfaces that only react when you click, to systems that can **pursue a goal** — clarify intent, use APIs and files, remember context, and sometimes **hand work to another specialized agent**.  
>  
> In the next few minutes I want to give you a **practical frame** for that shift — not buzzwords. We’ll look at the **six components** every serious agent stack has, **how to write instructions** so behavior is predictable, **how RAG** connects models to private knowledge, and **how multiple agents** are orchestrated without chaos.  
>  
> The goal is simple: when you leave, you can explain to your team *why* “be professional” is a bad instruction, and *why* retrieval beats fine-tuning for most internal knowledge use cases.

---

## Slide 2 — Table of contents

### Key points

- **What** agentic software is (definition + analogy).
- **Components** that make it work.
- **Modern landscape** — tools, MCP, memory, RAG, orchestration, guardrails, skills.
- **Q&A** then **closing**.

### Extended script (≈30 s)

> Here’s the roadmap. We’ll define agents, unpack the stack, then connect to what’s shipping in the industry today — including how we keep these systems safe and observable. We’ll leave plenty of time for questions at the end.

---

## Slide 3 — What is an agent?

### Key points

- **Definition:** Systems that use AI to **pursue goals** and **complete tasks** — not just generate text.
- **Analogy:** An agent is like **a person in an organization** — collaborates with others toward a shared outcome.
- **Implication:** Design matters — **roles, handoffs, and accountability** — same as org design.

### Extended script (≈1 min)

> When we say “agent,” we mean software that can **loop**: observe something, decide what to do, **act** through tools, and update its plan.  
>  
> That’s different from a one-shot completion. A classic chatbot mostly *responds*. An agent *tries to finish something* — sometimes over many steps.  
>  
> I like the org analogy: one agent might be great at research, another at formatting, another at calling your internal APIs. Your job as builders is to give each one a **clear mandate** and **safe boundaries**, just like you would for people on a team.

---

## Slide 4 — Agentic software: six core components

### Key points

1. **Instructions** — System prompt: persona, rules, goals (this is *prompting* in production).
2. **LLM model** — Reasoning engine (GPT, Claude, Gemini, Llama, …); **model choice = cost, latency, quality trade-off**.
3. **Memory** — Short + long horizon: conversation, semantic recall, durable summaries.
4. **Tools** — APIs, files, DBs — **ground truth** and **side effects** live here, not in the model weights.
5. **Guardrails** — Input/output validation; reduces abuse, leakage, and bad actions.
6. **Output** — JSON / Zod / schema — **machine-readable** handoff to the rest of your app.

**Line to land:** *“Think of it as a complete operating system — if you remove one layer, the system gets fragile fast.”*

### Extended script (≈2–3 min)

> Let’s make this concrete. Every production agent I’ve seen ends up with **six layers**.  
>  
> **Instructions** are not “flavor text.” They are the **contract** for behavior: who you are, what success looks like, what you must never do, and how outputs should look. We’ll dig into good vs bad instructions on the next slide.  
>  
> The **model** is the engine. Same instructions on two models can behave very differently — so you tune **instructions + model + tools** together, not in isolation.  
>  
> **Memory** fixes the fact that context windows are finite. Without memory strategy, long tasks **forget the goal** halfway through. We’ll come back to working vs semantic vs observational memory.  
>  
> **Tools** are how agents touch reality: CRM, search, file systems, databases. This is also where **permissions** and **auditing** matter — the model proposes; your code executes.  
>  
> **Guardrails** are the safety and policy layer — PII, injection, toxic content, and **tool-call approval** for destructive actions.  
>  
> Finally **structured output**: if downstream code expects JSON, say so explicitly. Unstructured prose is expensive to parse and brittle in production.  
>  
> **Key insight:** these six pieces **compose**. Weak instructions break everything else; great tools can’t fix ambiguous goals.

---

## Slide 5 — Define agent instruction (BAD vs GOOD)

### Key points — BAD instruction

- Example: *“You are an AI assistant. Help the user with their tasks. Be thorough and professional.”*
- **Problems:** (1) No real role, (2) subjective words (*thorough*, *professional*), (3) no constraints, (4) no output shape.
- **Impact:** Unpredictable behavior, inconsistent UX, **harder testing**, and **security risk** (agent improvises scope).

### Key points — GOOD instruction

- Structure: **Role → Task → Boundaries → Output** (and often **escalation**).
- Example from deck: Python security reviewer → JSON with severity, location, risk, fix.
- **Practices:** Clear role, **verifiable** output format, explicit **can/cannot**, **when to stop or escalate**.

**Speaker tip:** Tie to **cleaning-company / internal ops** example if your audience is not security engineers — same structure, different domain.

### Extended script (≈3–4 min)

> This is the slide I want you to photograph.  
>  
> **Bad instructions** feel polite but they’re actually **underspecified**. “Be thorough” — thorough *how*? For *which* user? Under *what* compliance rules? “Professional” isn’t a testable requirement. Your QA team can’t assert “professionalness” in a unit test.  
>  
> Worse, without boundaries, the model **fills gaps** with guesses. That’s where hallucinations and policy violations creep in — not because the model is “evil,” but because **you didn’t fence the playground**.  
>  
> **Good instructions** read more like a **spec**.  
>  
> - **Role:** narrow expertise — *you are X, not Y*.  
> - **Task:** the job-to-be-done in one sentence.  
> - **Boundaries:** explicit negatives — *do not execute code*, *do not invent discounts not in the policy doc*.  
> - **Output:** a shape you can validate — JSON fields, bullet order, required sections.  
>  
> Add **escalation**: *if confidence is low, or the user asks out-of-scope, say so and stop* — that’s how you make automation **auditable**.  
>  
> **Multi-agent note:** In a supervisor or pipeline setup, **each agent needs its own tight instruction**. The supervisor’s job is often *routing and aggregation*, not “do everything.” If every sub-agent has vague instructions, you get **telephone game** failures — context dilutes at every hop.

### Multi-agent prompting (research-backed practices to mention)

- **One job per agent:** Smaller prompts + fewer tools per agent → more reliable tool selection. Anthropic’s engineering guidance emphasizes **simple, composable patterns** over sprawling multi-agent graphs; see [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents).
- **Handoff payload:** When agent A passes to B, pass **structured state** (goal, constraints, user intent, retrieved excerpts) — not a wall of chat history.
- **Tool descriptions are prompts too:** The model often chooses tools from **name + description + schema**. Write them like API docs: *when to use*, *when not to use*, *required fields*.
- **Ground with RAG before multi-step reasoning:** Retrieve first, then reason — reduces confident fabrication on private facts.

---

## Slide 6 — Tools & Model Context Protocol (MCP)

### Key points

- Tools = **capabilities**: external APIs, files, databases.
- **MCP (Model Context Protocol)** is an emerging **standard way** to expose tools, resources, and prompts to agents — so integrations are **reusable** across clients (IDEs, assistants, agent frameworks).
- **Why it matters:** Swap implementations without rewriting every agent; **governance** at the tool boundary.

### Extended script (≈1–2 min)

> Tools are where your agent stops “talking” and starts **doing**. Search, tickets, billing, code search — all behind explicit functions your code controls.  
>  
> MCP is worth naming because it’s part of the **plumbing standardization** story — similar to how REST made integrations composable. For organizations, the win is **one connector**, many agents — and a clearer place for **security review** (what can this tool read or write?).  
>  
> Official overview: [Model Context Protocol](https://modelcontextprotocol.io/).

---

## Slide 7 — Agent memory (Working → Semantic → Observational)

### Key points

- **Working memory:** Active conversation window — **fast**, **short-lived**, keeps the *current* task coherent.
- **Semantic recall:** Retrieve past turns by **meaning** (“what did we decide about billing?”) — vector similarity, not keywords.
- **Observational:** **Compress** long histories into durable notes — keeps context small as sessions grow.
- **Problem statement:** Context truncation → **goal drift** on long tasks.
- **Stack insight:** Layer them — not “pick one.”

### Extended script (≈2 min)

> Memory is not “store the whole chat forever in the prompt.” That doesn’t scale.  
>  
> **Working memory** is your rolling buffer — what’s relevant *right now*.  
>  
> **Semantic recall** answers “what did we discuss about X?” even if the user didn’t use the same words — that’s **embedding search over messages**, not grep.  
>  
> **Observational** memory is how you **summarize and persist** without stuffing 200 messages into the model each turn. Think of it as the agent’s **running notes**.  
>  
> If you’ve seen agents “forget” the objective after 20 steps, it’s usually a **memory architecture** issue, not “bad luck.”

---

## Slides 8–9 — RAG (Retrieval-Augmented Generation)

### Key points — problem

- LLMs have **knowledge cutoffs** and **no access** to private corpora by default.
- **Fine-tuning** is costly, slow to refresh, and still doesn’t guarantee factual grounding for fast-changing docs.
- **RAG:** At query time, **retrieve** relevant chunks, **inject** into context, then **generate** — knowledge updates when **documents** update.

### Key points — how to describe the pipeline (simple)

1. **Ingest:** Parse PDFs/HTML/docs → **chunk** with overlap.  
2. **Embed:** Turn chunks into vectors; store in a **vector DB**.  
3. **Retrieve:** Embed the user question → **nearest neighbors** (+ optional metadata filters).  
4. **Generate:** Model answers **using retrieved text**; ask for **citations** when you need auditability.

### Key points — what to say about quality

- **Chunking** and **metadata** (source, section, date) matter as much as the embedding model.
- **Retrieval is not magic** — garbage chunks → garbage context → confident wrong answers. **Evals** on retrieval hit-rate matter.
- **RAG vs agent tools:** In many frameworks, retrieval is exposed as a **tool** the agent calls — great for demos because you **see the tool call** in traces.

### Extended script (≈2–3 min)

> RAG is the pattern that lets you say: **“Answer from *our* manuals, tickets, and policies — not from what the model memorized in training.”**  
>  
> Fine-tuning bakes knowledge into weights. That’s powerful for *style* or *format*, but painful for **weekly policy updates**. RAG keeps the **source of truth** in your document store and changes when you update the doc.  
>  
> Operationally, think **factory + query**:  
>  
> - **Offline:** chunk documents, embed, index.  
> - **Online:** retrieve top-K passages, stuff them into the prompt under a clear delimiter, and instruct the model: **only use this context; if it’s missing, say you don’t know.**  
>  
> For multi-agent systems, a common pattern is a **research agent** that retrieves and quotes, and a **writer agent** that formats — separation of concerns reduces hallucination risk.  
>  
> Good background reading: [Retrieval-Augmented Generation (RAG) overview — AWS](https://aws.amazon.com/what-is/retrieval-augmented-generation/) (conceptual); framework docs vary by vendor.

---

## Slide 10–11 — Agent orchestration (Swarm, Supervisor, Flow-to-Flow)

### Key points

| Pattern | Shape | Strengths | Typical use |
|--------|--------|-----------|----------------|
| **Swarm** | Peer-to-peer | Parallelism, exploration | Brainstorming, multi-path research |
| **Supervisor** | Hub-and-spoke | Control, aggregation | Enterprise workflows, approvals |
| **Flow-to-Flow** | Sequential chain | Deterministic handoffs | Doc pipelines, ETL-style steps |

**Speaker line:** *“Pick orchestration based on whether you need **creativity**, **control**, or **determinism**.”*

### Extended script (≈2 min)

> Multi-agent isn’t “more agents = smarter.” It’s **division of labor**.  
>  
> **Swarm** patterns shine when you want **parallel exploration** — many peers propose partial solutions. The cost is **coordination overhead** and harder debugging.  
>  
> **Supervisor** is the enterprise default: a coordinator **delegates**, **reviews**, and **merges** results. It’s slower than swarm but **easier to govern** — you know who was responsible for each subtask.  
>  
> **Flow-to-flow** is your **pipeline**: extract → classify → summarize → store. Great when the steps are mostly **deterministic** and you want repeatability.  
>  
> **Prompting implication:** supervisors need **routing rules** — *when* to call which specialist. Specialists need **narrow prompts**. If everyone is a generalist, you’ve just built an expensive single agent with extra latency.

---

## Slide 12 — Guardrails & human-in-the-loop

### Key points

- **Input guards:** PII, injection/jailbreak, toxicity.
- **Output guards:** Leakage, policy, hallucination checks where feasible.
- **HITL:** Approve **tool calls** (send email, delete, deploy), **suspend/resume**, **low-confidence escalation**.
- **Token budgets** — control runaway loops and cost.
- **Observability:** Traces, spans, **evals** — agentic apps need more than HTTP access logs.

### Extended script (≈1–2 min)

> Agents amplify **both** productivity and risk. Guardrails are not optional polish.  
>  
> Treat **tool calls** like **production mutations** — confirm destructive operations. Use **token and step budgets** so a bad loop can’t burn your quarter’s budget overnight.  
>  
> And invest in **observability**: you want to replay *which* document was retrieved, *which* tool ran, with *what* arguments. That’s how you debug multi-agent systems — and how you pass security review.

---

## Slide 13 — Modern agentic software (“computer use”)

### Key points

- Shift: chat-only → agents that **act** on files, **run code in sandboxes**, **drive browsers** — closer to how humans work.
- **Sandboxing** and **least privilege** are non-negotiable.
- Mention **OpenClaw** / ecosystem as **signal of demand**, not a product endorsement — frame as *“the category is moving fast.”*

### Extended script (≈1 min)

> We’re seeing a class of agents that don’t just answer questions — they **operate software**: files, spreadsheets, browsers, sometimes code execution in isolation.  
>  
> That’s powerful for automation, but it raises the bar on **security architecture**. The story isn’t “give the model root access”; it’s **capability-based APIs**, sandboxes, and audit trails.

---

## Slide 14 — Agent skills (plug-in bundles)

### Key points

- **Skill** = packaged **instructions + tools + templates** for a domain (e.g. document creator, data analyst, code reviewer).
- **Modularity:** Extend agents **without** forking core code; share across teams.
- Tie to **your own demo repo** if applicable: skills ≈ **repeatable playbooks** for agents.

### Extended script (≈1 min)

> Skills are how you scale agent behavior **horizontally** — domain packs you install once.  
>  
> For organizations, this mirrors how you’d share **lint rules**, **design systems**, or **runbooks** — except the consumer is an agent that also needs **tools** wired up correctly.

---

## Slides 15–16 — Q&A and thank you

### Key points

- Invite questions on **prompting**, **RAG quality**, **orchestration**, **MCP**, **memory**, **evals**, **security**.
- Closing: **Cảm ơn. Gracias.** — match the deck’s multilingual thank-you.

### Extended script (≈30 s)

> We covered the stack — instructions, model, memory, tools, guardrails, output — and how RAG and multi-agent patterns fit together. I’m happy to go deeper on anything: retrieval metrics, supervisor design, or how we’d pilot this safely in a real product. Thank you — cảm ơn, gracias.

---

## Q&A bank (short answers you can expand)

**Q: Do we still need fine-tuning if we use RAG?**  
Often **RAG first** for factual, changing knowledge; **fine-tuning** for tone, format, or domain vocabulary — they solve different problems.

**Q: How do we know RAG is “working”?**  
Measure **retrieval hit rate**, **answer groundedness** (citations match sources), and **user corrections** — not just “the answer sounds good.”

**Q: One agent or many?**  
Start **one agent + good tools + RAG**. Split when **tool sets** or **prompts** fight each other — usually 8+ tools or mixed domains.

**Q: What’s the biggest mistake teams make?**  
**Vague system prompts** + **no evals** + **unbounded tool permissions**.

**Q: MCP vs custom APIs?**  
MCP is **interoperability**; you still implement **authz**, **rate limits**, and **logging** behind each tool.

---

## Optional live demo tie-in (Mastra / your repo)

If you demo the TechCafe project:

1. **Bad vs good instruction agents** — same question, contrast structure and safety tone.  
2. **RAG agent** — show **tool call** + retrieved chunks in Studio traces.  
3. **Line:** *“Instructions shape behavior; RAG and tools shape facts.”*

---

## References (further reading)

- [Model Context Protocol](https://modelcontextprotocol.io/) — tool/resource standard for agents.  
- [Mastra docs — Agents](https://mastra.ai/docs/agents/overview) — practical agent + tool patterns (aligned with your demo stack).  
- [Mastra docs — RAG overview](https://mastra.ai/docs/rag/overview) — ingest, embed, retrieve pipeline framing.  
- [AWS — What is RAG?](https://aws.amazon.com/what-is/retrieval-augmented-generation/) — vendor-neutral explainer.  

---

*Speaker notes generated to align with the exported PDF deck content; extended script and multi-agent/RAG depth added for rehearsal and technical audiences.*
