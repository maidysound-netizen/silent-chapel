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
  {
    src: "/audio/palestrina-papae-marcelli-kyrie.ogg",
    mime: 'audio/ogg; codecs="vorbis"',
    title: "Kyrie — Missa Papae Marcelli (Palestrina)",
    performer: "European Archive Music, via Musopen (Ogg version transcoded by Wikimedia Commons)",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Missa_Papae_Marcelli_-_I._Kyrie.flac",
    restMs: 8_000,
  },
  {
    src: "/audio/byrd-civitas-sancti-tui-tudor-consort.ogg",
    mime: 'audio/ogg; codecs="vorbis"',
    title: "Civitas sancti tui (Byrd)",
    performer: "The Tudor Consort",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:The_Tudor_Consort_-_02_-_William_Byrd_-_Civitas_Sancti_Tui.ogg",
    restMs: 8_000,
  },
  {
    src: "/audio/byrd-mass-4-agnus-dei-ensemble-morales.ogg",
    mime: 'audio/ogg; codecs="vorbis"',
    title: "Agnus Dei — Mass for Four Voices (Byrd)",
    performer: "Ensemble Morales, via Musopen · 2017",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Byrd_4-Part_Mass_-_Agnus_Dei.ogg",
    restMs: 8_000,
  },
  {
    src: "/audio/mozart-ave-verum-senftenberg.ogg",
    mime: 'audio/ogg; codecs="vorbis"',
    title: "Ave verum corpus, K. 618 (Mozart)",
    performer: "Choir and orchestra from Senftenberg, recorded by Metzner · 2008",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Ave_verum_Mozart_Senftenberg2008.ogg",
    restMs: 8_000,
  },
];

/**
 * 섞인 재생 순서 (곡 번호 목록). 한 바퀴를 다 돌면 다시 섞어 부르며,
 * avoidFirst 를 주면 방금 끝난 곡이 새 바퀴의 첫 곡으로 바로 다시 나오지 않게 합니다.
 */
export function shuffledOrder(n: number, rand: () => number = Math.random, avoidFirst?: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (n > 1 && order[0] === avoidFirst) [order[0], order[1]] = [order[1], order[0]];
  return order;
}
