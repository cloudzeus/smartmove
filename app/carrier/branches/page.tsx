import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { PageHero } from "@/components/shared/page-hero";
import { BranchOfferingsEditor } from "@/components/carrier/branch-offerings-editor";
import { BranchLocationEditor } from "@/components/carrier/branch-location-editor";
import { parseOfferedServices } from "@/lib/branch-offerings";

export const metadata = { title: "Υποκαταστήματα" };
export const dynamic = "force-dynamic";

export default async function CarrierBranchesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const membership = await db.tenantMembership.findFirst({
    where: { userId: session.user.id },
    select: { tenantId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) {
    return (
      <>
        <PageHero
          eyebrow="Coverage"
          title="Υποκαταστήματα"
          crumbs={[{ href: "/carrier", label: "Επισκόπηση" }, { label: "Υποκαταστήματα" }]}
        />
        <div className="mx-auto w-full max-w-[1440px] px-4 py-4 sm:px-5">
          <div className="cx-card border-dashed bg-muted/30 px-4 py-8 text-center">
            <p className="text-[12px] text-muted-foreground">Δεν είσαι μέλος εταιρείας.</p>
          </div>
        </div>
      </>
    );
  }

  const branches = await db.branch.findMany({
    where: { tenantId: membership.tenantId, deletedAt: null },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  const totalOffering = branches.filter((b) => b.offersToOthers).length;
  const totalServices = branches.reduce(
    (s, b) => s + parseOfferedServices(b.offeredServices).length,
    0,
  );

  const mapApiKey = env.maptilerApiKey();

  return (
    <>
      <PageHero
        eyebrow="Coverage"
        title="Υποκαταστήματα"
        description="POPs εταιρείας. Ακτίνα εξυπηρέτησης + υπηρεσίες προς άλλους μεταφορείς (subcontracting)."
        crumbs={[
          { href: "/carrier", label: "Επισκόπηση" },
          { label: "Υποκαταστήματα" },
        ]}
        tone="amber"
        kpis={[
          { label: "Σύνολο", value: branches.length },
          { label: "Με συντεταγμένες", value: branches.filter((b) => b.lat != null).length },
          { label: "Παρέχουν υπηρεσίες", value: totalOffering },
          { label: "Σύνολο υπηρεσιών", value: totalServices },
        ]}
      />

      <div className="mx-auto w-full max-w-[1440px] px-4 py-3 sm:px-5">
        {/* Action bar */}
        <div className="mb-2.5 flex items-center justify-between">
          <span className="cx-eyebrow">{branches.length} υποκαταστήματα</span>
          <BranchLocationEditor mapApiKey={mapApiKey} isCreate />
        </div>

        {branches.length === 0 ? (
          <div className="cx-card border-dashed bg-muted/30 px-4 py-8 text-center">
            <p className="text-[12px] font-semibold text-foreground">
              Δεν έχεις δηλώσει υποκαταστήματα ακόμη.
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Πάτησε «+ Νέο υποκατάστημα» πάνω δεξιά για να δημιουργήσεις την κεντρική σου έδρα (HQ)
              με συντεταγμένες και ακτίνα κάλυψης. Κάθε υποκατάστημα μπορεί προαιρετικά
              να παρέχει υπηρεσίες σε άλλους μεταφορείς.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {branches.map((b) => (
              <div key={b.id} className="space-y-2">
                {/* Branch info card with location editor trigger */}
                <div className="cx-card flex flex-wrap items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                      {b.isPrimary && <span title="Κεντρική έδρα" className="text-amber-500">★</span>}
                      {b.commercialName ?? b.legalName}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {[
                        [b.address, b.addressNo].filter(Boolean).join(" "),
                        [b.postalZip, b.postalArea].filter(Boolean).join(" "),
                      ].filter(Boolean).join(", ") || "— χωρίς διεύθυνση —"}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {b.lat != null && b.lng != null
                      ? <span className="font-mono tabular-nums">{b.lat.toFixed(4)}, {b.lng.toFixed(4)} · R={b.serviceRadiusKm}km</span>
                      : <span className="text-rose-700">χωρίς συντεταγμένες</span>}
                  </span>
                  <BranchLocationEditor
                    mapApiKey={mapApiKey}
                    branch={{
                      id: b.id,
                      legalName: b.legalName,
                      commercialName: b.commercialName,
                      address: b.address,
                      addressNo: b.addressNo,
                      postalZip: b.postalZip,
                      postalArea: b.postalArea,
                      phone: b.phone,
                      email: b.email,
                      lat: b.lat,
                      lng: b.lng,
                      serviceRadiusKm: b.serviceRadiusKm,
                      isPrimary: b.isPrimary,
                    }}
                  />
                </div>
                {/* Service offerings editor */}
                <BranchOfferingsEditor
                  branch={{
                    id: b.id,
                    name: b.commercialName ?? b.legalName,
                    address: [b.address, b.addressNo].filter(Boolean).join(" ").trim() || b.postalArea || null,
                    offersToOthers: b.offersToOthers,
                    offeredServices: parseOfferedServices(b.offeredServices),
                    offeringsNotes: b.offeringsNotes,
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
