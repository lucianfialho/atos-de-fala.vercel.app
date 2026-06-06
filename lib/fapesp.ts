// Parser for Memória Roda Viva (rodaviva.fapesp.br) interview transcripts.
// Pages are ISO-8859-1 with HTML entities; each turn is
//   <p ...><strong>Speaker:</strong> text...</p>
// We return clean speaker-labeled turns for the annotation UI.

export type Turn = { speaker: string; text: string };
export type Interview = { title: string; turns: Turn[] };

const NAMED: Record<string, string> = {
  nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">",
  aacute: "á", agrave: "à", acirc: "â", atilde: "ã", auml: "ä",
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë",
  iacute: "í", igrave: "ì", icirc: "î",
  oacute: "ó", ograve: "ò", ocirc: "ô", otilde: "õ", ouml: "ö",
  uacute: "ú", ugrave: "ù", ucirc: "û", uuml: "ü",
  ccedil: "ç", ntilde: "ñ",
  Aacute: "Á", Agrave: "À", Acirc: "Â", Atilde: "Ã",
  Eacute: "É", Ecirc: "Ê", Iacute: "Í", Oacute: "Ó", Ocirc: "Ô",
  Otilde: "Õ", Uacute: "Ú", Ccedil: "Ç",
  ordf: "ª", ordm: "º", deg: "°", middot: "·",
  ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
  hellip: "…", ndash: "–", mdash: "—",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => (name in NAMED ? NAMED[name] : m));
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

function clean(s: string): string {
  return decodeEntities(stripTags(s)).replace(/\s+/g, " ").trim();
}

// A speaker label is a short capitalized prefix before a colon, no sentence punctuation.
function isSpeaker(name: string): boolean {
  const n = name.trim();
  if (n.length < 2 || n.length > 45) return false;
  if (/[.?!;]/.test(n)) return false;
  if (n.startsWith("[")) return false;
  return /^[A-Za-zÀ-ÿ]/.test(n);
}

export function parseInterview(html: string): Interview {
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const title = titleMatch ? clean(titleMatch[1]) : "Entrevista";

  const turns: Turn[] = [];
  const blocks = html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) ?? [];

  for (const block of blocks) {
    const txt = clean(block);
    if (!txt || txt.startsWith("[")) continue; // stage directions / empty

    const colon = txt.indexOf(":");
    if (colon < 0) continue;
    const speaker = txt.slice(0, colon);
    const body = txt.slice(colon + 1).trim();
    if (!isSpeaker(speaker) || body.length < 2) continue;

    // drop a trailing stage direction kept in the same paragraph
    turns.push({ speaker, text: body });
  }

  return { title, turns };
}
