import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { AIProjectsClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";

export async function callAgent(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    // Only allow POST requests
    if (request.method !== "POST") {
        return { status: 405, body: "Method Not Allowed. Only POST is supported." };
    }

    // Extract agentId and message from POST body, fallback to env for agentId
    let agentId = process.env.AIFOUNDRY_AGENT_ID;
    let userMessage: string | undefined = undefined;

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
    } catch (e) {
        context.log("POST body is not valid JSON or missing agent/message.");
    }

    if (!userMessage) {
        userMessage = 'Please give me a funny joke.';
    }
    context.log("User message:", userMessage);

    try {
        // Initialize client
        const client = AIProjectsClient.fromConnectionString(
            process.env.AIFOUNDRY_CONNECTION_STRING!,
            new DefaultAzureCredential()
        );
        context.log("AIProjectsClient initialized.");

        // Get agent
        const agent = await client.agents.getAgent(agentId);
        context.log("Agent retrieved:", agent);

        // Create a new thread
        const thread = await client.agents.createThread();
        context.log("Thread created:", thread);

        // Post user message
        const message = await client.agents.createMessage(thread.id, {
            role: "user",
            content: userMessage
        });
        context.log("User message posted:", message);

        // Create run
        let run = await client.agents.createRun(thread.id, agent.id);
        context.log("Run created:", run);

        // Poll until the run reaches a terminal status
        while (
            run.status === "queued" ||
            run.status === "in_progress"
        ) {
            context.log(`Run status: ${run.status}. Waiting...`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            run = await client.agents.getRun(thread.id, run.id);
        }
        context.log("Run completed with status:", run.status);

        // Retrieve messages
        const messages = await client.agents.listMessages(thread.id);
        context.log("Messages retrieved:", messages);

        // Find the latest assistant message(s)
        const assistantMessages = messages.data
            .filter(msg => msg.role === "assistant")
            .map(msg =>
                msg.content
                    .filter(item => item.type === "text" && typeof (item as any).text?.value === "string")
                    .map(item => (item as any).text.value)
                    .join("\n")
            )
            .filter(Boolean);

        context.log("Assistant messages:", assistantMessages);

        const responseText = assistantMessages.length > 0
            ? assistantMessages.join("\n\n")
            : "No assistant response.";

        if (responseText === "No assistant response.") {
            context.warn("No assistant response found in messages.");
        }

        return {
            body: JSON.stringify({
                message: responseText
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
