// 한국어 묵주기도 데이터
//
// ⚠ 저작권 안내
// 한국어 공식 기도문(한국천주교주교회의, 「가톨릭 기도서」)의 저작권은 한국천주교주교회의에 있습니다
// (https://cbck.or.kr/Copyright). 사용 허가를 확인하기 전까지 기도문 전문(text)은 비워 두고
// 공식 출처 링크로 안내합니다. 허가를 받으면 각 항목의 text에 정식 문구를 그대로 넣으면 됩니다.
//
// 신비 제목은 「가톨릭 기도서」 묵주 기도의 표기를 따랐으며, 배포 전 최신 기도서와 다시 대조하세요.

import type { RosaryLocale } from "./types.ts";

const CBCK_PRAYER = "https://cbck.or.kr/Catholic/Prayer";
const GOODNEWS_PRAYER = "https://maria.catholic.or.kr/mi_pr/prayer/prayer.asp";

export const rosaryKo: RosaryLocale = {
  prayers: {
    signOfCross: { name: "십자성호 (성호경)", guide: "십자 성호를 그으며 성호경을 바칩니다.", text: null, sourceUrl: CBCK_PRAYER },
    creed: { name: "사도 신경", guide: "십자가를 잡고 사도 신경을 바칩니다.", text: null, sourceUrl: CBCK_PRAYER },
    ourFather: { name: "주님의 기도", guide: "큰 알에서 주님의 기도를 바칩니다.", text: null, sourceUrl: CBCK_PRAYER },
    hailMary: { name: "성모송", guide: "작은 알에서 성모송을 바칩니다.", text: null, sourceUrl: CBCK_PRAYER },
    gloryBe: { name: "영광송", guide: "영광송을 바칩니다.", text: null, sourceUrl: CBCK_PRAYER },
    fatima: {
      name: "구원을 비는 기도",
      guide: "영광송에 이어 구원을 비는 기도를 바칩니다. (선택 — 공동체 관습에 따라 생략할 수 있습니다)",
      text: null,
      sourceUrl: CBCK_PRAYER,
    },
    mystery: { name: "신비 묵상", guide: "이번 단의 신비를 알리고 잠시 묵상합니다.", text: null, sourceUrl: GOODNEWS_PRAYER },
    hailHolyQueen: { name: "성모 찬송", guide: "다섯 단을 마치고 성모 찬송을 바칩니다.", text: null, sourceUrl: GOODNEWS_PRAYER },
    closingPrayer: {
      name: "묵주 기도를 마치며 드리는 기도",
      guide: "마침 기도를 바칩니다. (선택 — 기도서·지역에 따라 다를 수 있습니다)",
      text: null,
      sourceUrl: GOODNEWS_PRAYER,
    },
  },
  mysteries: {
    joyful: {
      name: "환희의 신비",
      days: "월요일 · 토요일",
      decades: [
        { title: "마리아께서 예수님을 잉태하심을 묵상합시다.", scripture: "루카 1,26-38" },
        { title: "마리아께서 엘리사벳을 찾아보심을 묵상합시다.", scripture: "루카 1,39-56" },
        { title: "마리아께서 예수님을 낳으심을 묵상합시다.", scripture: "루카 2,1-20" },
        { title: "마리아께서 예수님을 성전에 바치심을 묵상합시다.", scripture: "루카 2,22-38" },
        { title: "마리아께서 잃으셨던 예수님을 성전에서 찾으심을 묵상합시다.", scripture: "루카 2,41-52" },
      ],
    },
    luminous: {
      name: "빛의 신비",
      days: "목요일",
      decades: [
        { title: "예수님께서 세례 받으심을 묵상합시다.", scripture: "마태 3,13-17" },
        { title: "예수님께서 카나에서 첫 기적을 행하심을 묵상합시다.", scripture: "요한 2,1-11" },
        { title: "예수님께서 하느님 나라를 선포하심을 묵상합시다.", scripture: "마르 1,14-15" },
        { title: "예수님께서 거룩하게 변모하심을 묵상합시다.", scripture: "루카 9,28-36" },
        { title: "예수님께서 성체성사를 세우심을 묵상합시다.", scripture: "루카 22,14-20" },
      ],
    },
    sorrowful: {
      name: "고통의 신비",
      days: "화요일 · 금요일",
      decades: [
        { title: "예수님께서 우리를 위하여 피땀 흘리심을 묵상합시다.", scripture: "루카 22,39-46" },
        { title: "예수님께서 우리를 위하여 매맞으심을 묵상합시다.", scripture: "마르 15,15" },
        { title: "예수님께서 우리를 위하여 가시관 쓰심을 묵상합시다.", scripture: "마르 15,16-20" },
        { title: "예수님께서 우리를 위하여 십자가 지심을 묵상합시다.", scripture: "요한 19,17" },
        { title: "예수님께서 우리를 위하여 십자가에 못 박혀 돌아가심을 묵상합시다.", scripture: "루카 23,33-46" },
      ],
    },
    glorious: {
      name: "영광의 신비",
      days: "수요일 · 일요일",
      decades: [
        { title: "예수님께서 부활하심을 묵상합시다.", scripture: "루카 24,1-12" },
        { title: "예수님께서 승천하심을 묵상합시다.", scripture: "사도 1,6-11" },
        { title: "예수님께서 성령을 보내심을 묵상합시다.", scripture: "사도 2,1-4" },
        { title: "예수님께서 마리아를 하늘에 불러올리심을 묵상합시다.", scripture: "교회 전승 (묵시 12,1 참조)" },
        { title: "예수님께서 마리아께 천상 모후의 관을 씌우심을 묵상합시다.", scripture: "교회 전승 (묵시 12,1 참조)" },
      ],
    },
  },
  sources: [
    { label: "한국천주교주교회의 · 주요 기도문", url: CBCK_PRAYER },
    { label: "굿뉴스 · 가톨릭 기도문", url: GOODNEWS_PRAYER },
    { label: "교황 요한 바오로 2세, 「동정 마리아의 묵주기도」 (2002)", url: "https://www.vatican.va/content/john-paul-ii/en/apost_letters/2002/documents/hf_jp-ii_apl_20021016_rosarium-virginis-mariae.html" },
  ],
  notes: [
    "‘구원을 비는 기도’는 각 단의 영광송 뒤에 바치는 것이 한국 교회의 일반적인 관습이지만 선택 사항입니다.",
    "시작할 때 바치는 성모송 세 번은 흔히 믿음·희망·사랑의 덕을 청하는 지향으로 바칩니다.",
    "마침 기도(성모 찬송 이후)의 구성은 기도서와 지역에 따라 다를 수 있습니다.",
    "이 공간은 미사, 고해성사, 성체성사 등 실제 성당의 성사를 대신하지 않는 개인 묵상 도구입니다.",
  ],
};
