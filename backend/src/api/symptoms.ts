import { eq, and, gte, desc } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { symptomLogs } from "../db/schema.js";
import { getCurrentConfig } from "../jobs/weather-poll.js";
import { assembleCurrentSnapshot } from "../services/snapshot.js";

interface CreateSymptomBody {
  severity: number;
  tags: string[];
  notes?: string;
}

interface ListSymptomsQuery {
  days?: string;
}

export async function symptomRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/symptoms — log a symptom with environmental snapshot
  app.post<{ Body: CreateSymptomBody }>(
    "/api/symptoms",
    async (request, reply) => {
      const config = getCurrentConfig();
      if (!config) {
        return reply.status(503).send({ error: "Server not initialized" });
      }

      const { severity, tags, notes } = request.body;

      if (
        typeof severity !== "number" ||
        severity < 1 ||
        severity > 10 ||
        !Number.isInteger(severity)
      ) {
        return reply
          .status(400)
          .send({ error: "severity must be an integer from 1 to 10" });
      }

      if (!Array.isArray(tags)) {
        return reply.status(400).send({ error: "tags must be an array" });
      }

      const snapshot = await assembleCurrentSnapshot(config.userId);

      const [entry] = await db
        .insert(symptomLogs)
        .values({
          userId: config.userId,
          timestamp: new Date(),
          severity,
          tags,
          notes: notes || null,
          environmentalSnapshot: snapshot,
        })
        .returning();

      return reply.status(201).send(entry);
    },
  );

  // GET /api/symptoms?days=30 — list symptom logs with snapshots
  app.get<{ Querystring: ListSymptomsQuery }>(
    "/api/symptoms",
    async (request) => {
      const config = getCurrentConfig();
      if (!config) return { logs: [] };

      const days = Math.min(
        Math.max(parseInt(request.query.days || "30", 10), 1),
        365,
      );
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const logs = await db
        .select()
        .from(symptomLogs)
        .where(
          and(
            eq(symptomLogs.userId, config.userId),
            gte(symptomLogs.timestamp, since),
          ),
        )
        .orderBy(desc(symptomLogs.timestamp))
        .limit(500);

      return { logs };
    },
  );

  // DELETE /api/symptoms/:id — delete a symptom log
  app.delete<{ Params: { id: string } }>(
    "/api/symptoms/:id",
    async (request, reply) => {
      const config = getCurrentConfig();
      if (!config) {
        return reply.status(503).send({ error: "Server not initialized" });
      }

      const { id } = request.params;

      const deleted = await db
        .delete(symptomLogs)
        .where(
          and(eq(symptomLogs.id, id), eq(symptomLogs.userId, config.userId)),
        )
        .returning({ id: symptomLogs.id });

      if (deleted.length === 0) {
        return reply.status(404).send({ error: "Symptom log not found" });
      }

      return reply.status(204).send();
    },
  );
}
