import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ContactForm } from "./contact-form";

export const metadata = {
  title: "Contact",
  description: "Une question, une suggestion ou un bug à signaler ? Écris-nous via ce formulaire.",
};

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        <section className="page-container max-w-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Contactez-nous
            </h1>
            <p className="mt-3 text-muted-foreground">
              Une question, une suggestion ou un bug à signaler ? Écris-nous,
              on te répond rapidement.
            </p>
          </div>

          <ContactForm />
        </section>
      </main>

      <Footer />
    </div>
  );
}
