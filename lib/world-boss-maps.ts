/**
 * Mapas do World Boss: estrutura fixa do jogo usada só como referência de
 * distribuição. Nenhum jogador é cadastrado aqui — as células ficam vazias
 * para o time montar a escalação.
 */

export type WorldBossMapGroup = {
  key: string;
  bosses: string[];
};

/** Duas listas de bosses por período, como na planilha do time. */
export const WORLD_BOSS_MAP_GROUPS: WorldBossMapGroup[] = [
  {
    key: "list-1",
    bosses: [
      "Bicheon",
      "Demon Bull",
      "Snake",
      "Abandoned Mine",
      "Heavens Way",
      "Redmoon",
      "Phantasia",
      "Rockut",
      "Sabuk",
      "Nine Dragon",
    ],
  },
  {
    key: "list-2",
    bosses: ["Bicheon", "Snake", "Redmoon", "Phantasia", "Sagitarion"],
  },
];

/** Bosses livres: quem está fora do cronograma entra neles. */
export const WORLD_BOSS_FFA_BOSSES = ["Krukan", "Utukan", "Nerkan", "Turkan", "Hellbar", "Ragnos"];

export type PurgatoryTime = {
  at: string;
  power?: string;
};

export type PurgatoryFloor = {
  key: string;
  label: string;
  power: string;
  times?: PurgatoryTime[];
};

export const PURGATORY_FLOORS: PurgatoryFloor[] = [
  { key: "1f-4f", label: "Purgatory 1F–4F", power: "400K" },
  { key: "5f", label: "Purgatory 5F", power: "500K" },
  { key: "6f", label: "Purgatory 6F", power: "650K" },
  {
    key: "7f",
    label: "Purgatory 7F",
    power: "650K",
    times: [
      { at: "06:00", power: "700K+" },
      { at: "12:00" },
      { at: "18:00" },
      { at: "00:00", power: "700K+" },
    ],
  },
];

export type WorldBossLayer = {
  key: string;
  label: string;
  columns: number;
  channels: string[];
};

/** Canais (W) de cada camada, na ordem em que aparecem no quadro. */
export const WORLD_BOSS_LAYERS: WorldBossLayer[] = [
  {
    key: "layer-3",
    label: "Layer 3",
    columns: 4,
    channels: ["W1", "W7", "W2", "W3", "W8", "W4", "W5", "W6"],
  },
  {
    key: "layer-1",
    label: "Layer 1",
    columns: 2,
    channels: ["W1", "W3", "W2"],
  },
];
