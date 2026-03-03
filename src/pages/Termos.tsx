import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function Termos() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-12">
        <div className="container max-w-2xl">
          <h1 className="text-2xl font-bold mb-6">Termos de Uso</h1>
          <div className="prose prose-sm text-muted-foreground space-y-4">
            <p>
              Ao utilizar o site da Disk Água Araujo, você concorda com os termos descritos abaixo.
            </p>
            <h2 className="text-lg font-semibold text-foreground">Serviço</h2>
            <p>
              O site tem como objetivo facilitar o contato e a realização de pedidos. Os pedidos são confirmados via WhatsApp com nosso atendimento.
            </p>
            <h2 className="text-lg font-semibold text-foreground">Responsabilidade</h2>
            <p>
              Nos esforçamos para manter as informações atualizadas, mas não garantimos precisão absoluta. Preços e disponibilidade devem ser confirmados pelo WhatsApp.
            </p>
            <h2 className="text-lg font-semibold text-foreground">Alterações</h2>
            <p>
              Reservamo-nos o direito de alterar estes termos a qualquer momento.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
