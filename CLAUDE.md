# CLAUDE.md — Atos de Fala (instruções de tracking para o Claude Code)

> Orienta o Claude Code a implementar e manter a camada de dados conforme o contrato em
> `docs/datalayer.md`. **Leia `docs/datalayer.md` antes de qualquer task de tracking.**

## Contexto do projeto

- **Site:** plataforma de anotação colaborativa (crowdsourcing) — usuários ajudam a treinar IA a reconhecer *atos de fala* em PT-BR.
- **Stack:** Next.js (SPA) · `dataLayer` → GTM `GTM-NG6V826R` → GA4 `541576514`.
- **Valor do negócio:** o **dado anotado** (dataset). Framework de conversões: **Macro / Micro / Nano**.

## Regras inegociáveis (LGPD) — aplicam a TODA mudança de tracking

1. **Consent-first.** Nenhum evento de analytics com cookie dispara antes do consentimento. Consent Mode v2 com default `denied` carrega **antes** do GTM.
2. **Zero PII no dataLayer/GA4.** Proibido empurrar: nome, e-mail, CPF, telefone, IP, `userId` pessoal e **qualquer texto livre**. A sugestão de frase vai como `suggestion_length` (Number) — **nunca o texto**.
3. **Dois consentimentos distintos:** analytics/cookies (`analytics_storage`) ≠ dataset CC BY (pesquisa). User properties demográficas só após o consentimento de pesquisa.
4. **Demografia** só em faixas/agregados, sempre com "prefiro não informar". `gender` é potencialmente sensível.
5. **`data_forget`** aciona exclusão real (GA4 User Deletion API + base própria), não só o evento.

## Padrão de implementação

```ts
// lib/dataLayer.ts — usar SEMPRE este helper, nunca window.dataLayer.push direto nos componentes
export function dlPush(payload: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}
```

- **SPA pageview:** `spa_page_view` em cada navegação (não confiar em pageview de pageload).
- **Consent Mode v2:** default `denied` no `<head>`, antes do snippet GTM (ver `docs/datalayer.md §6`).
- Cada evento segue nome, parâmetros e tier de consentimento de `docs/datalayer.md §4–§5`. **Não inventar nomes/parâmetros** — se faltar algo, atualizar a doc primeiro.

## Eventos por nível (resumo — detalhes em docs/datalayer.md)

| Nível | Eventos | Onde no app |
|-------|---------|-------------|
| 🟥 Macro | `annotation_submit`, `annotation_milestone` | ao enviar avaliação / atingir marco |
| 🟧 Micro | `sign_up_start`, `consent_update`, `sign_up`, `annotation_start`, `annotation_suggestion`, `model_test_click` | form Participar, fluxo de anotação, link HuggingFace |
| 🟦 Nano | `spa_page_view`, `section_view`, `view_about`, `view_dashboard`, `annotation_view`, `scroll_depth`, `share`, `data_forget`, `view_terms` | navegação e interações |

## Checklist ao mexer em tracking

- [ ] Nenhum `dataLayer.push` com PII ou texto livre (auditar `sign_up` e `annotation_suggestion`).
- [ ] Eventos gated não disparam com consentimento negado.
- [ ] Nomes/parâmetros batem com `docs/datalayer.md`.
- [ ] Demografia só após consentimento de pesquisa (C2).
- [ ] Rodar o teste de jornada de tracking (`tests/tracking/`).

## Definition of Done (tracking)

1. Implementado via `dlPush`.
2. `docs/datalayer.md` atualizado se algo mudou.
3. Teste de tracking passando (consentimento negado **e** aceito).
4. Validado no GTM Preview + GA4 DebugView.
