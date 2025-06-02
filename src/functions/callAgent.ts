import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";


export async function callAgent(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    // Only allow POST requests
    if (request.method !== "POST") {
        return { status: 405, body: "Method Not Allowed. Only POST is supported." };
    }

    // Extract agentId, message, and threadId from POST body
    let agentId = process.env.AIFOUNDRY_AGENT_ID;
    let userMessage: string | undefined = undefined;
    let threadId: string | undefined = undefined;

    try {
        const body = await request.json() as any;
        if (body && typeof body.agent === "string" && body.agent.trim() !== "") {
            agentId = body.agent.trim();
            context.log("agent found in POST body:", agentId);
        } else {
            context.log("No agent in POST body, using environment variable.");
        }
        if (body && typeof body.message === "string" && body.message.trim() !== "") {
            userMessage = body.message.trim();
            context.log("User message found in POST body:", userMessage);
        }
        if (body && typeof body.threadId === "string" && body.threadId.trim() !== "") {
            threadId = body.threadId.trim();
            context.log("threadId found in POST body:", threadId);
        }
    } catch (e) {
        context.log("POST body is not valid JSON or missing agent/message/threadId.");
    }

    if (!userMessage) {
        userMessage = 'Please give me a funny joke.';
    }
    context.log("User message:", userMessage);

    if (!threadId) {
        return { status: 400, body: "Missing required parameter: threadId" };
    }

    try {
        // Initialize client
        const client = new AIProjectClient(
            process.env.AIFOUNDRY_CONNECTION_STRING!,
            new DefaultAzureCredential()
        );
        context.log("AIProjectClient initialized.");

        // Get agent
        const agent = await client.agents.getAgent(agentId);
        context.log("Agent retrieved:", agent);

        // Use provided threadId
        context.log("Using threadId:", threadId);

        // Post user message
        const message = await client.agents.messages.create(threadId, "user", userMessage);
        context.log("User message posted:", message);

        // Create run
        let run = await client.agents.runs.create(threadId, agent.id);
        context.log("Run created:", run);

        // Poll until the run reaches a terminal status
        while (
            run.status === "queued" ||
            run.status === "in_progress"
        ) {
            context.log(`Run status: ${run.status}. Waiting...`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            run = await client.agents.runs.get(threadId, run.id);
        }
        context.log("Run completed with status:", run.status);

        // Retrieve messages
        const messages = await client.agents.messages.list(threadId, { order: "asc" });
        context.log("Messages retrieved:", messages);

        // Find the latest assistant message(s)
        let assistantMessage: any | undefined = undefined;

        for await (const m of messages) {
            const content = m.content.find((c) => c.type === "text" && "text" in c);
            console.log("Processing message:", m.content);
            if (m.role === "assistant" && content) {
                assistantMessage = m.content;
            }
        }
        context.log("Assistant messages:", assistantMessage);

        return {
            body: JSON.stringify({
                message: assistantMessage
            })
        };
    } catch (err: any) {
        context.error("Error calling Azure AI Foundry agent:", err);
        return { status: 500, body: "Error calling Azure AI Foundry agent." };
    }
};

app.http('callAgent', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: callAgent,
    route: 'agent',
});
