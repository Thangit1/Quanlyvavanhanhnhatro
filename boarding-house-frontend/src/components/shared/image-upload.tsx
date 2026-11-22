/* eslint-disable @next/next/no-img-element, react-hooks/set-state-in-effect */
"use client";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, ImageOff, X } from "lucide-react";
import { apiClient } from "@/services/api-client";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export function imageFileError(file: File) {
  if (
    !IMAGE_TYPES.includes(file.type) ||
    !/\.(jpe?g|png|webp)$/i.test(file.name)
  )
    return "Chỉ hỗ trợ ảnh JPG, PNG và WEBP.";
  if (!file.size) return "File ảnh rỗng.";
  if (file.size > MAX_IMAGE_BYTES) return "Ảnh vượt quá 5MB.";
  return "";
}
function useImageSource(value?: string) {
  const [loaded, setLoaded] = useState({ value: "", src: "", failed: false });
  const managed =
    !!value &&
    (value.startsWith("/admin/properties/") ||
      /^\/tenant\/contracts\/\d+\/room-images\//.test(value));
  useEffect(() => {
    if (!managed || !value) return;
    const controller = new AbortController();
    let objectUrl = "";
    apiClient
      .get<Blob>(value, { responseType: "blob", signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(data);
        setLoaded({ value, src: objectUrl, failed: false });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setLoaded({ value, src: "", failed: true });
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [managed, value]);
  return managed
    ? loaded.value === value
      ? loaded
      : { src: "", failed: false }
    : {
        src: value && /^(https?:\/\/|blob:)/.test(value) ? value : "",
        failed: false,
      };
}
export function PropertyImage({
  src,
  alt,
  className = "h-44 w-full",
  canView = true,
}: {
  src?: string;
  alt: string;
  className?: string;
  canView?: boolean;
}) {
  const resolved = useImageSource(src);
  const [broken, setBroken] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const available = resolved.src && broken !== resolved.src;
  const failed = resolved.failed || (!!resolved.src && broken === resolved.src);
  return (
    <>
      <div
        className={`${className} relative overflow-hidden rounded-xl bg-muted`}
      >
        {available ? (
          <img
            src={resolved.src}
            alt={alt}
            className="size-full object-contain"
            onError={() => setBroken(resolved.src)}
          />
        ) : (
          <div
            role="img"
            aria-label={
              failed
                ? "Ảnh không tồn tại hoặc không có quyền truy cập"
                : "Chưa có ảnh nhà trọ"
            }
            className="grid size-full place-content-center gap-2 text-center text-xs text-muted-foreground"
          >
            <ImageOff className="mx-auto size-7" />
            {failed
              ? "Không tải được ảnh"
              : src
                ? "Đang tải ảnh…"
                : "Chưa có ảnh"}
          </div>
        )}
        {available && canView && (
          <button
            type="button"
            onClick={() => dialog.current?.showModal()}
            className="absolute bottom-2 right-2 rounded-lg bg-card/95 px-3 py-1 text-sm font-semibold text-foreground shadow"
          >
            Xem ảnh
          </button>
        )}
      </div>
      {canView && (
        <dialog
          ref={dialog}
          aria-label={alt}
          className="fixed inset-0 m-auto max-h-[90vh] w-[min(90vw,1000px)] rounded-2xl bg-card p-4 backdrop:bg-black/70"
        >
          <button
            type="button"
            aria-label="Đóng ảnh"
            onClick={() => dialog.current?.close()}
            className="mb-3 flex items-center gap-2"
          >
            <X />
            Đóng
          </button>
          {available && (
            <img
              src={resolved.src}
              alt={alt}
              className="max-h-[75vh] w-full object-contain"
            />
          )}
        </dialog>
      )}
    </>
  );
}
export function ImageUpload({
  currentImage,
  file,
  onChange,
  onRemove,
  disabled,
  progress,
  onValidationChange,
}: {
  currentImage?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  onRemove: () => void;
  disabled?: boolean;
  progress?: number;
  onValidationChange?: (pending: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const attempt = useRef(0);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(
    () => () => {
      attempt.current++;
    },
    [],
  );
  const choose = async (files: FileList | File[] | null) => {
    if (disabled || !files?.length) return;
    const current = ++attempt.current;
    onValidationChange?.(false);
    if (files.length !== 1) {
      setError("Vui lòng chọn một ảnh đại diện.");
      return;
    }
    const next = files[0],
      invalid = imageFileError(next);
    setError(invalid);
    if (invalid) return;
    onValidationChange?.(true);
    try {
      const decoded = await createImageBitmap(next);
      try {
        if (
          decoded.width * decoded.height > 32_000_000 ||
          decoded.width > 16384 ||
          decoded.height > 16384
        )
          throw Error("Ảnh tối đa 32 triệu điểm ảnh và 16384px mỗi chiều.");
      } finally {
        decoded.close();
      }
      if (current === attempt.current) onChange(next);
    } catch (e) {
      if (current === attempt.current)
        setError(
          e instanceof Error && e.message.startsWith("Ảnh tối đa")
            ? e.message
            : "File không phải ảnh hợp lệ hoặc đã bị hỏng.",
        );
    } finally {
      if (current === attempt.current) onValidationChange?.(false);
    }
  };
  return (
    <section
      aria-label="Ảnh đại diện nhà trọ"
      className="space-y-3 sm:col-span-2"
    >
      <h3 className="text-sm font-semibold text-secondary-foreground">
        Ảnh đại diện nhà trọ
      </h3>
      <input
        ref={input}
        aria-label="Chọn ảnh đại diện nhà trọ"
        className="sr-only"
        type="file"
        accept={IMAGE_TYPES.join(",")}
        disabled={disabled}
        onChange={(e) => {
          void choose(e.target.files);
          e.target.value = "";
        }}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void choose(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed p-4 ${drag ? "border-ring bg-accent" : "border-border bg-muted"}`}
      >
        {(preview || currentImage) && (
          <PropertyImage
            src={preview || currentImage}
            alt="Ảnh đại diện nhà trọ"
            className="mb-4 h-56 w-full"
          />
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={() => input.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl p-4 text-center outline-offset-2 disabled:opacity-60"
        >
          <ImagePlus className="size-7 text-link" />
          <span>Nhấn để chọn ảnh hoặc kéo thả ảnh vào đây</span>
          <span className="text-xs text-muted-foreground">
            Hỗ trợ JPG, PNG, WEBP — tối đa 5MB
          </span>
        </button>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => input.current?.click()}
            className="rounded-lg border bg-card px-3 py-2 text-sm font-semibold"
          >
            {preview || currentImage ? "Thay ảnh" : "Chọn ảnh"}
          </button>
          {file && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                attempt.current++;
                onValidationChange?.(false);
                onChange(null);
                setError("");
              }}
              className="text-sm text-secondary-foreground"
            >
              Hủy lựa chọn
            </button>
          )}
          {(currentImage || file) && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (
                  window.confirm(
                    "Xóa ảnh đại diện? Thay đổi chỉ được áp dụng khi lưu nhà trọ.",
                  )
                ) {
                  attempt.current++;
                  onValidationChange?.(false);
                  onChange(null);
                  onRemove();
                  setError("");
                }
              }}
              className="text-sm font-semibold text-danger"
            >
              Xóa ảnh
            </button>
          )}
        </div>
      </div>
      {file && (
        <p className="break-all text-xs text-secondary-foreground">
          {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB · Ảnh mới sẽ
          được tải lên khi lưu nhà trọ.
        </p>
      )}
      {progress !== undefined && (
        <div role="status" className="text-sm text-link">
          {progress < 100
            ? `Đang tải lên ${progress}%…`
            : "Đang xử lý và lưu ảnh…"}
          <progress
            aria-label="Tiến độ tải ảnh"
            value={progress}
            max={100}
            className="mt-1 w-full"
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
