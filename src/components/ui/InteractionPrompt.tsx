import { Html } from "@react-three/drei";

interface InteractionPromptProps {
  isVisible: boolean;
  position?: [number, number, number];
}

export const InteractionPrompt = ({
  isVisible,
  position = [0, 2.5, 0],
}: InteractionPromptProps) => {
  if (!isVisible) return null;

  return (
    <Html position={position} center distanceFactor={10}>
      <div className="flex flex-col items-center gap-1 select-none pointer-events-none animate-bounce">
        <div className="bg-white/90 backdrop-blur-sm border-2 border-sky-400/50 shadow-lg rounded-xl px-3 py-1 flex items-center justify-center min-w-[32px] min-h-[32px]">
          <span className="text-sky-600 font-extrabold text-xl">E</span>
        </div>
        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-8 border-t-sky-400/50" />
      </div>
    </Html>
  );
};
