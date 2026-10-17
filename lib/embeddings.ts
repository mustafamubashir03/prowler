interface EmbeddingResponse {
    data: { embedding: number[]; index: number }[];
    model: string;
    usage?: { prompt_tokens: number; total_tokens: number };
}

export async function embedTexts(texts: string[]) {
    const apiKey = process.env.JINA_API_KEY;

    if (!apiKey) {
        throw new Error("JINA_API_KEY is not set");
    }

    const response = await fetch("https://api.jina.ai/v1/embeddings", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            input: texts,
            model: "jina-embeddings-v3",
        }),
    });

    if (!response.ok) {
        throw new Error(
            `Jina embeddings failed: ${response.status} ${await response.text()}`,
        );
    }

    const payload = (await response.json()) as EmbeddingResponse;

    if (!payload.data || payload.data.length !== texts.length) {
        throw new Error(
            `Jina returned ${payload.data?.length ?? 0} embeddings for ${texts.length} inputs`,
        );
    }

    return payload;
}