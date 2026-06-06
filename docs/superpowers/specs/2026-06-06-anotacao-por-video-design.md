# Anotação por Vídeo (YouTube) — Design

**Data:** 2026-06-06
**Objetivo:** coletar **texto real escrito por humanos** + rótulo de ato de fala, assistindo a vídeos públicos do YouTube. Não é produto — é mecanismo de coleta de dado para retreinar o modelo.

## Por que assim

Decisões anteriores na conversa, em ordem:
- Fonte de dado deve ser **texto real**, não sintético (o DeepSeek escreve "certinho demais").
- Entrevistas/debates > notícia (diálogo tem diversidade de atos; corpo de notícia é só `informar`).
- O **tom** desambigua ironia/insulto que o texto sozinho não resolve → vídeo ajuda.
- A API do player do YouTube (`getCurrentTime()`) dá o **timestamp de graça**, então não precisa de yt-dlp, ASR, forced-alignment nem scraping de transcrição.
- O humano **digita a fala que ouviu** → o texto é real, escrito por humano, e não há problema de direito autoral (guardamos o texto do anotador + o rótulo, não o vídeo nem legenda de terceiro). O `video_id` + timestamp são só proveniência.

Resultado: o anotador cola qualquer vídeo do YouTube, assiste, e ao ouvir uma fala marca → captura o tempo → digita a fala + escolhe o ato. Cria a anotação **do zero** (sem viés de span proposto por modelo).

**Custo honesto:** transcrever ouvindo é mais lento que julgar um trecho pronto (menos itens por pessoa). Aceito — é o preço de não depender de transcrição.

## Escopo v1

- Granularidade: **uma fala = um ato**. O texto digitado inteiro é o span (`span_start`/`span_end` ficam nulos = texto inteiro). Seleção de palavra para múltiplos atos numa fala = fase 2.
- Demografia é obrigatória (objetivo de pesquisa: percepção por perfil). Reusa o onboarding existente; `/assistir` mostra o formulário se a pessoa ainda não se cadastrou.
- Pontos: cada anotação salva dá pontos (reusa `participant_stats`).

## Arquitetura

### Dados — nova tabela (em `db/schema.sql`, nos dois repos)

```sql
create table if not exists video_annotation (
  id             bigserial primary key,
  participant_id uuid not null references participant(id) on delete cascade,
  video_id       text not null,              -- id do YouTube (11 chars)
  ts_seconds     double precision not null,  -- momento no vídeo
  text           text not null,              -- a fala que o humano digitou
  act            text not null,              -- um dos 13 atos
  span_start     int,                        -- sub-span opcional (fase 2); null = texto inteiro
  span_end       int,
  created_at     timestamptz not null default now()
);
create index if not exists idx_video_annotation_participant on video_annotation(participant_id);
create index if not exists idx_video_annotation_video on video_annotation(video_id);
```

É tabela dedicada (não polui o pool de votação do `/jogar`): a anotação de vídeo já é gold humano, não precisa de voto.

### Web

- **`/assistir`** (client page):
  - Se não cadastrado → `OnboardingForm` (cria `participant` via `POST /api/participant`).
  - Campo para colar URL do YouTube → parse do `video_id`.
  - Player embedado via **IFrame Player API** (`YouTubePlayer.tsx`).
  - Botão **"marcar fala"** → `player.getCurrentTime()`, pausa, abre o form.
  - Form: textarea (fala ouvida) + grade dos 13 atos (cores de `actColors`) → salva.
  - Lista das marcações da sessão (tempo + texto + ato), com clique para reassistir (`seekTo`).
- **`POST /api/video-annotation`** — valida (participant, video_id, ts≥0, text 1..300, act ∈ ACTS), rate-limit, insere, dá pontos.
- **`/api/me`** ganha campo `registered` (presença de `participant_stats`) para o gate de onboarding.
- Link "Vídeo" no `Nav`.

### Pipeline Python (follow-up, fora deste commit)

`chomsky.collect` ganha um exporter que lê `video_annotation` → emite exemplos `{text, spans:[{start:0,end:len(text),act}]}` para o dataset de treino. Mecânico; o que gera o dado é a coleta web acima.

## Fora de escopo (v1)

- Sincronia karaokê transcrição↔vídeo (precisaria de alinhamento; não vale agora).
- Seleção de sub-span por palavra (fase 2).
- Anonimização de import de WhatsApp/tweet (caminho abandonado em favor de vídeo público).
- Label `insultar` (decisão de taxonomia separada).
