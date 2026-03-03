import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function Privacidade() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-12">
        <div className="container max-w-2xl">
          <h1 className="text-2xl font-bold mb-6">Política de Privacidade</h1>
          <div className="prose prose-sm text-muted-foreground space-y-4">
            <p>
              A Disk Água Araujo valoriza a privacidade dos seus clientes. Esta página descreve como coletamos e utilizamos informações pessoais.
            </p>
            <h2 className="text-lg font-semibold text-foreground">Informações coletadas</h2>
            <p>
              Coletamos apenas informações necessárias para o atendimento: nome, telefone/WhatsApp e endereço de entrega.
            </p>
            <h2 className="text-lg font-semibold text-foreground">Uso das informações</h2>
            <p>
              As informações são utilizadas exclusivamente para processar pedidos e melhorar nosso atendimento. Não compartilhamos dados com terceiros.
            </p>
            <h2 className="text-lg font-semibold text-foreground">Contato</h2>
            <p>
              Para dúvidas sobre privacidade, entre em contato pelo WhatsApp: (11) 94006-0056.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
