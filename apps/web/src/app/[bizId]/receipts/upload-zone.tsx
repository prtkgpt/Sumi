'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';

export function UploadZone({ bizId }: { bizId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      setUploading((n) => n + list.length);
      let succeeded = 0;
      let matched = 0;
      for (const file of list) {
        try {
          const fd = new FormData();
          fd.set('bizId', bizId);
          fd.set('file', file);
          const r = await fetch('/api/receipts/upload', {
            method: 'POST',
            body: fd,
          });
          if (!r.ok) {
            const text = await r.text();
            toast.error(`${file.name}: ${text || r.statusText}`);
            continue;
          }
          const j = (await r.json()) as { status: string };
          succeeded++;
          if (j.status === 'matched') matched++;
        } catch (e) {
          toast.error(
            `${file.name}: ${e instanceof Error ? e.message : 'failed'}`
          );
        } finally {
          setUploading((n) => n - 1);
        }
      }
      if (succeeded > 0) {
        toast.success(
          `Uploaded ${succeeded} receipt${succeeded === 1 ? '' : 's'}${
            matched > 0 ? ` · ${matched} matched` : ''
          }.`
        );
      }
      router.refresh();
    },
    [bizId, router]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length > 0) upload(e.dataTransfer.files);
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input px-6 py-10 text-center transition-colors hover:border-foreground/40',
        dragging && 'border-foreground/60 bg-secondary/40'
      )}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) upload(e.target.files);
          e.target.value = '';
        }}
      />
      <Upload className="size-7 text-muted-foreground" />
      <p className="text-sm font-medium">
        {uploading > 0
          ? `Uploading ${uploading} receipt${uploading === 1 ? '' : 's'}…`
          : 'Drop receipts here or click to upload'}
      </p>
      <p className="text-xs text-muted-foreground">
        JPG, PNG, WebP, GIF, or PDF · up to 10 MB each
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
      >
        Choose files
      </Button>
    </div>
  );
}
