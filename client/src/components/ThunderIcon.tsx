// 継続日数（ストリーク）バッジ用の稲妻アイコン。
// sozailab #90416「雷の絵文字スタンプ」と同モチーフのソリッドな稲妻を、
// 任意サイズで鮮明に出せるようインラインSVGで再現したもの（アンバー塗り）。
export default function ThunderIcon({
  className,
  color = "#F9A800",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={color} aria-hidden="true">
      <path d="M14.8 2 5.5 13.4c-.5.6-.1 1.5.7 1.5h4.3l-2 6.6c-.2.8.8 1.3 1.3.7L19.2 10c.5-.6.1-1.5-.7-1.5h-4.1l2.1-5.8c.3-.8-.7-1.4-1.2-.7Z" />
    </svg>
  );
}
