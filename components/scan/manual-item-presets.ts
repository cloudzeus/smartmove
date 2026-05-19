export interface ItemPreset {
  id: string;
  name: string;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  category: ItemCategory;
}

export type ItemCategory =
  | "living"
  | "bedroom"
  | "kitchen"
  | "bathroom"
  | "office"
  | "outdoor"
  | "boxes";

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  living: "Καθιστικό",
  bedroom: "Υπνοδωμάτιο",
  kitchen: "Κουζίνα",
  bathroom: "Μπάνιο",
  office: "Γραφείο",
  outdoor: "Εξωτερικός χώρος",
  boxes: "Κουτιά & δέματα",
};

export const ITEM_PRESETS: ItemPreset[] = [
  // Καθιστικό
  { id: "sofa-3", name: "Τριθέσιος καναπές", length_cm: 200, width_cm: 90, height_cm: 85, category: "living" },
  { id: "sofa-2", name: "Διθέσιος καναπές", length_cm: 160, width_cm: 85, height_cm: 85, category: "living" },
  { id: "armchair", name: "Πολυθρόνα", length_cm: 90, width_cm: 85, height_cm: 85, category: "living" },
  { id: "coffee-table", name: "Τραπεζάκι σαλονιού", length_cm: 120, width_cm: 70, height_cm: 45, category: "living" },
  { id: "tv-unit", name: "Έπιπλο τηλεόρασης", length_cm: 160, width_cm: 40, height_cm: 50, category: "living" },
  { id: "bookshelf", name: "Βιβλιοθήκη", length_cm: 100, width_cm: 30, height_cm: 200, category: "living" },
  { id: "tv-55", name: "Τηλεόραση 55\"", length_cm: 130, width_cm: 8, height_cm: 80, category: "living" },
  { id: "dining-table", name: "Τραπέζι τραπεζαρίας", length_cm: 180, width_cm: 90, height_cm: 75, category: "living" },
  { id: "dining-chair", name: "Καρέκλα τραπεζαρίας", length_cm: 45, width_cm: 50, height_cm: 90, category: "living" },
  { id: "carpet", name: "Χαλί", length_cm: 200, width_cm: 30, height_cm: 30, category: "living" },

  // Υπνοδωμάτιο
  { id: "bed-double", name: "Διπλό κρεβάτι", length_cm: 200, width_cm: 160, height_cm: 30, category: "bedroom" },
  { id: "bed-single", name: "Μονό κρεβάτι", length_cm: 200, width_cm: 90, height_cm: 30, category: "bedroom" },
  { id: "mattress-double", name: "Στρώμα διπλό", length_cm: 200, width_cm: 160, height_cm: 25, category: "bedroom" },
  { id: "mattress-single", name: "Στρώμα μονό", length_cm: 200, width_cm: 90, height_cm: 25, category: "bedroom" },
  { id: "wardrobe-3", name: "Ντουλάπα 3φυλλη", length_cm: 200, width_cm: 60, height_cm: 220, category: "bedroom" },
  { id: "wardrobe-4", name: "Ντουλάπα 4φυλλη", length_cm: 250, width_cm: 60, height_cm: 220, category: "bedroom" },
  { id: "nightstand", name: "Κομοδίνο", length_cm: 50, width_cm: 40, height_cm: 60, category: "bedroom" },
  { id: "dresser", name: "Συρταριέρα", length_cm: 100, width_cm: 50, height_cm: 100, category: "bedroom" },
  { id: "mirror", name: "Καθρέφτης", length_cm: 80, width_cm: 5, height_cm: 180, category: "bedroom" },

  // Κουζίνα
  { id: "fridge", name: "Ψυγείο", length_cm: 70, width_cm: 70, height_cm: 180, category: "kitchen" },
  { id: "freezer", name: "Καταψύκτης", length_cm: 60, width_cm: 65, height_cm: 90, category: "kitchen" },
  { id: "washer", name: "Πλυντήριο ρούχων", length_cm: 60, width_cm: 60, height_cm: 85, category: "kitchen" },
  { id: "dryer", name: "Στεγνωτήριο", length_cm: 60, width_cm: 60, height_cm: 85, category: "kitchen" },
  { id: "dishwasher", name: "Πλυντήριο πιάτων", length_cm: 60, width_cm: 60, height_cm: 85, category: "kitchen" },
  { id: "oven", name: "Φούρνος εντοιχιζόμενος", length_cm: 60, width_cm: 60, height_cm: 60, category: "kitchen" },
  { id: "cooker", name: "Κουζίνα ελεύθερη", length_cm: 60, width_cm: 60, height_cm: 90, category: "kitchen" },
  { id: "microwave", name: "Φούρνος μικροκυμάτων", length_cm: 50, width_cm: 40, height_cm: 30, category: "kitchen" },
  { id: "kitchen-table", name: "Τραπέζι κουζίνας", length_cm: 140, width_cm: 80, height_cm: 75, category: "kitchen" },
  { id: "kitchen-chair", name: "Καρέκλα κουζίνας", length_cm: 45, width_cm: 50, height_cm: 90, category: "kitchen" },

  // Μπάνιο
  { id: "washing-basket", name: "Καλάθι ρούχων", length_cm: 50, width_cm: 40, height_cm: 60, category: "bathroom" },
  { id: "bathroom-cab", name: "Ντουλάπι μπάνιου", length_cm: 80, width_cm: 40, height_cm: 80, category: "bathroom" },

  // Γραφείο
  { id: "desk", name: "Γραφείο", length_cm: 140, width_cm: 70, height_cm: 75, category: "office" },
  { id: "office-chair", name: "Καρέκλα γραφείου", length_cm: 60, width_cm: 60, height_cm: 110, category: "office" },
  { id: "filing", name: "Συρταριέρα γραφείου", length_cm: 50, width_cm: 60, height_cm: 70, category: "office" },
  { id: "printer", name: "Εκτυπωτής", length_cm: 50, width_cm: 40, height_cm: 30, category: "office" },
  { id: "monitor", name: "Οθόνη Η/Υ", length_cm: 60, width_cm: 25, height_cm: 50, category: "office" },

  // Εξωτερικός
  { id: "patio-table", name: "Τραπέζι βεράντας", length_cm: 120, width_cm: 80, height_cm: 75, category: "outdoor" },
  { id: "patio-chair", name: "Καρέκλα βεράντας", length_cm: 55, width_cm: 60, height_cm: 90, category: "outdoor" },
  { id: "grill", name: "Ψησταριά", length_cm: 110, width_cm: 60, height_cm: 110, category: "outdoor" },
  { id: "umbrella", name: "Ομπρέλα βεράντας", length_cm: 220, width_cm: 25, height_cm: 25, category: "outdoor" },
  { id: "bike", name: "Ποδήλατο", length_cm: 180, width_cm: 60, height_cm: 110, category: "outdoor" },

  // Ειδικά / Βαρέα
  { id: "piano-upright", name: "Πιάνο όρθιο", length_cm: 150, width_cm: 60, height_cm: 130, category: "living" },
  { id: "safe", name: "Χρηματοκιβώτιο", length_cm: 60, width_cm: 50, height_cm: 80, category: "office" },

  // Κουτιά
  { id: "box-l", name: "Κουτί μεγάλο", length_cm: 60, width_cm: 40, height_cm: 40, category: "boxes" },
  { id: "box-m", name: "Κουτί μέτριο", length_cm: 40, width_cm: 30, height_cm: 30, category: "boxes" },
  { id: "box-s", name: "Κουτί μικρό", length_cm: 30, width_cm: 20, height_cm: 20, category: "boxes" },
  { id: "suitcase", name: "Βαλίτσα μεγάλη", length_cm: 75, width_cm: 30, height_cm: 50, category: "boxes" },
  { id: "garment-bag", name: "Σακούλα ρούχων", length_cm: 60, width_cm: 20, height_cm: 110, category: "boxes" },
];

export function volumeM3(item: { length_cm: number; width_cm: number; height_cm: number }) {
  return (item.length_cm * item.width_cm * item.height_cm) / 1_000_000;
}
