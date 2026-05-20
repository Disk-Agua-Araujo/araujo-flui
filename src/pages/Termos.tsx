import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Seo } from "@/components/Seo";

export default function Termos() {
  return (
    <div className="min-h-screen flex flex-col">
      <Seo title={"Termos de Uso | Disk Água Araujo"} description={"Termos e condições de uso do site e dos serviços de entrega da Disk Água Araujo."} path={"/termos"} />
      <Header />
      <main className="flex-1 py-12">
        <div className="container max-w-3xl">
          <p className="text-sm text-muted-foreground mb-2">Última atualização: 11 de março de 2026</p>
          <h1 className="text-2xl font-bold mb-8">Termos de Uso</h1>

          <div className="prose prose-sm text-muted-foreground space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-foreground">1. Aceitação dos Termos</h2>
              <p>
                Ao acessar e utilizar o site diskaguaaraujo.com.br ("Site"), você declara que leu, compreendeu e concorda integralmente com estes Termos de Uso. Caso não concorde com qualquer disposição, solicitamos que não utilize o Site.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">2. Descrição dos Serviços</h2>
              <p>
                A Disk Água Araujo oferece serviços de venda e entrega de água mineral em galões de 20 litros, além de acessórios relacionados (suportes, bombas manuais e automáticas), atendendo residências e empresas na cidade de Santo André – SP e região.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">3. Cadastro e Responsabilidade do Usuário</h2>
              <p>
                Para realizar pedidos, o usuário deverá fornecer informações pessoais como nome, telefone, endereço de entrega e, no caso de pessoas jurídicas, CNPJ. O usuário é integralmente responsável pela veracidade, exatidão e atualização das informações fornecidas. Informações incorretas podem resultar em impossibilidade de entrega ou cancelamento do pedido.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">4. Pedidos e Pagamentos</h2>
              <p>
                Os pedidos podem ser realizados pelo Site, por telefone ou via WhatsApp. Todos os pedidos são confirmados por meio de contato via WhatsApp com a equipe de atendimento da Disk Água Araujo. As formas de pagamento aceitas são: PIX, dinheiro e cartão. Os preços e condições de pagamento estão sujeitos a alterações sem aviso prévio, sendo válidos os valores vigentes no momento da confirmação do pedido.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">5. Área de Entrega</h2>
              <p>
                As entregas são realizadas em um raio de até 5 km a partir do nosso endereço: Av. Eduardo Prado, 269 – Parque Erasmo Assunção, Santo André – SP, 09271-180. A disponibilidade de entrega para endereços fora dessa área pode ser consultada pelo WhatsApp: (11) 94006-0056. A Disk Água Araujo reserva-se o direito de recusar entregas para locais fora de sua área de cobertura.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">6. Cancelamento e Alterações</h2>
              <p>
                O cancelamento ou alteração de um pedido poderá ser solicitado pelo WhatsApp antes do despacho para entrega. Após o início da rota de entrega, não será possível realizar cancelamentos ou alterações. Em caso de cancelamento aceito, eventuais valores já pagos serão restituídos no prazo de até 7 (sete) dias úteis.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">7. Responsabilidade</h2>
              <p>
                A Disk Água Araujo se compromete a realizar as entregas dentro dos prazos combinados, porém não se responsabiliza por atrasos decorrentes de força maior, condições climáticas adversas, problemas de trânsito ou outros eventos fora de seu controle. A responsabilidade da empresa limita-se ao valor do pedido efetuado.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">8. Propriedade Intelectual</h2>
              <p>
                Todo o conteúdo do Site — incluindo textos, imagens, logotipos, layout e código-fonte — é de propriedade exclusiva da Disk Água Araujo ou de seus licenciadores, sendo protegido pela legislação brasileira de propriedade intelectual. É vedada a reprodução, distribuição ou modificação sem autorização prévia e por escrito.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">9. Links Externos</h2>
              <p>
                O Site poderá conter links para sites de terceiros. A Disk Água Araujo não se responsabiliza pelo conteúdo, políticas de privacidade ou práticas de quaisquer sites externos. O acesso a esses links é por conta e risco do usuário.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">10. Alterações nos Termos</h2>
              <p>
                A Disk Água Araujo reserva-se o direito de alterar estes Termos de Uso a qualquer momento, mediante publicação da versão atualizada no Site. Recomendamos a revisão periódica desta página. O uso continuado do Site após alterações constitui aceitação dos novos termos.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">11. Foro e Legislação Aplicável</h2>
              <p>
                Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da Comarca de Santo André – SP para dirimir quaisquer controvérsias decorrentes destes termos, com renúncia de qualquer outro, por mais privilegiado que seja.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">12. Contato</h2>
              <p>
                Para dúvidas, sugestões ou solicitações relacionadas a estes Termos de Uso, entre em contato conosco:
              </p>
              <ul className="list-disc list-inside mt-2">
                <li>WhatsApp: (11) 94006-0056</li>
                <li>Endereço: Av. Eduardo Prado, 269 – Parque Erasmo Assunção, Santo André – SP, 09271-180</li>
                <li>Site: diskaguaaraujo.com.br</li>
              </ul>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
