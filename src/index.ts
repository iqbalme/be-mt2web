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
    } else if (url.pathname === "/delete" && request.method === "POST") {
      return this.handleChannelDelete(request);
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
      // Note: We overwrite instead of merging to ensure the UI reflects the latest JSON structure
      // (as per issue #5 requirement for dynamic keys)
      let channelData = {
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

      // Schedule cleanup alarm (setiap 1 menit)
      const currentAlarm = await this.ctx.storage.getAlarm();
      if (currentAlarm === null) {
        await this.ctx.storage.setAlarm(Date.now() + 60 * 1000);
      }

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

  async handleChannelDelete(request: Request): Promise<Response> {
    try {
      const payload: any = await request.json();
      const channel = payload.channel;
      if (channel && this.allChannelData.has(channel)) {
        this.allChannelData.delete(channel);
        await this.ctx.storage.put(
          "allChannelData",
          Object.fromEntries(this.allChannelData)
        );
        this.broadcastDelete(channel);
      }
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

  // Periodic cleanup for idle channels (Issue #5)
  async alarm() {
    const IDLE_TIMEOUT_SECONDS = 3600; // Ubah angka ini (dalam detik), contoh: 120 untuk 2 menit
    const IDLE_TIMEOUT_MS = IDLE_TIMEOUT_SECONDS * 1000;
    const now = Date.now();
    let changed = false;

    for (const [channel, data] of this.allChannelData.entries()) {
      const updatedAt = new Date(data.updated_at).getTime();
      if (now - updatedAt > IDLE_TIMEOUT_MS) {
        this.allChannelData.delete(channel);
        changed = true;
        this.broadcastDelete(channel);
        console.log(`Auto-deleted idle channel: ${channel}`);
      }
    }

    if (changed) {
      await this.ctx.storage.put(
        "allChannelData",
        Object.fromEntries(this.allChannelData)
      );
      this.broadcastToClients();
    }

    // Reschedule alarm setiap 1 menit agar lebih responsif terhadap timeout yang pendek
    await this.ctx.storage.setAlarm(Date.now() + 60 * 1000);
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

  broadcastDelete(channel: string) {
    const message = JSON.stringify({ type: 'delete', channel });
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
    } else if (url.pathname === "/delete" && request.method === "POST") {
      this.lastData = {};
      await this.ctx.storage.delete("lastData");
      // Optionally disconnect active sessions for this channel
      for (const session of this.sessions) {
        session.close();
      }
      this.sessions.clear();
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } else if (url.pathname === "/ws" && request.method === "GET") {
      return this.handleWebSocket(request);
    }

    return new Response("Not found in channel", { status: 404 });
  }

  async handleUpdate(request: Request): Promise<Response> {
    try {
      const payload: any = await request.json();
      const { channel, remove, ...data } = payload;

      // Overwrite state with incoming data (Issue #5: Dynamic keys)
      this.lastData = {
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

    } else if (url.pathname === "/delete") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }

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

      // Route to DashboardHub to remove from global list
      const hubId = env.DASHBOARD_HUB.idFromName("main");
      const hubStub = env.DASHBOARD_HUB.get(hubId);
      await hubStub.fetch(new Request("https://hub/delete", {
        method: "POST",
        body: JSON.stringify({ channel: payload.channel }),
        headers: { "Content-Type": "application/json" }
      }));

      // Route to the specific Durable Object instance to clear its local data
      const id = env.TRADING_CHANNEL.idFromName(payload.channel);
      const stub = env.TRADING_CHANNEL.get(id);
      return stub.fetch(request);

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
