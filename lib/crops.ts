export interface CropTypeInfo {
  value: string
  label: string
  /** Hue (oklch degrees) used to tint the generative artwork for lots without photos. */
  hue: number
}

export const CROP_TYPES: CropTypeInfo[] = [
  { value: "wheat", label: "Wheat", hue: 80 },
  { value: "rice", label: "Rice", hue: 105 },
  { value: "corn", label: "Corn", hue: 92 },
  { value: "barley", label: "Barley", hue: 70 },
  { value: "soybean", label: "Soybean", hue: 120 },
  { value: "coffee", label: "Coffee", hue: 45 },
  { value: "cotton", label: "Cotton", hue: 250 },
  { value: "tomato", label: "Tomato", hue: 28 },
  { value: "potato", label: "Potato", hue: 60 },
  { value: "onion", label: "Onion", hue: 340 },
  { value: "spices", label: "Spices", hue: 38 },
  { value: "fruit", label: "Fruit", hue: 15 },
  { value: "other", label: "Other", hue: 150 },
]

export const UNITS = [
  { value: "kg", label: "Kilogram (kg)" },
  { value: "ton", label: "Metric ton" },
  { value: "quintal", label: "Quintal (100 kg)" },
  { value: "bushel", label: "Bushel" },
  { value: "liter", label: "Liter" },
  { value: "piece", label: "Piece" },
]

export const GRADES = [
  { value: "A", label: "Grade A · Premium" },
  { value: "B", label: "Grade B · Good" },
  { value: "C", label: "Grade C · Standard" },
]

export function cropTypeInfo(value?: string | null): CropTypeInfo {
  return CROP_TYPES.find((t) => t.value === value) ?? { value: value ?? "other", label: titleCase(value ?? "Other"), hue: 150 }
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
