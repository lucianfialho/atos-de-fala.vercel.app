# 📐 Documentação da Camada de Dados — Atos de Fala

> **Fonte da verdade** da camada de dados (`dataLayer`) do site. O Claude Code implementa e
> mantém o tracking conforme o contrato abaixo.
>
> **Stack:** Next.js (SPA) → `dataLayer` → GTM `GTM-NG6V826R` → GA4 `541576514`.
> **Framework de conversões:** Macro / Micro / Nano (Métricas Boss).
> **Princípio inegociável:** *consent-first* e **zero PII** no analytics (LGPD). Ver §2 e §6.

---

## 1. Como ler/usar este documento

- Cada evento tem: **nome**, **quando dispara**, **parâmetros**, **nível de conversão** e **nível de consentimento exigido**.
- O **dev** implementa os `dataLayer.push()` (§3–§5). O **GTM** transforma em tags GA4.
- Convenção: `snake_case`, nomes de evento em inglês, **nada de texto livre** nem identificadores pessoais nos parâmetros.

---

## 2. Princípios de Conformidade (LGPD) — leia antes de implementar

O Atos de Fala coleta **dado pessoal** (faixa etária, gênero, UF, escolaridade) e consentimento para **dataset aberto (CC BY)**. O tracking deve respeitar a LGPD (Lei 13.709/2018).

**Regras de ouro:**

1. **Consent-first.** Nenhum evento de analytics com cookie/identificador dispara **antes** do consentimento de analytics. Usar **Consent Mode v2** (default `denied`).
2. **Zero PII no GA4.** Proibido enviar: nome, e-mail, CPF, telefone, IP cru, `userId` pessoal, **texto livre** (a frase sugerida em `annotation_suggestion` vai como *tamanho*, nunca conteúdo).
3. **Dois consentimentos distintos:**
   - **Analytics/cookies** → base legal para rastrear (Consent Mode `analytics_storage`).
   - **Dataset aberto (CC BY)** → base legal para usar as anotações na pesquisa. Já existe no form "Participar".
4. **Minimização & agregação.** Demografia só em **faixas/agregados**. Combinados podem ser quase-identificadores → tratar como dado pessoal sob consentimento.
5. **Gênero é dado sensível em potencial.** Só com consentimento explícito, sempre com "prefiro não informar", nunca como critério isolado de identificação.
6. **Direito ao esquecimento.** `data_forget` deve disparar exclusão real (GA4 User Deletion API + base própria), não só um evento.
7. **Dados de pesquisa ≠ analytics.** As frases anotadas vivem no banco do projeto; ao GA4 só vai `item_id` (referência pseudônima), rótulos e métricas — nunca o conteúdo.

### Níveis de consentimento (tiers)
| Tier | Gatilho | O que pode disparar |
|------|---------|---------------------|
| **C0 — Essencial** | sempre (sem cookie) | Apenas interações do banner. Consent Mode v2 manda *pings* sem cookie (modelados). |
| **C1 — Analytics** | usuário aceita cookies/analytics | Todos os eventos Nano/Micro/Macro **sem** user properties demográficas. |
| **C2 — Pesquisa (demografia)** | consentimento CC BY no cadastro | Set das **user properties demográficas** (faixa etária, gênero, UF, escolaridade). |

---

## 3. Padrão da Camada de Dados

```js
// inicializar ANTES do snippet GTM
window.dataLayer = window.dataLayer || [];
function dlPush(payload) { window.dataLayer.push(payload); }
```
Em SPA (Next.js), disparar `spa_page_view` em cada mudança de rota (não confiar no pageview de pageload).

---

## 4. Taxonomia por Nível de Conversão

### 🟥 MACRO — valor direto pro projeto (o dado coletado)
| Evento | Quando dispara | Parâmetros | Consent |
|--------|----------------|------------|---------|
| `annotation_submit` | Usuário envia avaliação de uma predição **(1 dado pro dataset)** | `item_id`, `predicted_act`, `verdict` (`yes`\|`no`\|`dont_know`), `response_time_ms`, `annotation_index` | C1 |
| `annotation_milestone` | Marco (10/25/50/100 anotações) → **anotador engajado** | `milestone_count` | C1 |

> `annotation_submit` = **Key Event** no GA4.

### 🟧 MICRO — passos rumo à macro
| Evento | Quando dispara | Parâmetros | Consent |
|--------|----------------|------------|---------|
| `sign_up_start` | Form "Participar" iniciado | — | C1 |
| `consent_update` | Marca/desmarca consentimento CC BY | `consent_type`=`open_dataset_ccby`, `consent_value` (bool) | C1 |
| `sign_up` | Cadastro concluído ("Começar") → **anotador ativado** | (sem PII; demografia vira user property sob C2) | C1 |
| `annotation_start` | 1ª sentença exibida na sessão | — | C1 |
| `annotation_suggestion` | Sugere frase alternativa (bônus) | `item_id`, `suggestion_length` ⚠️ **só o tamanho** | C1 |
| `model_test_click` | Clique p/ testar modelo (HuggingFace) | `destination`=`huggingface`, `link_url` | C1 |

