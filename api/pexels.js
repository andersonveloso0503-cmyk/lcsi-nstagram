const GEMINI_KEY = process.env.GEMINI_API_KEY;

const PROMPTS = {
  limpeza: [
    'Brazilian male cleaning worker in dark navy uniform mopping shiny office corridor, professional work photo, realistic',
    'Brazilian female janitor in dark uniform with mop in modern commercial building lobby, realistic professional photo',
    'Latin American cleaning professional in uniform sanitizing corporate office, realistic work photo',
    'Brazilian male janitor in uniform sweeping corporate office floor, realistic photo',
    'Brazilian female cleaner in uniform carrying cleaning supplies in building hallway, realistic work photo'
  ],
  portaria: [
    'Brazilian young male doorman in black formal suit standing at modern condominium entrance, professional photo',
    'Brazilian male security guard in dark uniform at building reception desk, professional photo',
    'Latin American security officer in uniform standing at building gate, realistic professional photo',
    'Brazilian male doorman in suit welcoming gesture at luxury apartment entrance, realistic photo',
    'Brazilian condominium receptionist in uniform smiling at lobby desk, professional photo'
  ],
  condominio: [
    'Brazilian male security guard in uniform at condominium entrance gate, realistic photo',
    'Brazilian doorman in uniform opening door at residential building lobby, professional photo',
    'Latin American building superintendent in uniform inspecting clean condominium, realistic photo',
    'Brazilian security guard in uniform monitoring condominium with radio, professional photo',
    'Brazilian male janitor in uniform maintaining condominium common area, realistic photo'
  ],
  lojas: [
    'Brazilian female cleaning worker in uniform mopping retail store floor, realistic work photo',
    'Latin American janitor in uniform cleaning shopping mall corridor, professional photo',
    'Brazilian cleaning professional in uniform sanitizing store shelves, realistic photo',
    'Brazilian female janitor in uniform polishing clothing store floor, realistic photo',
    'Brazilian cleaning staff in uniform maintaining commercial establishment, realistic photo'
  ],
  hospitais: [
    'Brazilian hospital cleaning worker in white uniform with mask sanitizing hospital corridor, realistic photo',
    'Latin American healthcare janitor in PPE uniform cleaning hospital room, realistic photo',
    'Brazilian female cleaning staff in uniform with hairnet disinfecting clinic, professional photo',
    'Brazilian hospital housekeeper in uniform mopping medical facility, realistic photo',
    'Latin American cleaning professional in PPE sanitizing hospital ward, realistic photo'
  ],
  geral: [
    'Team of Brazilian cleaning and security professionals in uniforms standing together, professional group photo',
    'Brazilian male and female service workers in uniforms ready to work, professional photo',
    'Latin American janitorial worker in uniform smiling with cleaning equipment, realistic photo',
    'Brazilian outsourced services team in uniforms working in modern building, realistic photo',
    'Brazilian facilities management workers in uniforms professional team photo'
  ]
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const { servico, dia } = req.body;
  const prompts = PROMPTS[servico] || PROMPTS.geral;
  const prompt = prompts[(dia || 0) % prompts.length];

  // Tenta cada modelo em sequência até um funcionar
  const modelos = [
    {
      nome: 'imagen-3.0-generate-002',
      url: `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GEMINI_KEY}`,
      body: {
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: '1:1', personGeneration: 'allow_adult', safetySetting: 'block_only_high' }
      },
      parse: (data) => {
        const b64 = data.predictions?.[0]?.bytesBase64Encoded;
        return b64 ? `data:image/png;base64,${b64}` : null;
      }
    },
    {
      nome: 'gemini-2.0-flash-exp-image-generation',
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GEMINI_KEY}`,
      body: {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] }
      },
      parse: (data) => {
        const parts = data.candidates?.[0]?.content?.parts || [];
        const img = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
        return img ? `data:${img.inlineData.mimeType};base64,${img.inlineData.data}` : null;
      }
    },
    {
      nome: 'gemini-2.0-flash-preview-image-generation',
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${GEMINI_KEY}`,
      body: {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] }
      },
      parse: (data) => {
        const parts = data.candidates?.[0]?.content?.parts || [];
        const img = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
        return img ? `data:${img.inlineData.mimeType};base64,${img.inlineData.data}` : null;
      }
    }
  ];

  const erros = [];

  for (const modelo of modelos) {
    try {
      console.log(`Tentando ${modelo.nome}...`);
      const response = await fetch(modelo.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modelo.body)
      });

      const text = await response.text();
      console.log(`${modelo.nome} status: ${response.status}, body: ${text.substring(0, 300)}`);

      if (!response.ok) {
        erros.push(`${modelo.nome}: HTTP ${response.status} - ${text.substring(0, 200)}`);
        continue;
      }

      const data = JSON.parse(text);
      if (data.error) {
        erros.push(`${modelo.nome}: ${data.error.message || JSON.stringify(data.error)}`);
        continue;
      }

      const imageData = modelo.parse(data);
      if (imageData) {
        console.log(`✅ ${modelo.nome} funcionou!`);
        return res.status(200).json({ imageData, modelo: modelo.nome });
      }

      erros.push(`${modelo.nome}: parse retornou null`);

    } catch (e) {
      erros.push(`${modelo.nome}: ${e.message}`);
      console.error(`Erro ${modelo.nome}:`, e.message);
    }
  }

  // Todos falharam — retorna erro detalhado para diagnóstico
  console.error('Todos os modelos falharam:', erros);
  return res.status(500).json({ error: 'Todos os modelos Gemini falharam', detalhes: erros });
}
