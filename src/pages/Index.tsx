import { useEffect } from "react";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { QuickOrder } from "@/components/QuickOrder";
import { Products } from "@/components/Products";
import { HowItWorks } from "@/components/HowItWorks";
import { ServiceArea } from "@/components/ServiceArea";
import { Reviews } from "@/components/Reviews";
import { FAQ } from "@/components/FAQ";
import { Contact } from "@/components/Contact";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { SectionDivider } from "@/components/SectionDivider";

const Index = () => {
  // Handle hash scrolling from other pages (e.g. /#contato)
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <SectionDivider />
        <QuickOrder />
        <SectionDivider />
        <Products />
        <SectionDivider />
        <HowItWorks />
        <SectionDivider />
        <ServiceArea />
        <SectionDivider />
        <Reviews />
        <SectionDivider />
        <FAQ />
        <SectionDivider />
        <Contact />
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default Index;
