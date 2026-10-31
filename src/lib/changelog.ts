// 업데이트 소식 (플레이리스트 창 아래에 은은하게 보임). 새 소식은 맨 위에 추가합니다.
// id 는 '새 소식' 점 표시에 쓰이므로 항목마다 겹치지 않게 (날짜-순번).
import type { Locale } from "./i18n/types.ts";

export interface ChangelogEntry {
  id: string;
  /** 표시용 날짜 (월/일) */
  date: string;
  text: Record<Locale, string>;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "2026-10-31-2",
    date: "10/31",
    text: {
      ko: "성당의 빛이 하루를 따라 흐릅니다. 낮에는 화사한 햇살, 해 질 녘엔 노을빛, 밤에는 촛불만 은은한 고요한 성당이 됩니다.",
      en: "The light now follows the day: bright sunlight, then sunset glow, and at night a quiet chapel lit only by candles.",
      ja: "聖堂の光が一日に合わせて移ろいます。昼は明るい日差し、夕方は夕焼け、夜はろうそくだけが灯る静かな聖堂に。",
    },
  },
  {
    id: "2026-10-31-1",
    date: "10/31",
    text: {
      ko: "성모님 곁 초 제단이 넓어졌어요. 소원을 적은 초를 켜 두면 하루 동안 모든 분께 보입니다. 바닥의 꽃은 누구나 정리할 수 있고, 장미를 꽃송이째 내려놓을 수도 있어요.",
      en: "The candle stand beside Mary has grown. Light a candle with your wish and it stays for a day for everyone to see. Anyone can tidy flowers on the floor, and you can lay a whole rose down.",
      ja: "聖母のそばのろうそく台が広くなりました。願いを書いたろうそくは1日間みんなに見えます。床の花は誰でも片付けられ、バラを一輪そのまま置くこともできます。",
    },
  },
  {
    id: "2026-10-30-3",
    date: "10/30",
    text: {
      ko: "오른쪽 측랑에 장미꽃 제단이 생겼어요. 장미를 받아 성모님과 예수님께 바치거나 바닥에 꽃잎을 뿌릴 수 있습니다.",
      en: "A rose altar now stands in the right aisle. Take a rose and offer it to Mary or Jesus, or scatter its petals.",
      ja: "右の側廊にバラの祭壇ができました。バラを受け取り、聖母やイエスに捧げたり、花びらをまいたりできます。",
    },
  },
  {
    id: "2026-10-30-2",
    date: "10/30",
    text: {
      ko: "성호를 그을 수 있어요. 함께 있는 분들에게도 보입니다.",
      en: "You can now make the Sign of the Cross, and others nearby will see it.",
      ja: "十字を切れるようになりました。一緒にいる人にも見えます。",
    },
  },
  {
    id: "2026-10-30-1",
    date: "10/30",
    text: {
      ko: "새 십자가상과 성모님의 기도 공간이 마련되었어요. 더 많은 분이 함께 머물 수 있도록 경당이 여러 곳으로 늘었습니다.",
      en: "A new crucifix and a prayer space for Mary. More chapels open automatically so more people can stay together.",
      ja: "新しい十字架像と聖母の祈りの場ができました。より多くの人が過ごせるよう、聖堂が自動で増えます。",
    },
  },
  {
    id: "2026-10-29-1",
    date: "10/29",
    text: {
      ko: "Silent Chapel이 문을 열었습니다. 묵주기도와 성가 다섯 곡, 어디서든 절하기와 함께해요.",
      en: "Silent Chapel opened its doors, with the rosary, five sacred chants, and bowing anywhere.",
      ja: "Silent Chapel が開きました。ロザリオ、5曲の聖歌、どこでもお辞儀とともに。",
    },
  },
];

/** 아직 보지 않은 소식이 있는지 (마지막으로 본 소식 id 와 비교) */
export function hasUnseen(lastSeenId: string | null): boolean {
  return CHANGELOG.length > 0 && CHANGELOG[0].id !== lastSeenId;
}
