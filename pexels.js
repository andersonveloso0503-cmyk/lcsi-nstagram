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
  facilities: [
    'Brazilian male maintenance technician in blue uniform fixing building systems, realistic work photo',
    'Latin American technician in uniform doing preventive maintenance in building, professional photo',
    'Brazilian handyman in uniform repairing office building equipment, realistic photo',
    'Brazilian male facilities worker in uniform checking systems with tablet, professional photo',
    'Latin American maintenance engineer with hard hat inspecting building, realistic photo'
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
    'Brazilian hospital housekeeper in uniform with mask mopping medical facility, realistic photo',
    'Latin American cleaning professional in PPE sanitizing hospital ward, realistic photo'
  ],
  empresas: [
    'Brazilian cleaning worker in uniform vacuuming modern corporate office, realistic photo',
    'Brazilian female janitor in uniform cleaning executive boardroom, professional photo',
    'Latin American cleaning staff in uniforms maintaining modern office, realistic photo',
    'Brazilian male janitor in uniform mopping corporate corridor, professional photo',
    'Brazilian office cleaning professional with cleaning cart, realistic work photo'
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

  try {
    if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

    const { servico, dia } = req.body;
    const prompts = PROMPTS[servico] || PROMPTS.geral;
    const prompt = prompts[(dia || 0) % prompts.length];

    // Gemini Imagen 3
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GEMINI_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '1:1',
          personGeneration: 'allow_adult',
          safetySetting: 'block_only_high'
        }
      })
    });

    const data = await response.json();

    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

    const b64 = data.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new Error('Nenhuma imagem retornada pelo Gemini Imagen');

    res.status(200).json({ imageData: `data:image/png;base64,${b64}` });

  } catch (err) {
    console.error('Gemini Imagen error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
