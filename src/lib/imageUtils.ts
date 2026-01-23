
export const encodeWallpaper = (wallpaper: string): string => {
  if (!wallpaper) return '';
  // If it's a hex color, encode it
  if (wallpaper.startsWith('#')) {
    if (typeof window !== 'undefined') {
      return btoa(wallpaper);
    }
    return Buffer.from(wallpaper).toString('base64');
  }
  return wallpaper;
};

export const decodeWallpaper = (wallpaper: string | null | undefined): string | undefined => {
  if (!wallpaper) return undefined;
  
  // If it's already a hex color or url, return as is
  if (wallpaper.startsWith('#') || wallpaper.startsWith('url(')) {
    return wallpaper;
  }

  // If it's very long, it's likely an actual image bytea/base64, return as is (or handle as needed)
  if (wallpaper.length > 50) {
    // It's probably an image blob. For now return it, UI might treat it as undefined/invalid or custom
    // But since custom wallpapers are removed, we mainly care about colors.
    return wallpaper;
  }

  try {
    const decoded = typeof window !== 'undefined' 
      ? atob(wallpaper) 
      : Buffer.from(wallpaper, 'base64').toString('utf-8');
    
    // Check if it looks like a hex color
    if (decoded.startsWith('#')) {
      return decoded;
    }
  } catch (e) {
    // Failed to decode, return original
  }
  
  return wallpaper;
};

export const createColorImage = (color: string): string => {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    // Return base64 string without prefix
    return canvas.toDataURL('image/png').split(',')[1];
  }
  return '';
};
