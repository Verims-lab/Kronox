/**
 * Rotating flavor text for correct / wrong feedback.
 */

export const correctTexts = [
  'Temiz yerleştirme.',
  'Timeline ustası.',
  'Pürüzsüzdü bu.',
  'Tarih seni tanıyor.',
  'Kafan çalışıyor.',
  'Kesin atış.',
  'Tarih bilgisi akıyor.',
];

export const wrongTexts = [
  'Tarih hayır dedi.',
  'Bu biraz acıtı.',
  'Arkadaşların hatırlayacak.',
  'Az kaldı… ama yetmedi.',
  'Timeline kargaşası.',
  'Yakındın ama mesafe önemli.',
  'Tarihle aran biraz karışık.',
];

export function randomFlavor(isCorrect) {
  const list = isCorrect ? correctTexts : wrongTexts;
  return list[Math.floor(Math.random() * list.length)];
}