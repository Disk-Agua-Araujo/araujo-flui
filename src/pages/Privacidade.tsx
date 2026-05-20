import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Seo } from "@/components/Seo";

export default function Privacidade() {
  return (
    <div className="min-h-screen flex flex-col">
      <Seo title={"Política de Privacidade | Disk Água Araujo"} description={"Política de privacidade e tratamento de dados pessoais da Disk Água Araujo, em conformidade com a LGPD."} path={"/privacidade"} />
      <Header />
      <main className="flex-1 py-12">
        <div className="container max-w-3xl">
          <p className="text-sm text-muted-foreground mb-1">Versão 1.0 — Última atualização: 11 de março de 2026</p>
          <h1 className="text-2xl font-bold mb-8">Política de Privacidade</h1>

          <div className="prose prose-sm text-muted-foreground space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-foreground">1. Introdução e Controlador dos Dados</h2>
              <p>
                A Disk Água Araujo, com sede na Av. Eduardo Prado, 269 – Parque Erasmo Assunção, Santo André – SP, 09271-180, é a controladora dos dados pessoais coletados por meio do site diskaguaaraujo.com.br e dos canais de atendimento (WhatsApp e telefone). Esta Política de Privacidade foi elaborada em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD – Lei nº 13.709/2018) e tem por objetivo informar como coletamos, utilizamos, armazenamos e protegemos seus dados pessoais.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">2. Dados Coletados</h2>
              <p>Coletamos os seguintes dados pessoais, estritamente necessários para a prestação dos nossos serviços:</p>
              <ul className="list-disc list-inside mt-2">
                <li><strong>Dados de identificação:</strong> nome completo e telefone/WhatsApp;</li>
                <li><strong>Dados de entrega:</strong> endereço completo (rua, número, bairro, cidade, estado, CEP, complemento e ponto de referência);</li>
                <li><strong>Dados empresariais (pessoa jurídica):</strong> CNPJ;</li>
                <li><strong>Dados de pedidos:</strong> histórico de produtos adquiridos, datas e horários de entrega, observações e forma de pagamento;</li>
                <li><strong>Dados de navegação:</strong> informações coletadas automaticamente por cookies e tecnologias similares.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">3. Finalidade do Tratamento</h2>
              <p>Os dados pessoais são tratados para as seguintes finalidades:</p>
              <ul className="list-disc list-inside mt-2">
                <li>Processamento e entrega de pedidos;</li>
                <li>Contato com o cliente via WhatsApp para confirmação de pedidos e atendimento;</li>
                <li>Melhoria contínua dos nossos serviços e da experiência do usuário;</li>
                <li>Cumprimento de obrigações legais e regulatórias;</li>
                <li>Envio de comunicações relacionadas ao pedido (confirmação, status de entrega).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">4. Base Legal (LGPD)</h2>
              <p>O tratamento dos dados pessoais é realizado com fundamento nas seguintes bases legais previstas na LGPD:</p>
              <ul className="list-disc list-inside mt-2">
                <li><strong>Execução de contrato (Art. 7º, V):</strong> para processamento de pedidos e prestação dos serviços contratados;</li>
                <li><strong>Legítimo interesse (Art. 7º, IX):</strong> para melhoria dos serviços e comunicações operacionais;</li>
                <li><strong>Consentimento (Art. 7º, I):</strong> para uso de cookies não essenciais e eventuais comunicações promocionais;</li>
                <li><strong>Cumprimento de obrigação legal (Art. 7º, II):</strong> para atender obrigações fiscais e regulatórias.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">5. Compartilhamento de Dados</h2>
              <p>
                A Disk Água Araujo <strong>não vende, aluga ou comercializa</strong> dados pessoais de seus clientes. Os dados poderão ser compartilhados exclusivamente com:
              </p>
              <ul className="list-disc list-inside mt-2">
                <li>Prestadores de serviços operacionais necessários à entrega e processamento de pedidos;</li>
                <li>Plataformas de hospedagem e infraestrutura tecnológica utilizadas para operar o Site;</li>
                <li>Autoridades públicas, quando exigido por lei ou decisão judicial.</li>
              </ul>
              <p className="mt-2">
                Em todos os casos, exigimos que os terceiros adotem medidas adequadas de proteção de dados, em conformidade com a LGPD.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">6. Armazenamento e Segurança</h2>
              <p>
                Os dados pessoais são armazenados em servidores seguros com criptografia em trânsito e em repouso. Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados contra acesso não autorizado, perda, alteração ou destruição, incluindo:
              </p>
              <ul className="list-disc list-inside mt-2">
                <li>Criptografia de comunicações (HTTPS/TLS);</li>
                <li>Controle de acesso restrito aos dados pessoais;</li>
                <li>Monitoramento e registro de acessos;</li>
                <li>Backups periódicos e seguros.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">7. Cookies e Tecnologias de Rastreamento</h2>
              <p>
                O Site utiliza cookies e tecnologias similares para melhorar a experiência de navegação e analisar o uso do site. Os cookies utilizados podem ser:
              </p>
              <ul className="list-disc list-inside mt-2">
                <li><strong>Cookies essenciais:</strong> necessários para o funcionamento básico do Site;</li>
                <li><strong>Cookies de desempenho:</strong> coletam informações anônimas sobre como os visitantes utilizam o Site;</li>
                <li><strong>Cookies funcionais:</strong> permitem lembrar preferências do usuário.</li>
              </ul>
              <p className="mt-2">
                Você pode desativar os cookies por meio das configurações do seu navegador. No entanto, a desativação de cookies essenciais pode afetar o funcionamento do Site.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">8. Direitos do Titular (LGPD – Art. 18)</h2>
              <p>Em conformidade com o Art. 18 da LGPD, você tem os seguintes direitos em relação aos seus dados pessoais:</p>
              <ul className="list-disc list-inside mt-2">
                <li>Confirmação da existência de tratamento de dados;</li>
                <li>Acesso aos seus dados pessoais;</li>
                <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
                <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;</li>
                <li>Portabilidade dos dados a outro fornecedor de serviço;</li>
                <li>Eliminação dos dados pessoais tratados com base no consentimento;</li>
                <li>Informação sobre compartilhamento de dados com terceiros;</li>
                <li>Revogação do consentimento a qualquer momento.</li>
              </ul>
              <p className="mt-2">
                Para exercer qualquer desses direitos, entre em contato pelo WhatsApp: (11) 94006-0056.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">9. Retenção de Dados</h2>
              <p>
                Os dados pessoais são mantidos pelo tempo necessário para a finalidade para a qual foram coletados, para cumprimento de obrigações legais, ou enquanto durar a relação comercial com o cliente. Dados de pedidos são retidos por até 5 (cinco) anos para fins fiscais e contábeis. Após esse período, os dados são eliminados ou anonimizados de forma segura.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">10. Dados de Menores</h2>
              <p>
                O Site e os serviços da Disk Água Araujo não são direcionados a menores de 18 anos. Não coletamos intencionalmente dados pessoais de crianças ou adolescentes. Caso identifiquemos que dados de um menor foram coletados inadvertidamente, procederemos à sua exclusão imediata.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">11. Alterações na Política</h2>
              <p>
                A Disk Água Araujo poderá atualizar esta Política de Privacidade periodicamente. Eventuais alterações serão publicadas no Site com a indicação da data de atualização. Recomendamos a consulta periódica desta página para se manter informado sobre nossas práticas de proteção de dados.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">12. Canal de Contato (Encarregado de Dados)</h2>
              <p>
                Para dúvidas, solicitações ou reclamações relacionadas ao tratamento de dados pessoais e ao exercício dos seus direitos previstos na LGPD, entre em contato com nosso encarregado:
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
