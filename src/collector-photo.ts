import { t } from './i18n';

export async function prepareCollectorPhoto(file: File): Promise<string> {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error(t('Escolha uma foto JPG, PNG ou WebP de até 10 MB.'));
  const bitmap = await createImageBitmap(file);
  try {
    // Preserva o objeto inteiro e remove metadados da imagem ao converter pelo canvas.
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error(t('Não foi possível preparar a foto.'));
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.8, 0.6, 0.4]) {
      const photo = canvas.toDataURL('image/jpeg', quality);
      if (photo.length <= 600000) return photo;
    }
    throw new Error(t('A foto ficou muito grande. Escolha outra imagem.'));
  } finally {
    bitmap.close();
  }
}
