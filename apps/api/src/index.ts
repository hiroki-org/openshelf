export default {
    async fetch(request: Request, env: any): Promise<Response> {
        return new Response(JSON.stringify({ status: "ok", service: "openshelf-api" }), {
            headers: { "Content-Type": "application/json" },
        });
    },
};