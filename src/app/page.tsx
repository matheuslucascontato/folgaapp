import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
export default function Home() {
  return (
    <main className="landing">
      <div className="brand">
        <Image src="/icon.svg" width="40" height="40" alt="" /> FOLGA
      </div>
      <span className="eyebrow">MENOS APERTO. MAIS CLAREZA.</span>
      <h1>Seu dinheiro com espaço para respirar.</h1>
      <p>
        Entenda o que você tem, o que já está comprometido e o que cabe no seu
        próximo passo.
      </p>
      <div className="actions">
        <Link className="primary" href="/demo">
          Explorar demonstração <ArrowUpRight size={18} />
        </Link>
        <Link className="secondary" href="/login">
          Entrar ou criar conta
        </Link>
      </div>
      <div className="landing-note">
        <ShieldCheck /> Entradas manuais. Sem conexão com bancos. Sem
        julgamentos.
      </div>
      <div className="sample">
        <small>CLAREZA PARA O DIA A DIA</small>
        <h2>Um saldo sozinho não conta a história toda.</h2>
        <p>
          Veja os vencimentos antes de receber e entenda cada premissa da sua
          previsão.
        </p>
        <div className="pill">Saldo ≠ dinheiro disponível</div>
      </div>
    </main>
  );
}
