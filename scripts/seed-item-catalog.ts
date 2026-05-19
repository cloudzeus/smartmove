/**
 * Seed the ItemCatalog with a baseline of common Greek household + business
 * moving SKUs. Idempotent — re-running upserts each key.
 *
 * Usage: npx tsx scripts/seed-item-catalog.ts
 */
import "dotenv/config";
import { db } from "../lib/db";

interface CatalogEntry {
  key: string;
  nameEl: string;
  nameEn: string;
  category: "furniture" | "appliances" | "boxes" | "electronics" | "other";
  defaultVolumeM3?: number;
  sortOrder: number;
}

const CATALOG: CatalogEntry[] = [
  // Furniture — seating
  { key: "armchair", nameEl: "Πολυθρόνα", nameEn: "Armchair", category: "furniture", defaultVolumeM3: 0.5, sortOrder: 10 },
  { key: "sofa-2", nameEl: "Καναπές 2θέσιος", nameEn: "Sofa (2-seater)", category: "furniture", defaultVolumeM3: 1.2, sortOrder: 11 },
  { key: "sofa-3", nameEl: "Καναπές 3θέσιος", nameEn: "Sofa (3-seater)", category: "furniture", defaultVolumeM3: 1.8, sortOrder: 12 },
  { key: "sofa-corner", nameEl: "Γωνιακός καναπές", nameEn: "Corner sofa", category: "furniture", defaultVolumeM3: 2.5, sortOrder: 13 },
  { key: "chair", nameEl: "Καρέκλα", nameEn: "Chair", category: "furniture", defaultVolumeM3: 0.15, sortOrder: 14 },
  { key: "stool", nameEl: "Σκαμπώ", nameEn: "Stool", category: "furniture", defaultVolumeM3: 0.1, sortOrder: 15 },

  // Furniture — tables
  { key: "table-dining", nameEl: "Τραπέζι τραπεζαρίας", nameEn: "Dining table", category: "furniture", defaultVolumeM3: 0.8, sortOrder: 20 },
  { key: "table-kitchen", nameEl: "Τραπέζι κουζίνας", nameEn: "Kitchen table", category: "furniture", defaultVolumeM3: 0.5, sortOrder: 21 },
  { key: "table-coffee", nameEl: "Τραπέζι σαλονιού", nameEn: "Coffee table", category: "furniture", defaultVolumeM3: 0.3, sortOrder: 22 },
  { key: "table-side", nameEl: "Βοηθητικό τραπεζάκι", nameEn: "Side table", category: "furniture", defaultVolumeM3: 0.15, sortOrder: 23 },
  { key: "desk", nameEl: "Γραφείο", nameEn: "Desk", category: "furniture", defaultVolumeM3: 0.6, sortOrder: 24 },

  // Furniture — storage
  { key: "wardrobe-2door", nameEl: "Ντουλάπα 2φυλλη", nameEn: "Wardrobe (2-door)", category: "furniture", defaultVolumeM3: 1.8, sortOrder: 30 },
  { key: "wardrobe-3door", nameEl: "Ντουλάπα 3φυλλη", nameEn: "Wardrobe (3-door)", category: "furniture", defaultVolumeM3: 2.4, sortOrder: 31 },
  { key: "wardrobe-4door", nameEl: "Ντουλάπα 4φυλλη", nameEn: "Wardrobe (4-door)", category: "furniture", defaultVolumeM3: 3.2, sortOrder: 32 },
  { key: "bookcase", nameEl: "Βιβλιοθήκη", nameEn: "Bookcase", category: "furniture", defaultVolumeM3: 1.0, sortOrder: 33 },
  { key: "chest-of-drawers", nameEl: "Συρταριέρα", nameEn: "Chest of drawers", category: "furniture", defaultVolumeM3: 0.7, sortOrder: 34 },
  { key: "buffet", nameEl: "Μπουφές", nameEn: "Buffet / sideboard", category: "furniture", defaultVolumeM3: 1.2, sortOrder: 35 },
  { key: "tv-stand", nameEl: "Έπιπλο τηλεόρασης", nameEn: "TV stand", category: "furniture", defaultVolumeM3: 0.6, sortOrder: 36 },

  // Furniture — bedroom
  { key: "bed-single", nameEl: "Κρεβάτι μονό", nameEn: "Bed (single)", category: "furniture", defaultVolumeM3: 1.2, sortOrder: 40 },
  { key: "bed-double", nameEl: "Κρεβάτι διπλό", nameEn: "Bed (double)", category: "furniture", defaultVolumeM3: 1.8, sortOrder: 41 },
  { key: "mattress-single", nameEl: "Στρώμα μονό", nameEn: "Mattress (single)", category: "furniture", defaultVolumeM3: 0.4, sortOrder: 42 },
  { key: "mattress-double", nameEl: "Στρώμα διπλό", nameEn: "Mattress (double)", category: "furniture", defaultVolumeM3: 0.6, sortOrder: 43 },
  { key: "nightstand", nameEl: "Κομοδίνο", nameEn: "Nightstand", category: "furniture", defaultVolumeM3: 0.2, sortOrder: 44 },
  { key: "dressing-table", nameEl: "Τουαλέτα", nameEn: "Dressing table", category: "furniture", defaultVolumeM3: 0.6, sortOrder: 45 },

  // Appliances
  { key: "fridge", nameEl: "Ψυγείο", nameEn: "Refrigerator", category: "appliances", defaultVolumeM3: 0.8, sortOrder: 50 },
  { key: "freezer", nameEl: "Καταψύκτης", nameEn: "Freezer", category: "appliances", defaultVolumeM3: 0.6, sortOrder: 51 },
  { key: "washing-machine", nameEl: "Πλυντήριο ρούχων", nameEn: "Washing machine", category: "appliances", defaultVolumeM3: 0.4, sortOrder: 52 },
  { key: "dryer", nameEl: "Στεγνωτήριο", nameEn: "Tumble dryer", category: "appliances", defaultVolumeM3: 0.4, sortOrder: 53 },
  { key: "dishwasher", nameEl: "Πλυντήριο πιάτων", nameEn: "Dishwasher", category: "appliances", defaultVolumeM3: 0.35, sortOrder: 54 },
  { key: "oven", nameEl: "Κουζίνα", nameEn: "Cooker / oven", category: "appliances", defaultVolumeM3: 0.4, sortOrder: 55 },
  { key: "microwave", nameEl: "Φούρνος μικροκυμάτων", nameEn: "Microwave", category: "appliances", defaultVolumeM3: 0.1, sortOrder: 56 },
  { key: "ac-indoor", nameEl: "Κλιματιστικό (εσωτερική μονάδα)", nameEn: "A/C indoor unit", category: "appliances", defaultVolumeM3: 0.15, sortOrder: 57 },
  { key: "ac-outdoor", nameEl: "Κλιματιστικό (εξωτερική μονάδα)", nameEn: "A/C outdoor unit", category: "appliances", defaultVolumeM3: 0.2, sortOrder: 58 },

  // Electronics
  { key: "tv-small", nameEl: 'Τηλεόραση έως 43"', nameEn: 'TV up to 43"', category: "electronics", defaultVolumeM3: 0.15, sortOrder: 60 },
  { key: "tv-large", nameEl: 'Τηλεόραση 50"+', nameEn: 'TV 50"+', category: "electronics", defaultVolumeM3: 0.3, sortOrder: 61 },
  { key: "computer", nameEl: "Σταθερός υπολογιστής", nameEn: "Desktop computer", category: "electronics", defaultVolumeM3: 0.1, sortOrder: 62 },
  { key: "monitor", nameEl: "Οθόνη", nameEn: "Monitor", category: "electronics", defaultVolumeM3: 0.1, sortOrder: 63 },

  // Boxes
  { key: "box-small", nameEl: "Κούτα μικρή", nameEn: "Box (small)", category: "boxes", defaultVolumeM3: 0.04, sortOrder: 70 },
  { key: "box-medium", nameEl: "Κούτα μεσαία", nameEn: "Box (medium)", category: "boxes", defaultVolumeM3: 0.08, sortOrder: 71 },
  { key: "box-large", nameEl: "Κούτα μεγάλη", nameEn: "Box (large)", category: "boxes", defaultVolumeM3: 0.15, sortOrder: 72 },
  { key: "box-wardrobe", nameEl: "Κούτα ντουλάπας", nameEn: "Wardrobe box", category: "boxes", defaultVolumeM3: 0.4, sortOrder: 73 },

  // Other
  { key: "rug", nameEl: "Χαλί", nameEn: "Rug / carpet", category: "other", defaultVolumeM3: 0.2, sortOrder: 80 },
  { key: "mirror", nameEl: "Καθρέφτης", nameEn: "Mirror", category: "other", defaultVolumeM3: 0.1, sortOrder: 81 },
  { key: "lamp-floor", nameEl: "Φωτιστικό δαπέδου", nameEn: "Floor lamp", category: "other", defaultVolumeM3: 0.15, sortOrder: 82 },
  { key: "painting", nameEl: "Πίνακας / κορνίζα", nameEn: "Painting / frame", category: "other", defaultVolumeM3: 0.05, sortOrder: 83 },
  { key: "plant", nameEl: "Φυτό", nameEn: "Plant", category: "other", defaultVolumeM3: 0.15, sortOrder: 84 },
  { key: "bicycle", nameEl: "Ποδήλατο", nameEn: "Bicycle", category: "other", defaultVolumeM3: 0.3, sortOrder: 85 },
  { key: "treadmill", nameEl: "Διάδρομος γυμναστικής", nameEn: "Treadmill", category: "other", defaultVolumeM3: 1.0, sortOrder: 86 },
  { key: "piano-upright", nameEl: "Πιάνο όρθιο", nameEn: "Upright piano", category: "other", defaultVolumeM3: 1.5, sortOrder: 87 },
  { key: "safe", nameEl: "Χρηματοκιβώτιο", nameEn: "Safe", category: "other", defaultVolumeM3: 0.3, sortOrder: 88 },
];

async function main() {
  console.log(`Seeding ${CATALOG.length} catalog items...`);
  for (const entry of CATALOG) {
    await db.itemCatalog.upsert({
      where: { key: entry.key },
      update: {
        nameEl: entry.nameEl,
        nameEn: entry.nameEn,
        category: entry.category,
        defaultVolumeM3: entry.defaultVolumeM3,
        sortOrder: entry.sortOrder,
        isActive: true,
      },
      create: {
        key: entry.key,
        nameEl: entry.nameEl,
        nameEn: entry.nameEn,
        category: entry.category,
        defaultVolumeM3: entry.defaultVolumeM3,
        sortOrder: entry.sortOrder,
        isActive: true,
      },
    });
  }
  console.log("✓ Done.");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
