export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { text, today } = req.body

  const prompt = `Today is ${today}.

The user did a brain dump. Parse it into a list of actionable tasks.

For each task return:
- text: short clear task description
- priority: "Now", "Soon", or "Someday" based on urgency
- date: YYYY-MM-DD if a specific day is mentioned, otherwise null
- time: HH:MM (24h) if a specific time is mentioned, otherwise null

Brain dump:
"${text}"

Respond ONLY with a valid JSON array, no explanation, no markdown, no backticks. Example:
[{"text":"Call dentist","priority":"Now","date":null,"time":null}]`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.AIzaSyDy544TrQquDfoxMW728qtAzAYkO4Y5T_M}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 }
        }),
      }
    )

    const data = await response.json()
    const raw = data.candidates[0].content.parts[0].text.trim()
    const clean = raw.replace(/```json|```/g, '').trim()
    const tasks = JSON.parse(clean)
    res.status(200).json({ tasks })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to process brain dump' })
  }
}