> `sign_up` = **Key Event**.

### 🟦 NANO — micro-interações
| Evento | Quando dispara | Parâmetros | Consent |
|--------|----------------|------------|---------|
| `spa_page_view` | Mudança de rota (SPA) | `page_path`, `page_title`, `section` | C1 |
| `section_view` | Entra em seção principal | `section`=`anotar`\|`sobre`\|`painel`\|`participar` | C1 |
| `view_about` / `view_dashboard` | Abre "Sobre" / "Painel" | — | C1 |
| `annotation_view` | Predição/sentença exibida | `item_id`, `predicted_act`, `sentence_length` | C1 |
| `scroll_depth` | Scroll 25/50/75/90% | `percent` | C1 |
| `share` | Compartilhamento | `method`, `content_type` | C1 |
| `data_forget` | Clique "esquecer meus dados" ⚠️ exclusão real | — | C0 |
| `view_terms` | Abre termos/política | — | C0 |

---

## 5. Parâmetros & User Properties — classificação LGPD

### Parâmetros de evento (event-scoped)
| Parâmetro | Tipo | LGPD | Observação |
|-----------|------|------|------------|
| `item_id` | string | Pseudônimo | referência da sentença; não é PII |
| `predicted_act` | string | Anônimo | rótulo do ato de fala |
| `verdict` | enum | Anônimo | `yes`/`no`/`dont_know` |
| `response_time_ms` | int | Anônimo | qualidade da resposta |
| `annotation_index` | int | Anônimo | nº na sessão |
| `sentence_length` / `suggestion_length` | int | Anônimo | **tamanho**, nunca conteúdo |
| `section`, `page_path`, `page_title` | string | Anônimo | navegação |
| `destination`, `link_url`, `method` | string | Anônimo | saída/compartilhamento |

### User Properties (user-scoped) — **só sob consentimento C2**
| Property | LGPD | Mitigação |
|----------|------|-----------|
| `age_range` | Pessoal | faixas, nunca data de nascimento |
| `gender` | Pessoal (potenc. sensível) | "prefiro não informar"; só com consentimento |
| `uf` | Pessoal (localização) | preferir `region` quando possível |
| `region` | Pessoal (agregado) | N/NE/CO/SE/S derivado da UF |
| `education_level` | Pessoal | faixas |
| `consent_open_dataset` | Operacional | flag do consentimento CC BY |
| `annotator_status` | Anônimo | new/returning/power |
| `annotations_bucket` | Anônimo | 0 / 1-9 / 10-49 / 50+ |

> ❌ **Nunca** como user property: nome, e-mail, ID pessoal, IP, texto de sugestão.

---

## 6. Consent Mode v2 — implementação

```js
// ANTES do GTM/gtag — estado default negado
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
  analytics_storage: 'denied', wait_for_update: 500
});
// quando o usuário ACEITA no banner (Tier C1)
gtag('consent', 'update', { analytics_storage: 'granted' });
// consentimento de PESQUISA (CC BY) no cadastro habilita user properties (Tier C2)
dlPush({ event: 'consent_update', consent_type: 'open_dataset_ccby', consent_value: true });
```

**Regras no GTM:** tag GA4 base respeita Consent Mode; tags de evento usam *Consent Settings*
exigindo `analytics_storage`; user properties demográficas só se `consent_open_dataset = true`.

---

## 7. Checklist de Conformidade (antes de publicar)

- [ ] Banner de consentimento ativo, com aceite/recusa simétricos.
- [ ] Consent Mode v2 default `denied` antes do GTM.
- [ ] Nenhum evento com cookie antes do aceite (validar em DebugView com consentimento negado).
- [ ] Nenhum parâmetro/property com PII ou texto livre (auditar `annotation_suggestion`).
- [ ] Demografia só com C2; "prefiro não informar" disponível.
- [ ] `data_forget` aciona exclusão real (GA4 User Deletion API + base própria).
- [ ] Política de Privacidade descreve dados, finalidade, base legal e direitos.
- [ ] Retenção GA4 configurada (ex.: 14 meses) e IP anonimizado.

---

## 8. Resumo executivo

| Nível | Eventos | Papel |
|-------|---------|-------|
| 🟥 Macro | `annotation_submit`, `annotation_milestone` | Valor direto (dado coletado, anotador engajado) |
| 🟧 Micro | `sign_up_start`, `consent_update`, `sign_up`, `annotation_start`, `annotation_suggestion`, `model_test_click` | Passos rumo à macro |
| 🟦 Nano | `spa_page_view`, `section_view`, `view_about`, `view_dashboard`, `annotation_view`, `scroll_depth`, `share`, `data_forget`, `view_terms` | Comportamento e contexto |
