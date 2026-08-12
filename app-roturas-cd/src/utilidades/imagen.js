// Redimensiona y comprime una foto (viene de la camara del celular, puede
// pesar varios MB) antes de guardarla como base64 en la fila de Supabase.
// Sin esto, unas pocas fotos llenarian la cuota gratis de la base de datos
// (500MB) y de localStorage muy rapido.
export function comprimirImagen(file, { maxAncho = 1280, calidad = 0.72 } = {}) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    lector.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo procesar la imagen.'));
      img.onload = () => {
        const escala = Math.min(1, maxAncho / img.width);
        const w = Math.round(img.width * escala);
        const h = Math.round(img.height * escala);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', calidad));
      };
      img.src = e.target.result;
    };
    lector.readAsDataURL(file);
  });
}
