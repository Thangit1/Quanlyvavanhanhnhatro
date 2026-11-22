"use client";

import { useEffect, useRef, useState } from "react";
import { IMAGE_TYPES, imageFileError, PropertyImage } from "./image-upload";

export const MAX_ROOM_IMAGES = 10;
export type RoomImageDraft = { id: string; url: string; file?: File };

export function RoomGallery({
  images,
  cover,
}: {
  images: string[];
  cover?: string;
}) {
  const urls = [...new Set([...images, cover].filter((x): x is string => !!x))];
  const [selected, setSelected] = useState(cover || urls[0]);
  const dialog = useRef<HTMLDialogElement>(null);
  const index = Math.max(0, urls.indexOf(selected));
  const move = (n: number) =>
    setSelected(urls[(index + n + urls.length) % urls.length]);
  return (
    <section aria-label="Thư viện ảnh phòng" className="space-y-3">
      <div className="relative">
        <PropertyImage
          src={urls[index]}
          alt={`Ảnh phòng ${index + 1}`}
          className="h-72 w-full sm:h-96"
          canView={false}
        />
        {!!urls.length && (
          <button
            type="button"
            onClick={() => dialog.current?.showModal()}
            className="absolute bottom-3 right-3 rounded-xl border bg-card px-4 py-2"
          >
            Xem toàn màn hình
          </button>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {urls.map((url, n) => (
          <button
            type="button"
            key={url}
            aria-label={`Xem ảnh ${n + 1}`}
            aria-pressed={index === n}
            onClick={() => setSelected(url)}
            className={`shrink-0 rounded-xl border-2 p-1 ${index === n ? "border-primary" : "border-transparent"}`}
          >
            <PropertyImage
              src={url}
              alt={`Ảnh thu nhỏ ${n + 1}`}
              className="h-20 w-28"
              canView={false}
            />
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        aria-label="Xem ảnh phòng toàn màn hình"
        className="fixed inset-0 m-auto w-[95vw] max-w-6xl rounded-2xl bg-card p-4 backdrop:bg-black/80"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") move(-1);
          if (e.key === "ArrowRight") move(1);
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={urls.length < 2}
            onClick={() => move(-1)}
          >
            ← Trước
          </button>
          <span>
            {index + 1}/{urls.length}
          </span>
          <button
            type="button"
            disabled={urls.length < 2}
            onClick={() => move(1)}
          >
            Sau →
          </button>
          <button type="button" onClick={() => dialog.current?.close()}>
            Đóng
          </button>
        </div>
        <PropertyImage
          src={urls[index]}
          alt={`Ảnh phòng ${index + 1}`}
          className="h-[75vh] w-full"
          canView={false}
        />
      </dialog>
    </section>
  );
}

export function RoomImages({
  value,
  cover,
  onChange,
  onCover,
  disabled,
  progress,
  onValidating,
}: {
  value: RoomImageDraft[];
  cover: string;
  onChange: (items: RoomImageDraft[]) => void;
  onCover: (id: string) => void;
  disabled: boolean;
  progress?: number;
  onValidating: (pending: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [validating, setValidating] = useState(false);
  const busy = disabled || validating;
  const ownedUrls = useRef(new Set<string>());
  const choosing = useRef(false);
  useEffect(() => {
    const owned = ownedUrls.current;
    return () => {
      for (const url of owned) URL.revokeObjectURL(url);
    };
  }, []);
  const choose = async (files: FileList | null) => {
    if (!files?.length || disabled || choosing.current) return;
    if (value.length + files.length > MAX_ROOM_IMAGES) {
      setError("Mỗi phòng tối đa 10 ảnh.");
      return;
    }
    choosing.current = true;
    setValidating(true);
    onValidating(true);
    setError("");
    const added: RoomImageDraft[] = [];
    try {
      for (const file of Array.from(files)) {
        const message = imageFileError(file);
        if (message) throw new Error(message);
        const bitmap = await createImageBitmap(file);
        try {
          if (
            bitmap.width > 16384 ||
            bitmap.height > 16384 ||
            bitmap.width * bitmap.height > 32_000_000
          )
            throw new Error(
              "Ảnh tối đa 32 triệu điểm ảnh và 16384px mỗi chiều.",
            );
        } finally {
          bitmap.close();
        }
        const url = URL.createObjectURL(file);
        ownedUrls.current.add(url);
        added.push({ id: crypto.randomUUID(), url, file });
      }
      onChange([...value, ...added]);
      if (!cover && added.length) onCover(added[0].id);
    } catch (e) {
      for (const item of added) {
        URL.revokeObjectURL(item.url);
        ownedUrls.current.delete(item.url);
      }
      setError(
        e instanceof DOMException
          ? "File không phải ảnh hợp lệ hoặc đã bị hỏng."
          : e instanceof Error
            ? e.message
            : "File không phải ảnh hợp lệ.",
      );
    } finally {
      choosing.current = false;
      setValidating(false);
      onValidating(false);
    }
  };
  const reorder = (n: number, direction: number) => {
    const items = [...value];
    [items[n], items[n + direction]] = [items[n + direction], items[n]];
    onChange(items);
  };
  return (
    <section aria-label="Hình ảnh phòng" className="surface-card space-y-4 p-6">
      <h2 className="text-lg font-bold">Hình ảnh phòng</h2>
      <input
        ref={input}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        multiple
        disabled={busy}
        aria-label="Chọn ảnh phòng từ thiết bị"
        className="sr-only"
        onChange={(e) => {
          void choose(e.target.files);
          e.target.value = "";
        }}
      />
      <div
        className="rounded-2xl border-2 border-dashed bg-muted p-6 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void choose(e.dataTransfer.files);
        }}
      >
        <button
          type="button"
          disabled={busy || value.length >= MAX_ROOM_IMAGES}
          onClick={() => input.current?.click()}
          className="w-full space-y-2 disabled:opacity-50"
        >
          <span className="block">
            Nhấn để chọn ảnh hoặc kéo thả ảnh vào đây
          </span>
          <span className="block text-sm text-muted-foreground">
            Hỗ trợ JPG, PNG, WEBP — tối đa 5 MB/ảnh, 10 ảnh/phòng
          </span>
          <span className="mt-3 inline-block rounded-xl bg-primary px-4 py-2 text-white">
            {value.length ? "Thêm ảnh" : "Chọn ảnh từ thiết bị"}
          </span>
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        {value.length}/{MAX_ROOM_IMAGES} ảnh · Thay đổi chỉ áp dụng khi lưu
        phòng.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {value.map((item, n) => (
          <article
            key={item.id}
            className="min-w-0 space-y-2 rounded-xl border bg-card p-3"
          >
            <PropertyImage
              src={item.url}
              alt={`Ảnh phòng ${n + 1}`}
              className="h-40 w-full"
            />
            {item.id === cover && (
              <span className="inline-block rounded-lg bg-accent px-2 py-1 text-xs font-bold text-link">
                Ảnh đại diện
              </span>
            )}
            <p className="truncate text-xs" title={item.file?.name}>
              {item.file
                ? `${item.file.name} · ${(item.file.size / 1024 / 1024).toFixed(2)} MB · Chờ lưu`
                : "Đã lưu"}
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                disabled={busy || item.id === cover}
                onClick={() => onCover(item.id)}
                className="rounded-lg border px-2 py-1 disabled:opacity-50"
              >
                Đặt làm ảnh đại diện
              </button>
              <button
                type="button"
                aria-label={`Đưa ảnh ${n + 1} lên trước`}
                disabled={busy || n === 0}
                onClick={() => reorder(n, -1)}
                className="rounded-lg border px-2 py-1 disabled:opacity-50"
              >
                ←
              </button>
              <button
                type="button"
                aria-label={`Đưa ảnh ${n + 1} ra sau`}
                disabled={busy || n === value.length - 1}
                onClick={() => reorder(n, 1)}
                className="rounded-lg border px-2 py-1 disabled:opacity-50"
              >
                →
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border px-2 py-1 text-danger"
                onClick={() => {
                  if (
                    !window.confirm(
                      "Xóa ảnh này? Thay đổi chỉ áp dụng khi lưu phòng.",
                    )
                  )
                    return;
                  const items = value.filter((x) => x.id !== item.id);
                  onChange(items);
                  if (cover === item.id) onCover(items[0]?.id || "");
                  if (item.file) {
                    URL.revokeObjectURL(item.url);
                    ownedUrls.current.delete(item.url);
                  }
                }}
              >
                Xóa
              </button>
            </div>
          </article>
        ))}
      </div>
      {validating && <p role="status">Đang kiểm tra ảnh…</p>}
      {progress !== undefined && (
        <div role="status">
          <p>
            {progress < 100
              ? `Đang tải lên ${progress}%…`
              : "Đang xử lý và lưu phòng cùng ảnh…"}
          </p>
          <progress
            aria-label="Tiến độ tải ảnh phòng"
            max={100}
            value={progress}
            className="w-full"
          />
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
