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

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <QuickOrder />
        <Products />
        <HowItWorks />
        <ServiceArea />
        <Reviews />
        <FAQ />
        <Contact />
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default Index;
