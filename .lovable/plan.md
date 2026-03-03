

# Disk Água Araujo – Website Plan

## Overview
A modern, mobile-first website in Portuguese (pt-BR) for a water delivery company in Santo André, SP. The primary goal is converting visitors into WhatsApp leads and orders.

## Brand & Design
- **Palette**: Primary blue (#0A4888), dark blue (#0C285D), accent red (#C8312D), light background (#F6F7F9), dark text (#0B1220)
- **Typography**: Inter / system UI fallback
- **Style**: Clean, modern, lots of whitespace, soft shadows, rounded corners, subtle animations
- **Logo**: Used in header, footer, and as favicon

## Pages

### 1. Home (`/`) — Single-page with anchored sections

**A. Sticky Header**
- Logo left, nav links right (Início, Produtos, Como funciona, Avaliações, Contato)
- Desktop: WhatsApp + Ligar buttons
- Mobile: compact header + sticky bottom bar with "WhatsApp" and "Pedir agora"

**B. Hero**
- Tagline: "Confiança, agilidade e qualidade na sua porta!"
- Sub: "Entrega rápida de galões de 20L em Santo André..."
- Two CTAs: "Pedir no WhatsApp" and "Fazer pedido pelo site"
- Trust row: Google rating, entrega rápida, atendimento humanizado
- Decorative water-themed geometric shapes (no stock photos)

**C. Quick Order Widget**
- Compact "Pedido rápido" card: product selector + qty steppers, name, WhatsApp, address
- Submit validates → generates prefilled WhatsApp message → opens in new tab
- Shows confirmation + "Copiar resumo do pedido"

**D. Products Catalog**
- 4 placeholder cards (Galão 20L, Água com gás, Suporte, Bomba)
- Price: "Consulte no WhatsApp" — each card has a WhatsApp CTA

**E. How It Works** — 3 illustrated steps (Escolha, Informe endereço, Receba)

**F. Service Area + Map** — Google Maps iframe embed, buttons for routes/call/WhatsApp

**G. Reviews** — 4.3★ rating badge + 3 real review cards + "Ver no Google" button

**H. FAQ** — Accordion with 4 questions about delivery, customers, payment, ordering

**I. Contact** — Cards (WhatsApp, Phone, Address, Hours) + lead form "Fale com a gente" + final CTA band

**Footer** — Logo, quick links, address, phone, copyright, social icons (Facebook + Instagram placeholders)

### 2. Order Page (`/pedido`)
- Full order form: product selector + quantities, customer info (name, WhatsApp), delivery address, customer type (Residência/Empresa), payment method (PIX/Dinheiro/Cartão), observations
- Desktop: sticky order summary sidebar; Mobile: expandable summary
- Submit generates WhatsApp message + confirmation screen
- "Salvar pedido" saves to localStorage for next visit prefill

### 3. Legal Pages (`/privacidade`, `/termos`)
- Simple editable placeholder text pages

## Technical Architecture

- **Config file** (`src/config/business.ts`): Single source of truth for company name, phone, WhatsApp link, address, rating, products, social links — all easily editable
- **SEO**: Title, meta description, OpenGraph tags, favicon from logo, JSON-LD LocalBusiness structured data
- **Analytics hooks**: Track whatsapp_click, call_click, order_submit, lead_submit via console + dataLayer
- **Performance**: Lazy-loaded images, minimal dependencies, clean semantic HTML
- **Accessibility**: Proper contrast ratios, large tap targets, semantic headings, keyboard focus styles
- **Netlify-ready**: Contact form with `data-netlify="true"` attribute

## WhatsApp Entry Points (5+)
1. Header CTA
2. Hero CTA
3. Quick Order widget
4. Product card CTAs
5. Contact section
6. Footer
7. Mobile sticky bottom bar
8. Order page (`/pedido`)

