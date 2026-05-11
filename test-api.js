const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error("Error: OPENROUTER_API_KEY is not set in environment variables.");
  process.exit(1);
}

async function testModel(model) {
  console.log(`\n--- Testing model: ${model} ---`);
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: "GENERATE_IMAGE: A cute cyberpunk robot cat." }]
      })
    });

    const data = await response.json();
    console.log("Status:", response.status);
    console.log("Full Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

async function run() {
  await testModel("openai/dall-e-3");
  await testModel("google/gemini-2.0-flash-001");
}

run();
