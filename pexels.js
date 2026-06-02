const OPENAI_KEY = process.env.OPENAI_API_KEY;

const UNIFORM = 'dark navy blue uniform shirt with a small white company logo patch on the left chest, professional workwear';

const PROMPTS = {
  limpeza: [
    `Brazilian male cleaning worker wearing ${UNIFORM}, mopping shiny office corridor in Porto Alegre, professional work photo`,
    `Brazilian female janitor wearing ${UNIFORM}, holding mop in modern commercial building, realistic professional photo`,
    `Latin American cleaning professional wearing ${UNIFORM}, sanitizing office lobby, realistic work photo`,
    `Brazilian male janitor wearing ${UNIFORM}, sweeping corporate office floor, realistic photo`,
    `Brazilian female housekeeper wearing ${UNIFORM}, carrying cleaning supplies, realistic work photo`
  ],
  portaria: [
    `Brazilian young male doorman wearing black formal suit, standing at modern condominium entrance, professional photo`,
    `Brazilian male security guard in dark uniform, at building reception desk with radio, professional photo`,
    `Latin American security officer in uniform, standing at building gate, realistic professional photo`,
    `Brazilian male doorman in suit, welcoming gesture at luxury apartment entrance, realistic photo`,
    `Brazilian condominium receptionist in uniform, smiling at lobby desk, professional photo`
  ],
  facilities: [
    `Brazilian male maintenance technician in blue uniform, fixing building systems, realistic work photo`,
    `Latin American technician in uniform, doing preventive maintenance, professional photo`,
    `Brazilian handyman in uniform, repairing office building equipment, realistic photo`,
    `Brazilian male facilities worker in uniform, checking systems with tablet, professional photo`,
    `Latin American maintenance engineer with hard hat, inspecting building, realistic photo`
  ],
  condominio: [
    `Brazilian male security guard in uniform, at condominium entrance gate, realistic photo`,
    `Brazilian doorman in uniform, opening door at residential lobby, professional photo`,
    `Latin American building superintendent in uniform, inspecting clean condominium, realistic photo`,
    `Brazilian security guard in uniform, monitoring condominium with radio, professional photo`,
    `Brazilian male janitor in uniform, maintaining condominium common area, realistic photo`
  ],
  lojas: [
    `Brazilian female cleaning worker in uniform, mopping retail store floor, realistic work photo`,
    `Latin American janitor in uniform, cleaning shopping mall corridor, professional photo`,
    `Brazilian cleaning professional in uniform, sanitizing store shelves, realistic photo`,
    `Brazilian female janitor in uniform, polishing clothing store floor, realistic photo`,
    `Brazilian cleaning staff in uniform, maintaining commercial establishment, realistic photo`
  ],
  hospitais: [
    `Brazilian hospital cleaning worker in white uniform with mask, sanitizing hospital corridor, realistic photo`,
    `Latin American healthcare janitor in PPE uniform, cleaning hospital room, realistic photo`,
    `Brazilian female cleaning staff in uniform with hairnet, disinfecting clinic, professional photo`,
    `Brazilian hospital housekeeper in uniform with mask, mopping medical facility, realistic photo`,
    `Latin American cleaning professional in PPE, sanitizing hospital ward, realistic photo`
  ],
  empresas: [
    `Brazilian cleaning worker in uniform, vacuuming modern corporate office, realistic photo`,
    `Brazilian female janitor in uniform, cleaning executive boardroom, professional photo`,
    `Latin American cleaning staff in uniforms, maintaining modern office, realistic photo`,
    `Brazilian male janitor in uniform, mopping corporate corridor, professional photo`,
    `Brazilian office cleaning professional with cleaning cart, realistic work photo`
  ],
  geral: [
    `Team of Brazilian cleaning and security professionals in uniforms, standing together, professional group photo`,
    `Brazilian male and female service workers in uniforms, ready to work, professional photo`,
    `Latin American janitorial worker in uniform, smiling with cleaning equipment, realistic photo`,
    `Brazilian outsourced services team in uniforms, working in modern building, realistic photo`,
    `Brazilian facilities management workers in uniforms, professional team photo`
  ]
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if(!OPENAI_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

    const { servico, dia, formato } = req.body;
    const prompts = PROMPTS[servico] || PROMPTS.geral;
    const prompt = prompts[dia % prompts.length];
    const size = (formato === 'stories' || formato === 'reels') ? '1024x1792' : '1024x1024';

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size, quality: 'low' })
    });

    const data = await response.json();
    if(data.error) throw new Error(data.error.message);

    const b64 = data.data?.[0]?.b64_json;
    const imgUrl = data.data?.[0]?.url;
    let finalB64 = b64;
    if(!finalB64 && imgUrl) {
      const imgRes = await fetch(imgUrl);
      const buffer = await imgRes.arrayBuffer();
      finalB64 = Buffer.from(buffer).toString('base64');
    }
    if(!finalB64) throw new Error('No image returned');

    res.status(200).json({ imageData: `data:image/png;base64,${finalB64}` });
  } catch (err) {
    console.error('Image error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
