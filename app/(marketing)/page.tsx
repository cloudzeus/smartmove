import { Hero } from "@/components/marketing/hero";
import { TrustRibbon } from "@/components/marketing/trust-ribbon";
import { PressStrip } from "@/components/marketing/press-strip";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { SavingsExamples } from "@/components/marketing/savings-examples";
import { ReturnTrips } from "@/components/marketing/return-trips";
import { Categories } from "@/components/marketing/categories";
import { Testimonials } from "@/components/marketing/testimonials";
import { CarriersStrip } from "@/components/marketing/carriers-strip";
import { Trust } from "@/components/marketing/trust";
import { CarrierCta } from "@/components/marketing/carrier-cta";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustRibbon />
      <PressStrip />
      <HowItWorks />
      <SavingsExamples />
      <ReturnTrips />
      <Categories />
      <Testimonials />
      <CarriersStrip />
      <Trust />
      <CarrierCta />
      <Faq />
      <FinalCta />
    </>
  );
}
