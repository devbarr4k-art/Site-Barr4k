// Redimensiona e comprime uma imagem no navegador, devolvendo um data URL webp.
// As imagens ficam salvas como texto no banco, então precisam ser pequenas.
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
