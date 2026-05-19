import { AdminPageHero } from "@/components/admin/page-hero";
import { TenantForm } from "@/components/admin/tenant-form";

export const metadata = { title: "Admin · Νέος πελάτης" };

export default function NewTenantPage() {
  return (
    <>
      <AdminPageHero
        eyebrow="Onboarding"
        title="Νέος πελάτης"
        description="Εισήγαγε τον ΑΦΜ για αυτόματη συμπλήρωση από ΑΑΔΕ, ή συμπλήρωσε χειροκίνητα. Όλα τα κενά πεδία της ΑΑΔΕ αγνοούνται αυτόματα."
        crumbs={[
          { href: "/admin", label: "Admin" },
          { href: "/admin/tenants", label: "Πελάτες" },
          { label: "Νέος" },
        ]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <TenantForm />
      </div>
    </>
  );
}
