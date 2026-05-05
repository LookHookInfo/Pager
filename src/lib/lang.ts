/**
 * Глобальная система определения языка (Language Detection)
 * Возвращает понятные коды языков (RU, EN, CN и т.д.)
 */

export function getLanguageIcon(text: string = "", langCode?: string): string {
  if (!text && !langCode) return '••';

  // 1. Приоритет коду из базы, если он есть
  const code = langCode?.toUpperCase();
  if (code && code.length >= 2) return code.slice(0, 2);

  // 2. Определение по Unicode диапазонам для авто-подстановки понятных кодов
  
  if (/[\u4e00-\u9fa5]/.test(text)) return 'CN'; // Китай
  if (/[\u3040-\u309f]/.test(text)) return 'JP'; // Япония
  if (/[\uac00-\ud7af]/.test(text)) return 'KR'; // Корея
  if (/[\u0600-\u06ff]/.test(text)) return 'AR'; // Арабский
  if (/[а-яА-ЯёЁ]/.test(text)) return 'RU';      // Кириллица
  if (/[\u1200-\u137f]/.test(text)) return 'ET';  // Эфиопия
  if (/[\u0900-\u097f]/.test(text)) return 'IN';  // Индия (Хинди)
  if (/[\u0e00-\u0e7f]/.test(text)) return 'TH';  // Таиланд
  if (/[\u0980-\u09ff]/.test(text)) return 'BN';  // Бенгалия
  if (/[\u0370-\u03ff]/.test(text)) return 'GR';  // Греция
  if (/[\u0590-\u05ff]/.test(text)) return 'HE';  // Иврит
  
  // Польский (специфичные латинские буквы)
  if (/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(text)) return 'PL';

  if (/[a-zA-Z]/.test(text)) return 'EN';        // Латиница

  return '••';
}
