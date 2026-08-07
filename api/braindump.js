export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { text, today } = req.body

  const prompt = `Today is ${today} (timezone GMT+7 / WIB).

The user did a brain dump — a stream of thoughts that may be in English, Bahasa Indonesia, or a mix of both. Parse it into a list of actionable tasks.

For each task return these fields:
- text: a short, clear task description. Keep it in the SAME language the user wrote it in — do NOT translate. Tidy it up but preserve the meaning.
- priority: "High", "Medium", or "Low" based on urgency/importance.
- date: the start date as YYYY-MM-DD if a specific day is mentioned, otherwise null. Resolve all relative dates against today (${today}).
- time: HH:MM in 24-hour format if a specific time is mentioned, otherwise null.
- recurrence: "daily", "weekly", or "monthly" if the task repeats, otherwise null.

Understand date, time, and recurrence cues in BOTH English and Bahasa Indonesia, for example:
- Dates: "today"/"hari ini", "tomorrow"/"besok", "day after tomorrow"/"lusa", "next week"/"minggu depan", and weekday names in both languages (Monday/Senin, Tuesday/Selasa, Wednesday/Rabu, Thursday/Kamis, Friday/Jumat, Saturday/Sabtu, Sunday/Minggu).
- Times: "3pm"/"jam 3 sore" -> 15:00, "morning"/"pagi", "noon"/"siang", "evening"/"sore", "night"/"malam". Note Indonesian half-hour phrasing: "setengah 8" means 7:30 (half BEFORE 8), so "jam setengah 8 malam" -> 19:30.
- Recurrence: "every day"/"daily"/"setiap hari"/"tiap hari" -> "daily"; "every week"/"weekly"/"setiap minggu"/"mingguan" -> "weekly"; "every month"/"monthly"/"setiap bulan"/"bulanan" -> "monthly". A repeat tied to a weekday (e.g. "every Monday"/"setiap Senin") is "weekly" — also set date to the next matching weekday.

If a recurring task has no explicit start day, leave date as null (it will start today).

Brain dump:
"${text}"

Respond ONLY with a valid JSON array, no explanation, no markdown, no backticks. Example:
[{"text":"Call dentist","priority":"High","date":null,"time":null,"recurrence":null},{"text":"Minum obat pagi","priority":"High","date":null,"time":"08:00","recurrence":"daily"}]`

  try {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,      {        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 }
        }),
      }
    )

    const data = await response.json()

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('Unexpected Gemini response:', JSON.stringify(data))
      return res.status(500).json({ error: 'No response from AI' })
    }

    const raw = data.candidates[0].content.parts[0].text.trim()
    const clean = raw
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim()

    const firstBracket = clean.indexOf('[')
    const lastBracket = clean.lastIndexOf(']')
    const jsonStr = clean.slice(firstBracket, lastBracket + 1)

    const tasks = JSON.parse(jsonStr)
    res.status(200).json({ tasks })
  } catch (err) {
    console.error('braindump error:', err)
    res.status(500).json({ error: 'Failed to process brain dump' })
  }
}