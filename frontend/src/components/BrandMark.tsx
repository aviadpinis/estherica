interface BrandMarkProps {
  compact?: boolean
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className={`brand-mark ${compact ? "brand-mark--compact" : ""}`}>
      <img src="/brand-mark.png" alt="לוגו אסתריקה" className="brand-mark__image" />
    </div>
  )
}
