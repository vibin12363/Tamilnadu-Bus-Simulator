import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const generateStopAnnouncement = async (city: string, nextStop: string): Promise<string> => {
  const client = getClient();
  if (!client) {
    return `Next Stop: ${nextStop}. (AI Key Missing)`;
  }

  try {
    const prompt = `
      You are a bus conductor in Tamil Nadu. 
      We are currently at ${city} and the next stop is ${nextStop}.
      Generate a short, realistic announcement in Tamil script followed by English translation in parentheses.
      Mention checking tickets. Keep it under 20 words.
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Announcement unavailable";
  } catch (error) {
    console.error("Gemini Error:", error);
    return `அடுத்த நிறுத்தம்: ${nextStop} (Next stop: ${nextStop})`;
  }
};

export const generateRandomEvent = async (): Promise<{ event: string, impact: string }> => {
  const client = getClient();
  if (!client) {
    return { event: "Heavy Traffic", impact: "Delay" };
  }

  try {
    const prompt = `
      Generate a random road event for a bus simulator in Tamil Nadu.
      Examples: Elephant crossing, Tea shop break, Political rally roadblock, Railway gate closed.
      Return JSON format: { "event": "Event Description in English", "impact": "Effect on bus" }
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) return { event: "Clear Road", impact: "None" };
    return JSON.parse(text);
  } catch (error) {
    return { event: "Signal Failure", impact: "Wait" };
  }
};
