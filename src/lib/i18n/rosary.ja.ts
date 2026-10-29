// 日本語のロザリオデータ
//
// ⚠ 祈りの全文(text)は、使用許諾が確認できるまで掲載しません。
// 祈りの名称・神秘の題は日本のカトリック教会で一般的な表記に合わせていますが、
// 公開前にカトリック中央協議会の公式表記と照合してください。
import type { RosaryLocale } from "./types.ts";

const CBCJ = "https://www.cbcj.catholic.jp/catholic/";
const RVM =
  "https://www.vatican.va/content/john-paul-ii/en/apost_letters/2002/documents/hf_jp-ii_apl_20021016_rosarium-virginis-mariae.html";

export const rosaryJa: RosaryLocale = {
  prayers: {
    signOfCross: { name: "十字架のしるし", guide: "十字架のしるしをします。", text: null, sourceUrl: CBCJ },
    creed: { name: "使徒信条", guide: "十字架を手に、使徒信条を唱えます。", text: null, sourceUrl: CBCJ },
    ourFather: { name: "主の祈り", guide: "大きい珠で主の祈りを唱えます。", text: null, sourceUrl: CBCJ },
    hailMary: { name: "アヴェ・マリアの祈り", guide: "小さい珠でアヴェ・マリアの祈りを唱えます。", text: null, sourceUrl: CBCJ },
    gloryBe: { name: "栄唱", guide: "栄唱を唱えます。", text: null, sourceUrl: CBCJ },
    fatima: { name: "ファティマの祈り", guide: "ファティマの祈りを唱えます(任意)。", text: null, sourceUrl: CBCJ },
    mystery: { name: "神秘の黙想", guide: "この連の神秘を告げ、しばらく黙想します。", text: null, sourceUrl: RVM },
    hailHolyQueen: { name: "元后あわれみの母", guide: "五連を終えて、元后あわれみの母を唱えます。", text: null, sourceUrl: CBCJ },
    closingPrayer: { name: "結びの祈り", guide: "結びの祈りを唱えます(任意)。", text: null, sourceUrl: CBCJ },
  },
  mysteries: {
    joyful: {
      name: "喜びの神秘",
      days: "月曜日・土曜日",
      decades: [
        { title: "お告げ", scripture: "ルカ1・26-38" },
        { title: "エリサベト訪問", scripture: "ルカ1・39-56" },
        { title: "イエスの誕生", scripture: "ルカ2・1-20" },
        { title: "イエスの奉献", scripture: "ルカ2・22-38" },
        { title: "神殿での少年イエス", scripture: "ルカ2・41-52" },
      ],
    },
    luminous: {
      name: "光の神秘",
      days: "木曜日",
      decades: [
        { title: "イエスの洗礼", scripture: "マタイ3・13-17" },
        { title: "カナの婚礼", scripture: "ヨハネ2・1-11" },
        { title: "神の国の宣教", scripture: "マルコ1・14-15" },
        { title: "イエスの変容", scripture: "ルカ9・28-36" },
        { title: "聖体の制定", scripture: "ルカ22・14-20" },
      ],
    },
    sorrowful: {
      name: "苦しみの神秘",
      days: "火曜日・金曜日",
      decades: [
        { title: "ゲツセマネの祈り", scripture: "ルカ22・39-46" },
        { title: "むち打ち", scripture: "マルコ15・15" },
        { title: "いばらの冠", scripture: "マルコ15・16-20" },
        { title: "十字架を担うイエス", scripture: "ヨハネ19・17" },
        { title: "十字架上の死", scripture: "ルカ23・33-46" },
      ],
    },
    glorious: {
      name: "栄えの神秘",
      days: "水曜日・日曜日",
      decades: [
        { title: "イエスの復活", scripture: "ルカ24・1-12" },
        { title: "イエスの昇天", scripture: "使徒言行録1・6-11" },
        { title: "聖霊降臨", scripture: "使徒言行録2・1-4" },
        { title: "聖母の被昇天", scripture: "教会の伝承(黙示録12・1参照)" },
        { title: "聖母の戴冠", scripture: "教会の伝承(黙示録12・1参照)" },
      ],
    },
  },
  sources: [
    { label: "カトリック中央協議会", url: CBCJ },
    { label: "教皇ヨハネ・パウロ二世 使徒的書簡『おとめマリアのロザリオ』(2002, 英語)", url: RVM },
  ],
  notes: [
    "各連の栄唱の後のファティマの祈りは広く行われている習慣ですが、任意です。",
    "結びの祈りの構成は、祈祷書や地域によって異なることがあります。",
    "この空間は個人の黙想のためのもので、ミサや秘跡に代わるものではありません。",
  ],
};
