export type Partner = { id: string; name: string; image_url: string; link_url: string; sort_order?: number };

// Usados enquanto a tabela "partners" não existe no banco (ou se ela falhar)
export const DEFAULT_PARTNERS: Partner[] = [
  { id: "csgoroll", name: "CSGOROLL", image_url: "/parceiro1.png", link_url: "https://www.csgoroll.com/r/BARRAK" },
  { id: "csgobig", name: "CSGOBIG", image_url: "/parceiro2.png", link_url: "https://csgobig.com/#!/r/barr4k" },
  { id: "fallen", name: "Fallen Store", image_url: "/parceiro3.png", link_url: "https://www.fallenstore.com.br/" },
];

// Card do parceiro é quadrado
export const PARTNER_IMAGE_SIZE = { size: "1000 × 1000 px", tip: "Imagem quadrada; aparece inteira, sem corte." };
