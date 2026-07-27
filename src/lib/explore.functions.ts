import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { exploreTopic } from "./explore.server";

export const searchTopic = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        query: z.string().min(2).max(200),
        mode: z.enum(["crisp", "textbook"]).default("crisp"),
        strict: z.boolean().optional().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data }) => exploreTopic(data.query, data.mode, data.strict));