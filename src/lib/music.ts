// 배경 성가 목록과 저작권 표기. 새 곡을 넣을 때는 라이선스를 확인하고 여기에 출처를 함께 적습니다.
export interface MusicTrack {
  src: string;
  mime: string;
  title: string;
  performer: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  /** 반복 사이 고요한 쉼 (ms) */
  restMs: number;
}

export const MUSIC_TRACKS: MusicTrack[] = [
  {
    src: "/audio/ave-maria-schola-gregoriana.ogg",
    mime: 'audio/ogg; codecs="vorbis"',
    title: "Ave Maria (그레고리오 성가)",
    performer: "Schola Gregoriana (폴란드 오우타제프 팔로티회 신학교), 지휘 Dariusz Smolarek 신부 · 2007",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Schola_Gregoriana-Ave_Maria.ogg",
    restMs: 20_000,
  },
];
