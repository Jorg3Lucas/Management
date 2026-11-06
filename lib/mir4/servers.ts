export type ServerSeed = {
  worldgroupId: number;
  groupName: string;
  worldId: number;
  code: string;
};

/**
 * Servidores publicados no ranking do fórum oficial do MIR4.
 * Extraído de https://forum.mir4global.com/rank (opções "server").
 * O "all" global não entra: ele não tem ranking próprio.
 */
export const FORUM_SERVERS: ServerSeed[] = [
  { worldgroupId: 21, groupName: "ASIA3", worldId: 911, code: "ASIA311" },
  { worldgroupId: 21, groupName: "ASIA3", worldId: 912, code: "ASIA312" },
  { worldgroupId: 21, groupName: "ASIA3", worldId: 913, code: "ASIA313" },
  { worldgroupId: 21, groupName: "ASIA3", worldId: 921, code: "ASIA321" },
  { worldgroupId: 21, groupName: "ASIA3", worldId: 922, code: "ASIA322" },
  { worldgroupId: 21, groupName: "ASIA3", worldId: 923, code: "ASIA323" },
  { worldgroupId: 21, groupName: "ASIA3", worldId: 931, code: "ASIA331" },
  { worldgroupId: 21, groupName: "ASIA3", worldId: 932, code: "ASIA332" },
  { worldgroupId: 21, groupName: "ASIA3", worldId: 933, code: "ASIA333" },
  { worldgroupId: 21, groupName: "ASIA3", worldId: 934, code: "ASIA334" },
  { worldgroupId: 21, groupName: "ASIA3", worldId: 333, code: "ASIA342" },
  { worldgroupId: 1, groupName: "ASIA1", worldId: 313, code: "ASIA042" },
  { worldgroupId: 1, groupName: "ASIA1", worldId: 811, code: "ASIA011" },
  { worldgroupId: 1, groupName: "ASIA1", worldId: 812, code: "ASIA012" },
  { worldgroupId: 1, groupName: "ASIA1", worldId: 821, code: "ASIA021" },
  { worldgroupId: 1, groupName: "ASIA1", worldId: 822, code: "ASIA022" },
  { worldgroupId: 1, groupName: "ASIA1", worldId: 823, code: "ASIA023" },
  { worldgroupId: 1, groupName: "ASIA1", worldId: 831, code: "ASIA031" },
  { worldgroupId: 1, groupName: "ASIA1", worldId: 832, code: "ASIA032" },
  { worldgroupId: 1, groupName: "ASIA1", worldId: 833, code: "ASIA033" },
  { worldgroupId: 1, groupName: "ASIA1", worldId: 834, code: "ASIA034" },
  { worldgroupId: 11, groupName: "ASIA2", worldId: 851, code: "ASIA051" },
  { worldgroupId: 11, groupName: "ASIA2", worldId: 852, code: "ASIA052" },
  { worldgroupId: 11, groupName: "ASIA2", worldId: 853, code: "ASIA053" },
  { worldgroupId: 11, groupName: "ASIA2", worldId: 861, code: "ASIA061" },
  { worldgroupId: 11, groupName: "ASIA2", worldId: 862, code: "ASIA062" },
  { worldgroupId: 11, groupName: "ASIA2", worldId: 863, code: "ASIA063" },
  { worldgroupId: 11, groupName: "ASIA2", worldId: 881, code: "ASIA081" },
  { worldgroupId: 11, groupName: "ASIA2", worldId: 883, code: "ASIA083" },
  { worldgroupId: 11, groupName: "ASIA2", worldId: 323, code: "ASIA092" },
  { worldgroupId: 6, groupName: "INMENA1", worldId: 221, code: "INMENA011" },
  { worldgroupId: 6, groupName: "INMENA1", worldId: 223, code: "INMENA013" },
  { worldgroupId: 6, groupName: "INMENA1", worldId: 225, code: "INMENA021" },
  { worldgroupId: 6, groupName: "INMENA1", worldId: 227, code: "INMENA023" },
  { worldgroupId: 6, groupName: "INMENA1", worldId: 252, code: "INMENA031" },
  { worldgroupId: 6, groupName: "INMENA1", worldId: 253, code: "INMENA032" },
  { worldgroupId: 3, groupName: "EU1", worldId: 611, code: "EU011" },
  { worldgroupId: 3, groupName: "EU1", worldId: 612, code: "EU012" },
  { worldgroupId: 3, groupName: "EU1", worldId: 621, code: "EU021" },
  { worldgroupId: 3, groupName: "EU1", worldId: 622, code: "EU022" },
  { worldgroupId: 3, groupName: "EU1", worldId: 624, code: "EU024" },
  { worldgroupId: 3, groupName: "EU1", worldId: 653, code: "EU032" },
  { worldgroupId: 5, groupName: "SA1", worldId: 711, code: "SA011" },
  { worldgroupId: 5, groupName: "SA1", worldId: 712, code: "SA012" },
  { worldgroupId: 5, groupName: "SA1", worldId: 713, code: "SA013" },
  { worldgroupId: 5, groupName: "SA1", worldId: 721, code: "SA021" },
  { worldgroupId: 5, groupName: "SA1", worldId: 722, code: "SA022" },
  { worldgroupId: 5, groupName: "SA1", worldId: 723, code: "SA023" },
  { worldgroupId: 5, groupName: "SA1", worldId: 731, code: "SA031" },
  { worldgroupId: 5, groupName: "SA1", worldId: 732, code: "SA032" },
  { worldgroupId: 5, groupName: "SA1", worldId: 753, code: "SA042" },
  { worldgroupId: 2, groupName: "NA1", worldId: 511, code: "NA011" },
  { worldgroupId: 2, groupName: "NA1", worldId: 512, code: "NA012" },
  { worldgroupId: 2, groupName: "NA1", worldId: 513, code: "NA013" },
  { worldgroupId: 2, groupName: "NA1", worldId: 514, code: "NA014" },
  { worldgroupId: 2, groupName: "NA1", worldId: 521, code: "NA021" },
  { worldgroupId: 2, groupName: "NA1", worldId: 522, code: "NA022" },
  { worldgroupId: 2, groupName: "NA1", worldId: 523, code: "NA023" },
  { worldgroupId: 2, groupName: "NA1", worldId: 531, code: "NA031" },
  { worldgroupId: 2, groupName: "NA1", worldId: 532, code: "NA032" },
  { worldgroupId: 2, groupName: "NA1", worldId: 553, code: "NA042" },
  { worldgroupId: 9, groupName: "BW", worldId: 314, code: "BASIA031" },
  { worldgroupId: 9, groupName: "BW", worldId: 324, code: "BASIA032" },
  { worldgroupId: 9, groupName: "BW", worldId: 334, code: "BASIA033" },
  { worldgroupId: 9, groupName: "BW", worldId: 554, code: "BNA031" },
  { worldgroupId: 9, groupName: "BW", worldId: 654, code: "BEU041" },
  { worldgroupId: 9, groupName: "BW", worldId: 754, code: "BSA031" },
  { worldgroupId: 9, groupName: "BW", worldId: 254, code: "BINMENA031" },
];

/** Servidores foco da operação: exibidos primeiro e sincronizados por padrão. */
export const FOCUS_CODES = ["EU011", "EU021"];

export function serverLabel(code: string): string {
  if (code === "EU011") return "EU11";
  if (code === "EU021") return "EU21";
  return code;
}
