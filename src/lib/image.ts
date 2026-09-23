import { supabase } from "@/lib/supabase";
import { adminApi } from "@/lib/adminApi";

// Redimensiona e comprime uma imagem no navegador, devolvendo um data URL webp.
// Usado para os comprovantes, que ficam salvos como texto no banco.
export function compressImage(file: File, max = 600, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > max) { height *= max / width; width = max; }
        } else if (height > max) {
          width *= max / height; height = max;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/webp", quality));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"];
const MAX_ORIGINAL_BYTES = 8 * 1024 * 1024;
const MAX_SIDE = 2560;

// Só reprocessa arquivos gigantes ou em formato não aceito; o resto vai como veio
async function prepareForUpload(file: File): Promise<Blob> {
  if (UPLOAD_TYPES.includes(file.type) && file.size <= MAX_ORIGINAL_BYTES) return file;
  const dataUrl = await compressImage(file, MAX_SIDE, 0.92);
  return (await fetch(dataUrl)).blob();
}

/** Envia a imagem de um prêmio para o Storage (qualidade original) e devolve a URL pública. */
export async function uploadGiveawayImage(file: File): Promise<string> {
  const blob = await prepareForUpload(file);
  const contentType = blob.type || file.type;
  const ext = contentType.split("/")[1] || "png";
  const { path, token, publicUrl } = await adminApi<{ path: string; token: string; publicUrl: string }>(
    "createUploadUrl",
    { ext }
  );
  const { error } = await supabase.storage.from("giveaways").uploadToSignedUrl(path, token, blob, { contentType });
  if (error) throw new Error("Falha ao enviar a imagem: " + error.message);
  return publicUrl;
}
