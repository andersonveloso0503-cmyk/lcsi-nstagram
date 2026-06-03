module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { query, variables } = req.body;
    const key = process.env.BUFFER_API_KEY || '7bapnxk-EY4t_nyw8veZ4x7Gv2j1oWQsiemb8kELYbj';

    const response = await fetch('https://api.buffer.com/graphql', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({ query, variables })
    });

    const text = await response.text();
    console.log('Buffer status:', response.status, 'body:', text.substring(0, 300));
    
    try {
      const data = JSON.parse(text);
      res.status(200).json(data);
    } catch(e) {
      res.status(200).json({ raw: text, status: response.status });
    }
  } catch (err) {
    console.error('Buffer error:', err.message);
    res.status(500).json({ error: err.message });
  }
}