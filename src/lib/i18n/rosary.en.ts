// English rosary data. Full prayer texts are intentionally omitted until usage rights for a
// specific approved translation are confirmed; the UI links to official sources instead.
import type { RosaryLocale } from "./types.ts";

// Compendium of the Catechism — the appendix lists the common prayers
const PRAYERS = "https://www.vatican.va/archive/compendium_ccc/documents/archive_2005_compendium-ccc_en.html";
const RVM =
  "https://www.vatican.va/content/john-paul-ii/en/apost_letters/2002/documents/hf_jp-ii_apl_20021016_rosarium-virginis-mariae.html";

export const rosaryEn: RosaryLocale = {
  prayers: {
    signOfCross: { name: "Sign of the Cross", guide: "Make the Sign of the Cross.", text: null, sourceUrl: PRAYERS },
    creed: { name: "Apostles' Creed", guide: "Holding the crucifix, pray the Apostles' Creed.", text: null, sourceUrl: PRAYERS },
    ourFather: { name: "Our Father", guide: "On the large bead, pray the Our Father.", text: null, sourceUrl: PRAYERS },
    hailMary: { name: "Hail Mary", guide: "On the small bead, pray the Hail Mary.", text: null, sourceUrl: PRAYERS },
    gloryBe: { name: "Glory Be", guide: "Pray the Glory Be.", text: null, sourceUrl: PRAYERS },
    fatima: { name: "Fatima Prayer", guide: "Optionally pray the Fatima Prayer.", text: null, sourceUrl: PRAYERS },
    mystery: { name: "Announce the Mystery", guide: "Announce the mystery and reflect for a moment.", text: null, sourceUrl: RVM },
    hailHolyQueen: { name: "Hail, Holy Queen", guide: "After five decades, pray the Hail, Holy Queen.", text: null, sourceUrl: PRAYERS },
    closingPrayer: { name: "Closing Prayer", guide: "Optionally pray the concluding prayer.", text: null, sourceUrl: PRAYERS },
  },
  mysteries: {
    joyful: {
      name: "Joyful Mysteries",
      days: "Monday · Saturday",
      decades: [
        { title: "The Annunciation", scripture: "Luke 1:26-38" },
        { title: "The Visitation", scripture: "Luke 1:39-56" },
        { title: "The Nativity", scripture: "Luke 2:1-20" },
        { title: "The Presentation in the Temple", scripture: "Luke 2:22-38" },
        { title: "The Finding in the Temple", scripture: "Luke 2:41-52" },
      ],
    },
    luminous: {
      name: "Luminous Mysteries",
      days: "Thursday",
      decades: [
        { title: "The Baptism of the Lord", scripture: "Matthew 3:13-17" },
        { title: "The Wedding at Cana", scripture: "John 2:1-11" },
        { title: "The Proclamation of the Kingdom", scripture: "Mark 1:14-15" },
        { title: "The Transfiguration", scripture: "Luke 9:28-36" },
        { title: "The Institution of the Eucharist", scripture: "Luke 22:14-20" },
      ],
    },
    sorrowful: {
      name: "Sorrowful Mysteries",
      days: "Tuesday · Friday",
      decades: [
        { title: "The Agony in the Garden", scripture: "Luke 22:39-46" },
        { title: "The Scourging at the Pillar", scripture: "Mark 15:15" },
        { title: "The Crowning with Thorns", scripture: "Mark 15:16-20" },
        { title: "The Carrying of the Cross", scripture: "John 19:17" },
        { title: "The Crucifixion", scripture: "Luke 23:33-46" },
      ],
    },
    glorious: {
      name: "Glorious Mysteries",
      days: "Wednesday · Sunday",
      decades: [
        { title: "The Resurrection", scripture: "Luke 24:1-12" },
        { title: "The Ascension", scripture: "Acts 1:6-11" },
        { title: "The Descent of the Holy Spirit", scripture: "Acts 2:1-4" },
        { title: "The Assumption of Mary", scripture: "Tradition (cf. Rev 12:1)" },
        { title: "The Coronation of Mary", scripture: "Tradition (cf. Rev 12:1)" },
      ],
    },
  },
  sources: [
    { label: "Compendium of the Catechism (appendix: common prayers)", url: PRAYERS },
    { label: "St John Paul II, Rosarium Virginis Mariae (2002)", url: RVM },
  ],
  notes: [
    "The Fatima Prayer after each Glory Be is a widespread custom but optional.",
    "Concluding prayers after the Hail, Holy Queen vary by region and prayer book.",
    "This space is a personal aid to prayer and does not replace the sacraments.",
  ],
};
