'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowser } from '@/lib/supabase/browser';
import { squareJpeg } from '@/lib/image-client';
import { Avatar } from '@/components/Avatar';
import { createAvatarUpload, removeAvatar, saveAvatar } from './actions';

export function AvatarUploader({ name, color, src }: { name: string; color: string; src: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [removing, startRemove] = useTransition();
  const shown = preview ?? src;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const blob = await squareJpeg(file);
      const target = await createAvatarUpload();
      if ('error' in target) throw new Error(target.error);
      const { error } = await createBrowser()
        .storage.from('avatars')
        .uploadToSignedUrl(target.path, target.token, blob, { contentType: 'image/jpeg' });
      if (error) throw new Error('Upload failed. Check your connection and try again.');
      const saved = await saveAvatar(target.path);
      if ('error' in saved) throw new Error(saved.error);
      setPreview(URL.createObjectURL(blob));
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  function onRemove() {
    setMessage('');
    startRemove(async () => {
      const res = await removeAvatar({}, new FormData());
      if (res.error) setMessage(res.error);
      else setPreview(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      <Avatar name={name} color={color} size={96} src={shown} />
      <div className="flex flex-col gap-2">
        <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onFile(e.target.files?.[0])} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-dark btn-sm" disabled={busy || removing} onClick={() => input.current?.click()}>
            {busy ? 'Uploading…' : shown ? 'Change picture' : 'Add picture'}
          </button>
          {shown && (
            <button type="button" className="btn-outline btn-sm" disabled={busy || removing} onClick={onRemove}>
              {removing ? 'Removing…' : 'Remove'}
            </button>
          )}
        </div>
        <p className="text-[13px] text-muted">Cropped to a square. Everyone in the challenge can see it.</p>
        {message && (
          <p className="text-[13px] font-semibold text-warn" role="alert">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
