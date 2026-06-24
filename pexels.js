const OPENAI_KEY = process.env.OPENAI_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const PEXELS_KEY = process.env.PEXELS_API_KEY || '52RvQaJkxrCe4NT0ohnE8K9TFXSovoUDLoy99epHcx8azLSd0PVQtGcB';

const PROMPTS = {
  limpeza:   ['Brazilian male cleaning worker in dark navy uniform mopping shiny office corridor in Porto Alegre, professional work photo, realistic photography', 'Brazilian female janitor in dark uniform holding mop in modern commercial building lobby, realistic professional photo', 'Latin American cleaning professional in uniform sanitizing corporate office, realistic work photo', 'Brazilian male janitor in uniform sweeping corporate office floor, realistic photo', 'Brazilian female cleaner in uniform carrying cleaning supplies in building hallway, realistic work photo'],
  portaria:  ['Brazilian young male doorman in black formal suit standing at modern condominium entrance in Porto Alegre, professional photo, realistic', 'Brazilian male security guard in dark uniform at building reception desk, professional photo, realistic', 'Latin American security officer in uniform standing at building gate, realistic professional photo', 'Brazilian male doorman in suit with welcoming gesture at luxury apartment entrance, realistic photo', 'Brazilian condominium receptionist in uniform smiling at lobby desk, professional photo, realistic'],
  condominio:['Brazilian male security guard in uniform at condominium entrance gate in Porto Alegre, realistic photo', 'Brazilian doorman in uniform opening door at residential building lobby, professional photo, realistic', 'Latin American building superintendent in uniform inspecting clean condominium, realistic photo', 'Brazilian security guard in uniform monitoring condominium with radio, realistic photo', 'Brazilian male janitor in uniform maintaining condominium common area, realistic photo'],
  lojas:     ['Brazilian female cleaning worker in uniform mopping retail store floor, realistic work photo', 'Latin American janitor in uniform cleaning shopping mall corridor in Brazil, professional photo', 'Brazilian cleaning professional in uniform sanitizing store shelves, realistic photo', 'Brazilian female janitor in uniform polishing clothing store floor, realistic photo', 'Brazilian cleaning staff in uniform maintaining commercial establishment, realistic photo'],
  hospitais: ['Brazilian hospital cleaning worker in white uniform with mask sanitizing hospital corridor, realistic photo', 'Latin American healthcare janitor in PPE uniform cleaning hospital room, realistic photo', 'Brazilian female cleaning staff in uniform with hairnet disinfecting clinic, professional photo', 'Brazilian hospital housekeeper in uniform mopping medical facility, realistic photo', 'Latin American cleaning professional in PPE sanitizing hospital ward, realistic photo'],
  facilities:['Brazilian male maintenance technician in blue uniform fixing building systems, realistic work photo', 'Latin American technician in uniform doing preventive maintenance in building, professional photo', 'Brazilian handyman in uniform repairing office building equipment, realistic photo', 'Brazilian male facilities worker in uniform checking systems with tablet, professional photo', 'Latin American maintenance engineer with hard hat inspecting building, realistic photo'],
  geral:     ['Team of Brazilian cleaning and security professionals in uniforms standing together in Porto Alegre, professional group photo', 'Brazilian male and female service workers in uniforms ready to work, professional photo', 'Latin American janitorial worker in uniform smiling with cleaning equipment, realistic photo', 'Brazilian outsourced services team in dark uniforms working in modern building, realistic photo', 'Brazilian facilities management workers in uniforms professional team photo']
};

const PEXELS_QUERIES = {
  limpeza:   ['cleaning worker office uniform', 'janitor mopping building', 'cleaning professional uniform', 'housekeeping worker commercial', 'commercial cleaning service'],
  portaria:  ['security guard building entrance', 'doorman lobby professional', 'receptionist building desk', 'security officer uniform', 'building entrance guard'],
  condominio:['security guard apartment building', 'doorman condominium lobby', 'building security uniform', 'apartment guard professional', 'residential security worker'],
  lojas:     ['cleaning retail store worker', 'janitor shopping mall', 'store cleaning professional', 'mall cleaning worker', 'commercial cleaner uniform'],
  hospitais: ['hospital cleaning staff', 'healthcare worker cleaning', 'medical facility cleaner uniform', 'hospital hygiene worker', 'clinic cleaning professional'],
  facilities:['maintenance worker building uniform', 'technician building professional', 'building maintenance worker', 'handyman professional uniform', 'facilities worker building'],
  geral:     ['cleaning service team uniform', 'janitorial professional worker', 'facilities management worker', 'service worker uniform professional', 'cleaning crew professional']
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
  if (!b64) throw new Error('Sem imagem Imagen3');
  return `data:image/png;base64,${b64}`;
}

async function tryDallE(prompt) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024', response_format: 'b64_json' })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.substring(0, 300)}`);
  const data = JSON.parse(text);
  if (data.error) throw new Error(data.error.message);
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('Sem imagem DALL-E');
  return `data:image/png;base64,${b64}`;
}

async function tryPexels(servico, dia) {
  const queries = PEXELS_QUERIES[servico] || PEXELS_QUERIES.geral;
  const query = encodeURIComponent(queries[dia % queries.length]);
  const res = await fetch(`https://api.pexels.com/v1/search?query=${query}&per_page=15&orientation=square`, {
    headers: { 'Authorization': PEXELS_KEY }
  });
  if (!res.ok) throw new Error(`Pexels HTTP ${res.status}`);
  const data = await res.json();
  const fotos = data.photos || [];
  if (!fotos.length) throw new Error('Pexels sem resultados');
  const foto = fotos[dia % fotos.length];
  const imgUrl = foto.src?.large || foto.src?.medium;
  if (!imgUrl) throw new Error('Pexels sem URL');
  return await fetchImageAsBase64(imgUrl);
}

async function tryPicsum(seed) {
  return await fetchImageAsBase64(`https://picsum.photos/seed/${seed}/1024/1024`);
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

  // 1. Gemini Imagen 3 — gera profissional brasileiro específico
  if (GEMINI_KEY) {
    try {
      const imageData = await tryImagen3(prompt);
      console.log('✅ Imagen3 OK');
      return res.status(200).json({ imageData, fonte: 'imagen3' });
    } catch(e) {
      erros.push('Imagen3: ' + e.message);
      console.warn('Imagen3 falhou:', e.message);
    }
  }

  // 2. DALL-E 3 — fallback
  if (OPENAI_KEY) {
    try {
      const imageData = await tryDallE(prompt);
      console.log('✅ DALL-E 3 OK');
      return res.status(200).json({ imageData, fonte: 'dalle3' });
    } catch(e) {
      erros.push('DALL-E: ' + e.message);
      console.warn('DALL-E falhou:', e.message);
    }
  }

  // 2. Pexels — fotos reais de profissionais
  try {
    const imageData = await tryPexels(servico, diaNum);
    console.log('✅ Pexels OK');
    return res.status(200).json({ imageData, fonte: 'pexels' });
  } catch(e) {
    erros.push('Pexels: ' + e.message);
    console.warn('Pexels falhou:', e.message);
  }

  // 3. Picsum — último recurso
  try {
    const imageData = await tryPicsum(`lcs-${servico}-${diaNum}`);
    console.log('✅ Picsum OK');
    return res.status(200).json({ imageData, fonte: 'picsum' });
  } catch(e) { erros.push('Picsum: ' + e.message); }

  return res.status(500).json({ error: 'Todos falharam', detalhes: erros });
}
