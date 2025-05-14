import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

export async function getBestProgrammer(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);
    return {
        body: JSON.stringify({
            name: `Thomas`,
            company: `Corporate Software AG`,
        })
    };
};

app.http('getBestProgrammer', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: getBestProgrammer,
    route: 'programmers/best',
});
