import { useEffect, useState } from "react";
import { Camera, Loader2, X, ImageIcon, Check } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { uploadTaskPhoto, getTaskPhotoSignedUrl } from "@/lib/tasks";

/**
 * Photo evidence button for a task. Handles capture/upload from camera
 * or gallery, then calls onUploaded with the storage path.
 *
 * Modular: rendered conditionally based on `task.requires_photo`.
 */
export function TaskPhotoButton({
  taskId,
  branchId,
  userId,
  existingPath,
  onUploaded,
  disabled,
}: {
  taskId: string;
  branchId: string;
  userId: string | null;
  existingPath: string | null;
  onUploaded: (path: string) => void;
  disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!branchId) return;
    if (file.size > 12 * 1024 * 1024) {
      toast.error("התמונה גדולה מדי (מקסימום 12MB)");
      return;
    }
    // Be tolerant: files from Google Drive / cloud pickers often arrive
    // with empty `file.type`. Fall back to extension sniffing.
    const name = file.name || "";
    const looksImage =
      file.type.startsWith("image/") ||
      /\.(png|jpe?g|webp|heic|heif|gif|bmp|tiff?)$/i.test(name);
    const looksPdf = file.type === "application/pdf" || /\.pdf$/i.test(name);
    if (!looksImage && !looksPdf) {
      toast.error("יש לבחור קובץ תמונה או PDF");
      return;
    }
    setUploading(true);
    try {
      const { path } = await uploadTaskPhoto(file, { branchId, taskId, userId });
      onUploaded(path);
      toast.success("התמונה הועלתה בהצלחה");
    } catch (e) {
      console.error("task photo upload failed", e);
      toast.error(e instanceof Error ? e.message : "העלאת התמונה נכשלה");
    } finally {
      setUploading(false);
    }
  };

  const openLightbox = async () => {
    if (!existingPath) return;
    const url = await getTaskPhotoSignedUrl(existingPath);
    if (!url) {
      toast.error("לא ניתן לטעון את התמונה");
      return;
    }
    setLightboxUrl(url);
  };

  const inputId = `photo-${taskId}`;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          id={inputId}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void handleFile(f);
          }}
        />
        <label
          htmlFor={inputId}
          className={`inline-flex items-center justify-center gap-1.5 h-11 px-3 rounded-md text-[12px] font-bold border transition cursor-pointer ${
            existingPath
              ? "border-success/50 text-success bg-success/10 hover:bg-success/20"
              : "border-pink-500/60 text-pink-300 bg-pink-500/10 hover:bg-pink-500/20"
          } ${disabled || uploading ? "opacity-60 cursor-not-allowed" : ""}`}
          aria-label={existingPath ? "החלפת תמונה" : "העלאת תמונה"}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : existingPath ? (
            <Check className="h-4 w-4" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          <span>{existingPath ? "תמונה הועלתה" : "העלאת תמונה"}</span>
        </label>

        {existingPath && (
          <button
            type="button"
            onClick={openLightbox}
            className="inline-flex items-center justify-center gap-1.5 h-11 px-3 rounded-md text-[12px] font-bold border border-border text-foreground/80 bg-card hover:bg-card/80 transition"
            aria-label="צפייה בתמונה"
          >
            <ImageIcon className="h-4 w-4" />
            <span>צפייה</span>
          </button>
        )}
      </div>

      <TaskPhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </>
  );
}

export function TaskPhotoLightbox({
  url,
  onClose,
}: {
  url: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!url} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        dir="rtl"
        className="bg-zinc-950 border border-zinc-800 max-w-3xl p-2 sm:p-4"
      >
        <button
          onClick={onClose}
          aria-label="סגור"
          className="absolute top-2 left-2 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/80"
        >
          <X className="h-4 w-4" />
        </button>
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="ראיית ביצוע משימה"
            className="w-full h-auto max-h-[80vh] object-contain rounded"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Small async thumbnail that resolves a signed URL from a storage path.
 * Used in admin views to show evidence next to completed tasks.
 */
export function TaskPhotoThumb({
  path,
  onOpen,
  size = 44,
}: {
  path: string | null;
  onOpen: (url: string) => void;
  size?: number;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!path) {
      setUrl(null);
      return;
    }
    setLoading(true);
    void getTaskPhotoSignedUrl(path).then((u) => {
      if (active) {
        setUrl(u);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [path]);

  if (!path) return null;
  return (
    <button
      type="button"
      onClick={() => url && onOpen(url)}
      className="relative shrink-0 rounded-md overflow-hidden border border-success/40 bg-card hover:border-success transition"
      style={{ width: size, height: size }}
      aria-label="צפייה בתמונת ביצוע"
      title="צפייה בתמונת ביצוע"
    >
      {loading || !url ? (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : (
        <img src={url} alt="ראיית ביצוע" className="w-full h-full object-cover" />
      )}
    </button>
  );
}
