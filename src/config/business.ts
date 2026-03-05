// ============================================================
// Disk Água Araujo – Single Source of Truth
// Edit this file to update all business info across the site.
// ============================================================

export const business = {
  name: "Disk Água Araujo",
  tagline: "Confiança, agilidade e qualidade na sua porta!",
  subtitle:
    "Entrega rápida de galões de 20L em Santo André para residências e empresas. Água mineral de procedência garantida e atendimento humanizado.",
  // Telefone fixo (ligações)
  phone: "(11) 4479-9012",
  phoneIntl: "+551144799012",
  telLink: "tel:+551144799012",
  // WhatsApp (atendimento)
  waPhone: "(11) 94006-0056",
  waPhoneIntl: "+5511940060056",
  waLink: (message = "") =>
    `https://wa.me/5511940060056${message ? `?text=${encodeURIComponent(message)}` : ""}`,
  waDefaultMessage:
    "Olá! Gostaria de fazer um pedido de água.",
  address: {
    full: "Av. Eduardo Prado, 269 - Parque Erasmo Assunção, Santo André - SP, 09271-180",
    street: "Av. Eduardo Prado, 269",
    neighborhood: "Parque Erasmo Assunção",
    city: "Santo André",
    state: "SP",
    zip: "09271-180",
  },
  hours: 'Aberto • Fecha 17:00',
  hoursNote: "Confira os horários atualizados no Google",
  rating: 4.3,
  reviewCount: 47,
  googleReviewsLink: "https://www.google.com/search?q=disk+agua+araujo&oq=disk&gs_lcrp=EgZjaHJvbWUqDggBEEUYJxg7GIAEGIoFMgYIABBFGDwyDggBEEUYJxg7GIAEGIoFMgYIAhBFGDkyBggDEEUYOzIKCAQQABixAxiABDIHCAUQABiABDIGCAYQRRg8MgYIBxBFGDzSAQgyNjc1ajBqN6gCALACAA&sourceid=chrome&ie=UTF-8#lrd=0x94ce683a267374c9:0xb8786aa44c252951,1,,,,",
  mapsEmbedUrl:
    "https://www.google.com/maps?q=Av.+Eduardo+Prado,+269+-+Parque+Erasmo+Assunção,+Santo+André+-+SP,+09271-180&output=embed",
  mapsDirectionsLink:
    "https://www.google.com/maps/dir/?api=1&destination=Av.+Eduardo+Prado+269+Santo+André+SP",
  social: {
    facebook: "#",
    instagram: "#",
  },
  reviews: [
    {
      author: "Viviane Lucindo",
      stars: 5,
      text: "Excelente atendimento, muito educados com entrega rápida e ótimos produtos.",
    },
    {
      author: "pão com açucar",
      stars: 5,
      text: "Atendimento extremamente bom, agua chegou sem nenhum problema nota 10.",
    },
    {
      author: "maricota nene Mendes",
      stars: 5,
      text: "Excelente atendimento e nova direção, vale a pena conferir.",
    },
  ],
  products: [
    {
      id: "galao-20l",
      name: "Galão de Água Mineral 20L",
      description: "Água mineral natural de procedência garantida.",
      icon: "droplets" as const,
    },
    {
      id: "agua-gas",
      name: "Água com Gás (opção)",
      description: "Água mineral gaseificada para quem prefere com gás.",
      icon: "sparkles" as const,
    },
    {
      id: "suporte",
      name: "Suporte para Galão",
      description: "Suporte prático e resistente para galões de 20L.",
      icon: "archive" as const,
    },
    {
      id: "bomba",
      name: "Bomba Manual/Automática",
      description: "Bomba para facilitar o uso do galão no dia a dia.",
      icon: "zap" as const,
    },
  ],
  paymentMethods: ["PIX", "Dinheiro", "Cartão"],
  faq: [
    {
      q: "Qual o prazo de entrega?",
      a: "Trabalhamos com entrega rápida na região de Santo André. O prazo pode variar conforme a demanda. Entre em contato pelo WhatsApp para confirmar a disponibilidade.",
    },
    {
      q: "Atendem empresas e residências?",
      a: "Sim! Atendemos tanto residências quanto empresas em Santo André e região. Consulte a disponibilidade para o seu endereço.",
    },
    {
      q: "Quais formas de pagamento?",
      a: "Aceitamos PIX, dinheiro e cartão. Consulte as condições pelo WhatsApp.",
    },
    {
      q: "Como faço para pedir?",
      a: "Você pode pedir diretamente pelo WhatsApp, pelo formulário do site ou pela página de pedido. É rápido e fácil!",
    },
  ],
} as const;

export type Product = (typeof business.products)[number];

export function buildWhatsAppOrderMessage(data: {
  name: string;
  address: string;
  items: string;
  payment: string;
  obs?: string;
}) {
  return `Olá! Quero fazer um pedido de água. Meu nome é ${data.name}. Endereço: ${data.address}. Itens: ${data.items}. Forma de pagamento: ${data.payment}.${data.obs ? ` Observações: ${data.obs}.` : ""}`;
}
