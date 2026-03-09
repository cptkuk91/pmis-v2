export const PPE_ITEM_OPTIONS = [
  "안전모",
  "안전화",
  "안전조끼",
  "보안경",
  "보안면",
  "방진마스크",
  "방독마스크",
  "안전장갑",
  "귀마개",
  "안전대",
  "형광조끼",
  "우의",
  "기타",
] as const;

export const PPE_UNIT_OPTIONS = ["EA", "켤레", "세트", "매"] as const;

export type PPEItemName = (typeof PPE_ITEM_OPTIONS)[number];
export type PPEUnit = (typeof PPE_UNIT_OPTIONS)[number];

export const DEFAULT_PPE_ITEM: PPEItemName = PPE_ITEM_OPTIONS[0];

export const DEFAULT_PPE_UNIT_BY_ITEM: Record<PPEItemName, PPEUnit> = {
  안전모: "EA",
  안전화: "켤레",
  안전조끼: "EA",
  보안경: "EA",
  보안면: "EA",
  방진마스크: "EA",
  방독마스크: "EA",
  안전장갑: "켤레",
  귀마개: "세트",
  안전대: "EA",
  형광조끼: "EA",
  우의: "EA",
  기타: "EA",
};

export const PPE_SPECIFICATION_OPTIONS: Record<PPEItemName, string[]> = {
  안전모: ["백색", "황색", "청색", "적색"],
  안전화: ["240", "245", "250", "255", "260", "265", "270", "275", "280"],
  안전조끼: ["형광", "망사형", "동절기용"],
  보안경: ["투명", "차광", "김서림방지"],
  보안면: ["투명", "차광"],
  방진마스크: ["1급", "2급", "특급"],
  방독마스크: ["유기화합물용", "복합가스용"],
  안전장갑: ["코팅", "절단방지", "가죽"],
  귀마개: ["폼형", "밴드형"],
  안전대: ["1구", "2구", "전체식"],
  형광조끼: ["황색", "주황색"],
  우의: ["상하의", "코트형"],
  기타: [],
};

export function isPPEItemName(value: string): value is PPEItemName {
  return PPE_ITEM_OPTIONS.includes(value as PPEItemName);
}

export function isPPEUnit(value: string): value is PPEUnit {
  return PPE_UNIT_OPTIONS.includes(value as PPEUnit);
}
