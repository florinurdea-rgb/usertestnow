const OPENAI_URL = 'https://api.openai.com/v1/responses';

function buildSystemPrompt(targetLanguage) {
  return [
    'You are an expert medical translator and reviewer.',
    'Requirements:',
    '- Preserve medical context, terminology precision, and clinical meaning exactly.',
    '- Keep formatting, section order, bullet structure, and line breaks as close as possible to source.',
    '- Do not add legal disclaimers or commentary.',
    `- Output only the translated document in ${targetLanguage}.`
  ].join('\n');
}

async function callOpenAI({ sourceText, targetLanguage }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: buildSystemPrompt(targetLanguage)
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: sourceText
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${details}`);
  }

  const payload = await response.json();
  return (payload.output_text || '').trim();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { mode, sourceText, targetLanguage } = req.body || {};
    if (!sourceText || !targetLanguage) {
      return res.status(400).json({ error: 'sourceText and targetLanguage are required.' });
    }

    if (mode === 'analyze') {
      return res.status(200).json({ status: 'analysis_complete' });
    }

    const translatedText = await callOpenAI({ sourceText, targetLanguage });
    return res.status(200).json({ translatedText });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error during translation.' });
  }
};
