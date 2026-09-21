export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { fragments } = req.body

  if (!Array.isArray(fragments) || fragments.length === 0) {
    return res.status(400).json({ error: 'Nothing to tidy' })
  }

  const prompt = `You are proofreading a personal journal entry. The text may be in English, Bahasa Indonesia, or a mix of both. It was often dictated by voice, so it lacks punctuation and capitalisation.

Fix ONLY these things:
- Punctuation: add full stops, commas, question marks, apostrophes where they belong.
- Capitalisation: sentence starts, proper nouns, the pronoun "I".
- Obvious grammar slips and speech-to-text mishearings of common words.
- Spacing around punctuation.

You MUST NOT:
- Translate. Keep every fragment in the language it was written in, including mixed-language sentences.
- Reword, rephrase, shorten, expand, or "improve" the writing. The voice stays exactly as the writer's.
- Add, remove, merge or reorder any content, thought or sentence.
- Change informal words, slang or spelling choices the writer clearly meant (e.g. "gonna", "udah", "banget").
- Make the tone more formal or more polished.

This is someone's private diary. Their exact words matter. When in doubt, leave the text alone.

The entry is given as a JSON array of text fragments, split by formatting (bold, links, and so on). A single sentence may be split across several fragments, so read them as one continuous entry, but fix and return each fragment separately. Preserve any leading or trailing spaces in a fragment — they hold words apart.

Return ONLY a JSON array of strings with EXACTLY ${fragments.length} items, in the same order, no explanation, no markdown, no backticks.

Entry:
${JSON.stringify(fragments)}`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 },
        }),
      }
    )

    const data = await response.json()

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('Unexpected Gemini response:', JSON.stringify(data))
      return res.status(500).json({ error: 'No response from AI' })
    }

    const raw = data.candidates[0].content.parts[0].text.trim()
    const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim()
    const jsonStr = clean.slice(clean.indexOf('['), clean.lastIndexOf(']') + 1)

    const tidied = JSON.parse(jsonStr)

    // A mismatched length means we can't map fragments back to the document
    // safely — better to leave the entry untouched than to scramble it.
    if (!Array.isArray(tidied) || tidied.length !== fragments.length
        || tidied.some(t => typeof t !== 'string')) {
      console.error('Fragment count mismatch:', fragments.length, tidied?.length)
      return res.status(500).json({ error: 'Could not tidy safely' })
    }

    res.status(200).json({ fragments: tidied })
  } catch (err) {
    console.error('tidy error:', err)
    res.status(500).json({ error: 'Failed to tidy entry' })
  }
}
