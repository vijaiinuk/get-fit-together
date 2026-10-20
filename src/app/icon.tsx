import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

// Home-screen icon: the FitLeague pulse line on the app's dark background.
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#14181F' }}>
        <svg width="62%" height="62%" viewBox="0 0 24 24" fill="none" stroke="#F08C4B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h4l3-8 4 16 3-8h4" />
        </svg>
      </div>
    ),
    size,
  );
}
