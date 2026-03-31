const NICKNAME_COLORS = [
  '#FF6B6B', // Vibrant Red-Coral
  '#2EC4B6', // Tiffany Blue
  '#FF9F1C', // Bright Orange
  '#9B59B6', // Amethyst Purple
  '#00B4D8', // Sky Blue
  '#D81159', // Magenta Rose
  '#55A630', // Grass Green
  '#F72585', // Neon Pink
  '#4361EE', // Royal Blue
  '#FFBE0B', // Golden Yellow
];

export const getNicknameColor = (id: string): string => {
  if (!id) return NICKNAME_COLORS[0];
  
  // Basic hash function to get a stable index from ID string
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % NICKNAME_COLORS.length;
  return NICKNAME_COLORS[index];
};
