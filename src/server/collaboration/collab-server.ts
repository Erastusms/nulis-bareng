import { Server, type Configuration } from "@hocuspocus/server";
import { collabAuth, CollabAuthService } from "./collab-auth";
import { loadPageYDoc, exportPageYDoc } from "./collab-persistence";
import { pageRepository } from "@/server/db/repositories/page.repository";
import type { IPageRepository } from "@/server/db/repository";
import { parseCollabRoomName } from "@/features/document/lib/collab-utils";
import { wsLogger } from "../websocket/logger";

export interface CreateCollabServerOptions extends Partial<Configuration> {
  pageRepo?: IPageRepository;
  authService?: CollabAuthService;
}

/**
 * Creates and configures a Hocuspocus collaboration server instance with
 * strict authentication, workspace authorization, and durable PostgreSQL persistence.
 */
export function createCollabServer(options: CreateCollabServerOptions = {}): Server {
  const {
    pageRepo = pageRepository,
    authService = collabAuth,
    ...hocuspocusConfig
  } = options;

  const server = new Server({
    name: "nulis-bareng-collab",
    debounce: 2000,
    maxDebounce: 5000,
    quiet: true,
    ...hocuspocusConfig,

    async onAuthenticate(data) {
      const { token, documentName, requestHeaders } = data;
      const authResult = await authService.authorizeConnection(token, documentName, requestHeaders);

      if (!authResult.authorized) {
        wsLogger.warn("Collaboration connection rejected in onAuthenticate", {
          documentName,
          reason: authResult.reason,
        });
        throw new Error(authResult.reason);
      }

      return {
        user: authResult.user,
        workspaceId: authResult.workspaceId,
        pageId: authResult.pageId,
      };
    },

    async onLoadDocument(data) {
      const parsed = parseCollabRoomName(data.documentName);
      if (!parsed) {
        throw new Error(`Invalid collaborative document identifier: '${data.documentName}'.`);
      }

      const page = await pageRepo.findById(parsed.pageId);
      if (!page) {
        throw new Error(`Document '${parsed.pageId}' not found.`);
      }

      const ydoc = loadPageYDoc(page, data.document);
      return ydoc;
    },

    async onStoreDocument(data) {
      const parsed = parseCollabRoomName(data.documentName);
      if (!parsed) return;

      const binaryState = exportPageYDoc(data.document);
      await pageRepo.update(parsed.pageId, {
        yjsState: binaryState,
      });

      wsLogger.info("Persisted collaborative document snapshot to database", {
        pageId: parsed.pageId,
        workspaceId: parsed.workspaceId,
        byteSize: binaryState.byteLength,
      });
    },

    async onDisconnect(data) {
      const context = data.context as { user?: { id: string; name: string } };
      wsLogger.info("Collaborator disconnected from document room", {
        documentName: data.documentName,
        userId: context.user?.id,
      });
    },
  });

  return server;
}

export const collabServer = createCollabServer();
