module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { imageData } = req.body;
    if(!imageData || !imageData.startsWith('data:')) {
      return res.status(400).json({ error: 'Invalid image data' });
    }

    const base64 = imageData.split(',')[1];
    const buffer = Buffer.from(base64, 'base64');
    const filename = `lcs-post-${Date.now()}.jpg`;

    // Dynamic import for @vercel/blob
    const { put } = await import('@vercel/blob');
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: 'image/jpeg',
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    console.log('Uploaded to:', blob.url);
    res.status(200).json({ url: blob.url });
  } catch (err) {
    console.error('Upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
