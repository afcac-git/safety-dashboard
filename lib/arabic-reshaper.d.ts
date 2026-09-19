declare module "arabic-reshaper" {
  function convertArabic(text: string): string;
  function convertArabicBack(text: string): string;
  const ArabicReshaper: { convertArabic: typeof convertArabic; convertArabicBack: typeof convertArabicBack };
  export default ArabicReshaper;
}
