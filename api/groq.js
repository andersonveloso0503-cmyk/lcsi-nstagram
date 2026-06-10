module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { messages, max_tokens } = req.body;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: max_tokens || 500,
        temperature: 0.8,
        messages: messages // já no formato OpenAI {role, content}
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Groq error:', JSON.stringify(data));
      return res.status(response.status).json({ error: data.error || data });
    }

    const text = data.choices?.[0]?.message?.content || '';
    if (!text) {
      return res.status(500).json({ error: 'Resposta vazia do Groq' });
    }

    // Retornar no formato Anthropic para compatibilidade com o HTML
    res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch (err) {
    console.error('Groq handler error:', err);
    res.status(500).json({ error: err.message });
  }
};
