// Shows a proof thumbnail that opens the full image in a new tab.
export function ProofImage({ url, alt, height = 180 }: { url?: string; alt: string; height?: number }) {
  if (!url) {
    return (
      <div className="flex items-center justify-center rounded-[10px] bg-line text-[13px] font-semibold text-muted" style={{ height }}>
        Proof unavailable
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[10px] bg-line">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} loading="lazy" className="w-full object-contain" style={{ height }} />
    </a>
  );
}
