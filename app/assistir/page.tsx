"use client";

import Nav from "@/app/components/Nav";
import Footer from "@/app/components/Footer";

// Placeholder while the FAPESP "model proposes → human corrects" flow is rebuilt.
export default function Assistir() {
  return (
    <>
      <Nav />
      <main className="lp-wide" style={{ padding: "80px 0", minHeight: "60vh", maxWidth: 640 }}>
        <p className="label" style={{ marginBottom: 14 }}>ANOTAÇÃO POR TRANSCRIÇÃO</p>
        <h1 className="display" style={{ fontSize: "clamp(26px,4vw,40px)", lineHeight: 1.12, margin: "0 0 16px" }}>
          Em construção.
        </h1>
        <p style={{ fontSize: 16, color: "var(--body)", lineHeight: 1.6 }}>
          Estamos montando a anotação por transcrição de entrevistas: o modelo lê a fala,
          propõe os atos, e você corrige. Volta já já. Enquanto isso, dá pra jogar a versão
          de frases em <a href="/jogar" style={{ color: "var(--ink)", textDecoration: "underline" }}>/jogar</a>.
        </p>
      </main>
      <Footer />
    </>
  );
}
