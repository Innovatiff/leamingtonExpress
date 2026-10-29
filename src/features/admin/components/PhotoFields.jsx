// Photo of a hotel, restaurant or place on a trip: a link or an upload, its
// credit, and whether it shows the place itself or only its area / an example.
import { useRef, useState } from "react";
import { CloudArrowUp } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { Photo } from "@/components/ui/Misc";
import { useToast } from "@/context/ToastContext";
import { canUpload, uploadImage } from "../upload";

const SHOWS = [
  { value: "", label: "The place itself" },
  { value: "area", label: "The area around it" },
  { value: "representative", label: "An example, not this place" },
];

export function PhotoFields({ value: v, onChange, folder = "express/trips" }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const set = (patch) => onChange({ ...v, ...patch });

  async function onFile(file) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, folder, 1200);
      set({ image: url, photoBy: "", photoLicense: "", photoLink: "", photoMatch: "" });
      toast.success("Photo added");
    } catch (e) {
      toast.error(e.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="ad-photo-fields span-2">
      <div className="ad-photo-fields__thumb">
        <Photo src={v.image} sizes="140px" w={280} />
        {canUpload && (
          <>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            <Button size="sm" variant="secondary" icon={CloudArrowUp} loading={uploading} onClick={() => fileRef.current?.click()}>
              Upload
            </Button>
          </>
        )}
      </div>
      <div className="form-grid">
        <TextField className="span-2" label="Photo link" value={v.image || ""} onChange={(e) => set({ image: e.target.value.trim() })} placeholder="https://…" />
        <TextField label="Photo by" optional="optional" value={v.photoBy || ""} onChange={(e) => set({ photoBy: e.target.value })} />
        <SelectField label="The photo shows" value={v.photoMatch || ""} onChange={(e) => set({ photoMatch: e.target.value })} options={SHOWS} />
        <TextField label="License" optional="optional" value={v.photoLicense || ""} onChange={(e) => set({ photoLicense: e.target.value })} placeholder="CC BY-SA 4.0" />
        <TextField label="Photo page" optional="optional" value={v.photoLink || ""} onChange={(e) => set({ photoLink: e.target.value.trim() })} placeholder="https://commons.wikimedia.org/wiki/File:…" />
      </div>
    </div>
  );
}
