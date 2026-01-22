
export const compressImage = (file: File, maxWidth = 1920, quality = 0.7, maxSizeMB = 1): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        // Initial compression
        let currentQuality = quality;
        let dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
        
        // Iteratively reduce quality if size is too large
        while (dataUrl.length * 0.75 > maxSizeMB * 1024 * 1024 && currentQuality > 0.1) {
          currentQuality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
        }
        
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};
