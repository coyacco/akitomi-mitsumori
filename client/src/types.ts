export interface DetailHeader {
  mitsumori_no: number;
  sakusei: string | null;
  mitsumorisaki_meisho: string | null;
  keisho: string | null;
  tantou: string | null;
  tantou_name: string | null;
  goukei_kingaku: number | null;

  torihiki_jouken: string | null;
  yukou_kigen: string | null;
  ukewatashi_kijitu: string | null;
  ukewatashi_basho: string | null;

  goukei: number | null;
  sotozeigaku: number | null;
  zeiritsu: number | null;
  zei_type: number | null;
  kaishain: number | null;
}

export interface DetailRow {
  hinmoku: string;
  suryo: number | null;
  tanni: string;
  tannka: number | null;
  kingaku: number | null;
  bikou: string;
}

export interface MitsumoriCompany {
    yubin: String | null,
    jusho1: String | null,
    daihyou: String | null,
    tel: String | null,
    fax: String | null,
    mail: String | null,
    ginkou: String | null,
    zei_type: number,
    zeiritsu: number,
    kaishain: number | null,
    mix: String | null,
}

export const detailColumns = [
  { key: "hinmoku", width: "110mm" },
  { key: "suryo", width: "13mm" },
  { key: "tanni", width: "10mm" },
  { key: "tanka", width: "20mm" },
  { key: "kingaku", width: "23mm" },
  { key: "bikou", width: "40mm" },
];
