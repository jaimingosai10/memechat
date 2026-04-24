import { z } from "zod";

export const createMessageSchema = z.object({
  handle: z.string().trim().min(1, "handle required").max(40, "handle too long"),
  imageUrl: z.string().trim().min(1, "imageUrl required").max(2048, "imageUrl too long"),
  topText: z.string().max(120, "topText too long").nullish(),
  bottomText: z.string().max(120, "bottomText too long").nullish(),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
