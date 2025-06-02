import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";

export async function createThread(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);
    try {
        const client = new AIProjectClient(
            process.env.AIFOUNDRY_CONNECTION_STRING!,
            new DefaultAzureCredential()
        );
        context.log("AIProjectClient initialized.");

        const thread = await client.agents.threads.create();
        context.log("Thread created:", thread);

        return {
            body: JSON.stringify({
                threadId: thread.id
            })
        };
    } catch (err: any) {
        context.error("Error creating thread:", err);
        return { status: 500, body: "Error creating thread." };
    }
};

app.http('createThread', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: createThread,
    route: 'thread',
});
