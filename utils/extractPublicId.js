export default function extractPublicId(url) {
  try {
    const parts = url.split('/');
    const fileName = parts[parts.length - 1]; // misal: xyz123.jpg
    const [publicId] = fileName.split('.');
    const folder = parts[parts.length - 2];   // misal: uploads/
    return `${folder}/${publicId}`; // hasil: uploads/xyz123
  } catch {
    return null;
  }
}
