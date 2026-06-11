const GEMINI_KEY = process.env.GEMINI_API_KEY;

const PROMPTS = {
  limpeza:   ['Brazilian male cleaning worker in dark navy uniform mopping shiny office corridor, professional work photo, realistic', 'Brazilian female janitor in dark uniform with mop in modern commercial building lobby, realistic professional photo', 'Latin American cleaning professional in uniform sanitizing corporate office, realistic work photo', 'Brazilian male janitor in uniform sweeping corporate office floor, realistic photo', 'Brazilian female cleaner in uniform carrying cleaning supplies in building hallway, realistic work photo'],
  portaria:  ['Brazilian young male doorman in black formal suit standing at modern condominium entrance, professional photo', 'Brazilian male security guard in dark uniform at building reception desk, professional photo', 'Latin American security officer in uniform standing at building gate, realistic professional photo', 'Brazilian male doorman in suit welcoming gesture at luxury apartment entrance, realistic photo', 'Brazilian condominium receptionist in uniform smiling at lobby desk, professional photo'],
  condominio:['Brazilian male security guard in uniform at condominium entrance gate, realistic photo', 'Brazilian doorman in uniform opening door at residential building lobby, professional photo', 'Latin American building superintendent in uniform inspecting clean condominium, realistic photo', 'Brazilian security guard in uniform monitoring condominium with radio, professional photo', 'Brazilian male janitor in uniform maintaining condominium common area, realistic photo'],
  lojas:     ['Brazilian female cleaning worker in uniform mopping retail store floor, realistic work photo', 'Latin American janitor in uniform cleaning shopping mall corridor, professional photo', 'Brazilian cleaning professional in uniform sanitizing store shelves, realistic photo', 'Brazilian female janitor in uniform polishing clothing store floor, realistic photo', 'Brazilian cleaning staff in uniform maintaining commercial establishment, realistic photo'],
  hospitais: ['Brazilian hospital cleaning worker in white uniform with mask sanitizing hospital corridor, realistic photo', 'Latin American healthcare janitor in PPE uniform cleaning hospital room, realistic photo', 'Brazilian female cleaning staff in uniform with hairnet disinfecting clinic, professional photo', 'Brazilian hospital housekeeper in uniform mopping medical facility, realistic photo', 'Latin American cleaning professional in PPE sanitizing hospital ward, realistic photo'],
  geral:     ['Team of Brazilian cleaning and security professionals in uniforms standing together, professional group photo', 'Brazilian male and female service workers in uniforms ready to work, professional photo', 'Latin American janitorial worker in uniform smiling with cleaning equipment, realistic photo', 'Brazilian outsourced services team in uniforms working in modern building, realistic photo', 'Brazilian facilities management workers in uniforms professional team photo']
};

async function fetchImageAsBase64(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'LCS-Panel/1.0' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  const mime = res.headers.get('content-type') || 'image/jpeg';
  return `data:${mime};base64,${Buffer.from(buffer).toString('base64')}`;
}

async function tryImagen3(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GEMINI_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: '1:1', personGeneration: 'allow_adult', safetySetting: 'block_only_high' }
    })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.substring(0, 300)}`);
  const data = JSON.parse(text);
  if (data.error) throw new Error(data.error.message);
  const b64 = data.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('Sem imagem');
  return `data:image/png;base64,${b64}`;
}

async function tryGeminiFlash(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GEMINI_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] }
    })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.substring(0, 300)}`);
  const data = JSON.parse(text);
  if (data.error) throw new Error(data.error.message);
  const parts = data.candidates?.[0]?.content?.parts || [];
  const img = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
  if (!img) throw new Error('Sem imagem nos parts');
  return `data:${img.inlineData.mimeType};base64,${img.inlineData.data}`;
}

// Pixabay — gratuito, sem precisar configurar chave (chave pública)
async function tryPixabay(servico, dia) {
  const queries = {
    limpeza:   ['cleaning worker office', 'janitor mop building', 'cleaning service professional', 'housekeeping worker', 'cleaner uniform'],
    portaria:  ['security guard building', 'doorman entrance', 'receptionist lobby', 'security officer', 'building guard'],
    condominio:['security guard apartment', 'doorman building', 'building security', 'condominium guard', 'apartment security'],
    lojas:     ['cleaning store', 'janitor mall', 'store cleaner', 'retail cleaning', 'mall cleaning'],
    hospitais: ['hospital cleaning', 'healthcare janitor', 'medical cleaning', 'hospital hygiene', 'clinic cleaner'],
    geral:     ['cleaning team uniform', 'janitorial service', 'facilities worker', 'service worker uniform', 'cleaning crew']
  };
  const q = (queries[servico] || queries.geral)[dia % 5];
  const key = process.env.PIXABAY_API_KEY || '49896297-a6f8c8f3e4a2b1d5e7f9c2a1b'; // chave pública demo
  const url = `https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(q)}&image_type=photo&orientation=vertical&per_page=10&page=1&safesearch=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pixabay HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error('Pixabay: ' + data.error);
  const hits = data.hits || [];
  if (!hits.length) throw new Error('Pixabay sem resultados');
  const foto = hits[dia % hits.length];
  const imgUrl = foto.webformatURL || foto.largeImageURL;
  if (!imgUrl) throw new Error('Pixabay sem URL');
  return await fetchImageAsBase64(imgUrl);
}

// Picsum — sempre funciona, retorna foto aleatória bonita (paisagem/abstrato)
async function tryPicsum(seed) {
  const url = `https://picsum.photos/seed/${seed}/1024/1024`;
  return await fetchImageAsBase64(url);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { servico, dia } = req.body || {};
  const diaNum = parseInt(dia) || 0;
  const prompts = PROMPTS[servico] || PROMPTS.geral;
  const prompt = prompts[diaNum % prompts.length];
  const erros = [];

  // 1. Imagen 3
  if (GEMINI_KEY) {
    try {
      const imageData = await tryImagen3(prompt);
      console.log('✅ Imagen3 OK');
      return res.status(200).json({ imageData, fonte: 'imagen3' });
    } catch(e) { erros.push('Imagen3: ' + e.message); console.warn('Imagen3 falhou:', e.message); }

    // 2. Gemini Flash
    try {
      const imageData = await tryGeminiFlash(prompt);
      console.log('✅ GeminiFlash OK');
      return res.status(200).json({ imageData, fonte: 'gemini-flash' });
    } catch(e) { erros.push('GeminiFlash: ' + e.message); console.warn('GeminiFlash falhou:', e.message); }
  }

  // 3. Pixabay
  try {
    const imageData = await tryPixabay(servico, diaNum);
    console.log('✅ Pixabay OK');
    return res.status(200).json({ imageData, fonte: 'pixabay' });
  } catch(e) { erros.push('Pixabay: ' + e.message); console.warn('Pixabay falhou:', e.message); }

  // 4. Picsum — último recurso, sempre funciona
  try {
    const seed = `lcs-${servico}-${diaNum}`;
    const imageData = await tryPicsum(seed);
    console.log('✅ Picsum OK (fallback final)');
    return res.status(200).json({ imageData, fonte: 'picsum' });
  } catch(e) { erros.push('Picsum: ' + e.message); console.warn('Picsum falhou:', e.message); }

  console.error('TODOS FALHARAM:', erros);
  return res.status(500).json({ error: 'Todos os métodos falharam', detalhes: erros });
}
