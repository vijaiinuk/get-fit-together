const tones = {
  ok: 'bg-okbg text-ok',
  warn: 'bg-warnbg text-warn',
  bad: 'bg-badbg text-bad',
  info: 'bg-infobg text-info',
  muted: 'bg-line text-[#3F4652]',
  dark: 'bg-ink text-white',
} as const;

export type Tone = keyof typeof tones;

export function Pill({ tone = 'muted', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
