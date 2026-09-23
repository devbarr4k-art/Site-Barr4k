export type Partner = { id: string; name: string; image_url: string; link_url: string; sort_order?: number };

// Usados enquanto a tabela "partners" não existe no banco (ou se ela falhar)
export const DEFAULT_PARTNERS: Partner[] = [
  { id: "csgoroll", name: "CSGOROLL", image_url: "/parceiro1.png", link_url: "https://www.csgoroll.com/r/BARRAK" },
  { id: "csgobig", name: "CSGOBIG", image_url: "/parceiro2.png", link_url: "https://csgobig.com/#!/r/barr4k" },
  { id: "fallen", name: "Fallen Store", image_url: "/parceiro3.png", link_url: "https://www.fallenstore.com.br/" },
];

// Tamanho ideal do banner (o card tem ~384 × 450 no computador e a imagem aparece inteira)
export const PARTNER_IMAGE_SIZE = { size: "700 × 820 px", tip: "Imagem em pé; aparece inteira, sem corte." };
