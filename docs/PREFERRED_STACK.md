# Preferred paths for development deliberation

This is a **nonbinding, revisable preference profile**. Favor familiar, supportable tools when practical. Codex should recommend only the smallest subset needed; divergent technologies are welcome when justified.

| Area | Familiar/preferred candidates | Notes |
| --- | --- | --- |
| Web basics | HTML, CSS, JavaScript, **TypeScript** | Simple inspectable UI; typed boundaries |
| Runtime | **Node.js**, npm | Pin supported version |
| Interactive UI | **Vue** with **Vite** | Preferred to React for this context, not a ban |
| Cloudflare websites | **Astro** | Useful for Astro/Cloudflare workloads, not mandatory for a dynamic portal |
| Hosting | **Cloudflare**, Wrangler; or container deployment | Match the app's runtime and persistence needs |
| Small persistence | **SQLite** | Evaluate writer concurrency, migrations, backups, deployment filesystem |
| Larger data service | **PostgreSQL** | Familiar; choose only if needs justify complexity |
| Service/API | Node/TypeScript; Fastify as a candidate | Not a compulsory framework |
| Containers | **Rootless Podman**, OCI images | Prefer Podman locally; interoperable Docker-style images okay |
| Host | **Ubuntu**, systemd, Quadlet | Familiar supervised lab pattern |
| Automation | **Ansible** | Repeatable, gated deployment operations if needed |
| Testing | Unit/integration checks, **Playwright** | Demonstrate status/approval separation |
| Collaboration | GitHub, Git, gh, Codex | Reviewable, reversible development |
| Related known tools | tsx, esbuild, Phaser, LiteLLM, OpenWebUI, nginx/Apache, Fabric/Java | Experience, not requirements |
| Kubernetes | Optional later study | **Not an MVP default** |

## Engineering conduct

Use exact reviewed sources, short feedback loops, least privilege, non-root defaults, explicit network exposure, isolated fixtures, and repeatable evidence. Distinguish build, service start, health, backup, and restore. Protect GhostSentry3 and its existing services from side effects.

## Exceptions

A React proposal, for example, is not forbidden. State the useful capability, supported alternative, cost of divergence, assurance plan, and sponsor decision needed. Do not impose ceremonial approval on harmless experiments.

See [technology-preferences.yaml](../standards/technology-preferences.yaml). It is advisory metadata, **not policy-as-code**.
