// 배경 성가 목록과 저작권 표기. 새 곡을 넣을 때는 라이선스를 확인하고 여기에 출처를 함께 적습니다.
// 이 순서대로 이어서 재생하고, 마지막 곡이 끝나면 처음으로 돌아가 반복합니다.
export interface MusicTrack {
  src: string;
  mime: string;
  title: string;
  performer: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  /** 이 곡이 끝난 뒤 다음 곡까지 고요한 쉼 (ms) */
  restMs: number;
}

export const MUSIC_TRACKS: MusicTrack[] = [
  {
    src: "/audio/ave-maria-schola-gregoriana.ogg",
    mime: 'audio/ogg; codecs="vorbis"',
    title: "Ave Maria (Gregorian chant)",
    performer: "Schola Gregoriana (Pallottine Seminary, Ołtarzew, Poland), cond. Fr. Dariusz Smolarek · 2007",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Schola_Gregoriana-Ave_Maria.ogg",
    restMs: 8_000,
  },
  {
    src: "/audio/salve-regina-petits-chanteurs-de-passy.ogg",
    mime: 'audio/ogg; codecs="vorbis"',
    title: "Salve Regina (Hermann Contract)",
    performer: "Les Petits Chanteurs de Passy · 2012",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Petits_Chanteurs_de_Passy_-_Salve_Regina_de_Hermann_Contract.ogg",
    restMs: 8_000,
  },
  {
    src: "/audio/palestrina-agnus-dei.ogg",
    mime: 'audio/ogg; codecs="vorbis"',
    title: "Agnus Dei — Missa in Festis Apostolorum (Palestrina)",
    performer: "Instrumental (MIDI) rendering, ed. Knud Jeppesen score · 2018",
    license: "Public domain",
    licenseUrl: "https://commons.wikimedia.org/wiki/File:Palestrina_Agnus_Dei_from_Missa_in_Festis_Apostolorum.ogg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Palestrina_Agnus_Dei_from_Missa_in_Festis_Apostolorum.ogg",
    restMs: 8_000,
  },
  {
    src: "/audio/palestrina-sicut-lilium-tudor-consort.ogg",
    mime: 'audio/ogg; codecs="vorbis"',
    title: "Sicut lilium inter spinas (Palestrina)",
    performer: "The Tudor Consort · 2010",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:The_Tudor_Consort_-_01_-_Palestrina_-_Sicut_lilium_inter_spinas.ogg",
    restMs: 8_000,
  },
  {
    src: "/audio/allegri-miserere-ensamble-escenico-vocal.ogg",
    mime: 'audio/ogg; codecs="vorbis"',
    title: "Miserere mei, Deus (Allegri)",
    performer: "Ensamble Escénico Vocal, Cathedral of Tlaxcala · 2021",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Allegri_-_Miserere_Mei,_Deus_-_Ensamble_Esc%C3%A9nico_Vocal_(audio).ogg",
    restMs: 20_000,
  },
];
