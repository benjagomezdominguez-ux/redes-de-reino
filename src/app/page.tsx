import { Navbar } from "@/components/sections/Navbar";
import { Hero } from "@/components/sections/Hero";
import { AboutChurch } from "@/components/sections/AboutChurch";
import { Pastors } from "@/components/sections/Pastors";
import { Membership } from "@/components/sections/Membership";
import { Giving } from "@/components/sections/Giving";
import { BibleStudies } from "@/components/sections/BibleStudies";
import { Activities } from "@/components/sections/Activities";
import { Contact } from "@/components/sections/Contact";
import { Footer } from "@/components/sections/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex flex-col">
        <Hero />
        <AboutChurch />
        <Pastors />
        <Membership />
        <BibleStudies />
        <Activities />
        <Giving />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
