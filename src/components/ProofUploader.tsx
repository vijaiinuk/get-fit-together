'use client';

import { useEffect, useRef, useState } from 'react';
import { createBrowser } from '@/lib/supabase/browser';
import { createProofUpload } from '@/lib/proofs';
import { decode } from '@/lib/image-client';

const MAX_SIDE = 1280;
const DIRECT_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_DIRECT_BYTES = 2 * 1024 * 1024; // matches the bucket's file_size_limit

// Shrinks the image in the browser (max 1280px, JPEG) so a month of proofs fits the free storage tier.
// If the image can't be processed but is already small and in an accepted format, it's uploaded as is.
async function prepare(file: File): Promise<{ blob: Blob; contentType: string }> {
  try {
    const img = await decode(file);
    try {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('This browser cannot process images.');
      ctx.fillStyle = '#fff'; // transparent PNG screenshots would otherwise turn black as JPEG
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img.source, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.72));
      if (!blob || blob.size === 0) throw new Error('Could not read that image.');
      return { blob, contentType: 'image/jpeg' };
    } finally {
      img.close();
    }
  } catch (e) {
    if (DIRECT_UPLOAD_TYPES.includes(file.type) && file.size <= MAX_DIRECT_BYTES) {
      return { blob: file, contentType: file.type };
    }
    throw e;
  }
}

export function ProofUploader({
  name = 'proof_path',
  label = 'Add screenshot or photo',
  hint = 'Watch or phone screenshot, or a gym photo if you don’t have a device',
  compact = false,
}: {
  name?: string;
  label?: string;
  hint?: string;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const stateRef = useRef(state);
  stateRef.current = state;

  // Stop the surrounding form from submitting without a finished upload. Runs in the capture
  // phase so React's form action never sees the event.
  useEffect(() => {
    const form = hidden.current?.form;
    if (!form) return;
    const guard = (e: SubmitEvent) => {
      if (stateRef.current === 'done') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setMessage(stateRef.current === 'uploading' ? 'Wait for the upload to finish.' : 'Add a proof screenshot or photo first.');
      if (stateRef.current !== 'uploading') setState('error');
    };
    form.addEventListener('submit', guard, true);
    return () => form.removeEventListener('submit', guard, true);
  }, []);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setState('uploading');
    setMessage('');
    setPath('');
    try {
      const { blob, contentType } = await prepare(file);
      const target = await createProofUpload(contentType);
      if ('error' in target) throw new Error(target.error);
      const { error } = await createBrowser()
        .storage.from('proofs')
        .uploadToSignedUrl(target.path, target.token, blob, { contentType });
      if (error) {
        console.error('[proof upload]', error);
        throw new Error('Upload failed. Check your connection and try again.');
      }
      setPath(target.path);
      setPreview(URL.createObjectURL(blob));
      setState('done');
    } catch (e) {
      setState('error');
      setMessage(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      // Let the same file be picked again after a failure.
      if (input.current) input.current.value = '';
    }
  }

  const border = state === 'done' ? 'border-[#15803D] bg-okbg' : state === 'error' ? 'border-warn bg-warnbg' : 'border-edge bg-[#FAFAF8]';

  return (
    <div className="flex flex-col gap-1.5">
      <input ref={hidden} type="hidden" name={name} value={path} />
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={state === 'uploading'}
        className={`flex items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 text-ink ${border} ${
          compact ? 'min-h-[44px] text-[13px] font-semibold' : 'min-h-[96px] flex-col font-semibold'
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Proof preview" className={compact ? 'h-8 w-8 rounded object-cover' : 'h-16 rounded object-contain'} />
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="11" r="2" />
            <path d="M21 17l-5-5-8 7" />
          </svg>
        )}
        <span>
          {state === 'uploading' ? 'Uploading…' : state === 'done' ? 'Proof attached · tap to change' : label}
        </span>
        {!compact && state !== 'done' && <span className="text-[13px] font-normal text-muted">{hint}</span>}
      </button>
      {message && (
        <p className="text-[13px] font-semibold text-warn" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
