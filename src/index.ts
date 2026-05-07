import { DurableObject } from "cloudflare:workers";

export interface Env {
  TRADING_CHANNEL: DurableObjectNamespace;
  DASHBOARD_HUB: DurableObjectNamespace;
}

// Dashboard Hub untuk track semua channel
export class DashboardHub extends DurableObject {
  allChannelData: Map<string, Record<string, any>> = new Map();
  sessions: Set<WebSocket> = new Set();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<Record<string, Record<string, any>>>("allChannelData");
      if (stored) {
        this.allChannelData = new Map(Object.entries(stored));
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws" && request.method === "GET") {
      return this.handleDashboardWebSocket(request);
    } else if (url.pathname === "/update" && request.method === "POST") {
      return this.handleChannelUpdate(request);
    }

    return new Response("Not found in hub", { status: 404 });
  }

  async handleChannelUpdate(request: Request): Promise<Response> {
    try {
      const payload: any = await request.json();
      const { channel, remove, ...data } = payload;

      if (!channel) {
        return new Response(JSON.stringify({ error: "Missing channel" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Update channel data in hub
      let channelData = this.allChannelData.get(channel) || {};

      // Handle optional 'remove' array
      if (Array.isArray(remove)) {
        for (const key of remove) {
          delete channelData[key];
        }
      }

      // Merge incoming data
      channelData = {
        ...channelData,
        ...data,
        channel,
        updated_at: new Date().toISOString()
      };

      this.allChannelData.set(channel, channelData);

      // Persist to storage
      await this.ctx.storage.put(
        "allChannelData",
        Object.fromEntries(this.allChannelData)
      );

      // Broadcast to all dashboard clients
      this.broadcastToClients();

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  handleDashboardWebSocket(request: Request): Response {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    server.accept();
    this.sessions.add(server);

    // Send all current data immediately upon connection
    const allData = Object.fromEntries(this.allChannelData);
    if (Object.keys(allData).length > 0) {
      server.send(JSON.stringify(allData));
    }

    server.addEventListener("close", () => {
      this.sessions.delete(server);
    });

    server.addEventListener("error", () => {
      this.sessions.delete(server);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  broadcastToClients() {
    const allData = Object.fromEntries(this.allChannelData);
    const message = JSON.stringify(allData);

    for (const session of this.sessions) {
      try {
        session.send(message);
      } catch (err) {
        this.sessions.delete(session);
      }
    }
  }
}

export class TradingChannel extends DurableObject {
  lastData: Record<string, any> = {};
  sessions: Set<WebSocket> = new Set();
  env: Env;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.env = env;
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<Record<string, any>>("lastData");
      if (stored) {
        this.lastData = stored;
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/update" && request.method === "POST") {
      return this.handleUpdate(request);
    } else if (url.pathname === "/ws" && request.method === "GET") {
      return this.handleWebSocket(request);
    }

    return new Response("Not found in channel", { status: 404 });
  }

  async handleUpdate(request: Request): Promise<Response> {
    try {
      const payload: any = await request.json();
      const { channel, remove, ...data } = payload;

      // Handle optional 'remove' array
      if (Array.isArray(remove)) {
        for (const key of remove) {
          delete this.lastData[key];
        }
      }

      // Merge incoming data with existing state
      this.lastData = {
        ...this.lastData,
        ...data,
        updated_at: new Date().toISOString()
      };

      // Persist to storage
      await this.ctx.storage.put("lastData", this.lastData);

      // Broadcast to connected WebSocket clients
      this.broadcast(JSON.stringify(this.lastData));

      // Also update the dashboard hub
      const hubId = this.env.DASHBOARD_HUB.idFromName("main");
      const hubStub = this.env.DASHBOARD_HUB.get(hubId);
      await hubStub.fetch(new Request("https://hub/update", {
        method: "POST",
        body: JSON.stringify({
          channel: payload.channel || "Unknown",
          ...data,
          ...(Array.isArray(remove) && { remove })
        }),
        headers: { "Content-Type": "application/json" }
      }));

      return new Response(JSON.stringify({ success: true, data: this.lastData }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  handleWebSocket(request: Request): Response {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    // Cloudflare Workers WebSocketPair
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept the connection from the server side
    server.accept();
    this.sessions.add(server);

    // Send the latest data immediately upon connection
    if (Object.keys(this.lastData).length > 0) {
      server.send(JSON.stringify(this.lastData));
    }

    // Handle disconnects to prevent memory leaks
    server.addEventListener("close", () => {
      this.sessions.delete(server);
    });

    server.addEventListener("error", () => {
      this.sessions.delete(server);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  broadcast(msg: string) {
    for (const session of this.sessions) {
      try {
        session.send(msg);
      } catch (err) {
        // If sending fails, assume disconnected
        this.sessions.delete(session);
      }
    }
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws/all" || url.pathname === "/ws/dashboard") {
      // Dashboard endpoint - connect to DashboardHub
      if (request.method !== "GET") {
        return new Response("Method Not Allowed", { status: 405 });
      }

      const hubId = env.DASHBOARD_HUB.idFromName("main");
      const hubStub = env.DASHBOARD_HUB.get(hubId);
      return hubStub.fetch(request);

    } else if (url.pathname === "/update") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }

      // Read payload to extract the channel ID
      const reqClone = request.clone();
      let payload: any;
      try {
        payload = await reqClone.json();
      } catch (e) {
        return new Response("Invalid JSON", { status: 400 });
      }

      if (!payload.channel) {
        return new Response("Missing channel in JSON", { status: 400 });
      }

      // Route to the specific Durable Object instance
      const id = env.TRADING_CHANNEL.idFromName(payload.channel);
      const stub = env.TRADING_CHANNEL.get(id);
      
      // Forward the original request to the DO
      return stub.fetch(request);
      
    } else if (url.pathname === "/ws") {
      if (request.method !== "GET") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      
      const channel = url.searchParams.get("channel");
      if (!channel) {
        // If no channel specified, default to dashboard
        const hubId = env.DASHBOARD_HUB.idFromName("main");
        const hubStub = env.DASHBOARD_HUB.get(hubId);
        return hubStub.fetch(request);
      }

      // Route to the specific Durable Object instance
      const id = env.TRADING_CHANNEL.idFromName(channel);
      const stub = env.TRADING_CHANNEL.get(id);
      
      // Forward the original request to the DO
      return stub.fetch(request);
    }

    // Fallback: serve static assets if available
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }
    return new Response("Endpoint Not Found", { status: 404 });
  }
};
