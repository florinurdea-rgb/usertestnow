const OPENAI_URL = 'https://api.openai.com/v1/responses';

function buildSystemPrompt(targetLanguage) {
  return [
    'You are an expert medical translator and reviewer.',
    'Requirements:',
    '- Preserve medical context, terminology precision, and clinical meaning exactly.',
    '- Preserve punctuation, casing, and spacing where possible.',
    '- Do not add legal disclaimers or commentary.',
    `- Output only translated text in ${targetLanguage}.`
  ].join('\n');
}

async function callOpenAI({ sourceText, targetLanguage }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');

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
          content: [{ type: 'input_text', text: buildSystemPrompt(targetLanguage) }]
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: sourceText }]
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

async function translateSegments(segments, targetLanguage) {
  const prompt = [
    'Translate each medical segment preserving meaning exactly.',
    `Target language: ${targetLanguage}.`,
    'Return strict JSON array of strings with same length and order as input.',
    'No markdown, no explanations.'
  ].join('\n');

  const text = await callOpenAI({
    sourceText: `${prompt}\n\nINPUT JSON:\n${JSON.stringify(segments)}`,
    targetLanguage
  });

  try {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('No JSON array in model output.');
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed) || parsed.length !== segments.length) {
      throw new Error('Translated segments length mismatch.');
    }
    return parsed.map((item) => String(item));
  } catch (error) {
    throw new Error(`Failed to parse translated segments: ${error.message}`);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { mode, sourceText, targetLanguage, segments } = req.body || {};
    if (!targetLanguage) return res.status(400).json({ error: 'targetLanguage is required.' });

    if (mode === 'analyze') {
      if (!sourceText) return res.status(400).json({ error: 'sourceText is required.' });
      return res.status(200).json({ status: 'analysis_complete' });
    }

    if (mode === 'translate_segments') {
      if (!Array.isArray(segments) || segments.length === 0) {
        return res.status(400).json({ error: 'segments must be a non-empty array.' });
      }
      const translatedSegments = await translateSegments(segments, targetLanguage);
      return res.status(200).json({ translatedSegments });
    }

    if (!sourceText) return res.status(400).json({ error: 'sourceText is required.' });
    const translatedText = await callOpenAI({ sourceText, targetLanguage });
    return res.status(200).json({ translatedText });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error during translation.' });
  }
};
