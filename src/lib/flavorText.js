/**
 * Rotating flavor text for correct / wrong feedback.
 */

export const correctTexts = [
  'Temiz oynadın 👏',
  'Tarih bilgisi akıyor!',
  'Bu placement çok iyiydi',
  'Kafan net, el sağlam!',
  'Tarihin ustası seninsin',
  'Arkadaşlar not alsın 📝',
  'Ezber değil, bilgi bu!',
];

export const wrongTexts = [
  'Tarihle aran biraz karışık 😅',
  'Yakındın ama tarih seni affetmedi',
  'Bu biraz ağır oldu',
  'Arkadaş grubunda bunu unutmazlar 😬',
  'Hata yapmak insani bir şeydir',
  'Zamanlama tam değildi',
  'Yeniden dene, bu sefer olmadı',
];

export function randomFlavor(isCorrect) {
  const list = isCorrect ? correctTexts : wrongTexts;
  return list[Math.floor(Math.random() * list.length)];
}