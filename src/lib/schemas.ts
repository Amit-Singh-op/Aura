import { z } from 'zod';

export const authSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(20, "Username must be at most 20 characters").regex(/^[a-zA-Z0-9_]+$/, "Only alphanumeric and underscores allowed"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const createRoomSchema = z.object({
  name: z.string().min(3, "Room name must be at least 3 characters").max(30, "Room name must be at most 30 characters"),
  description: z.string().max(100).optional(),
  icon: z.string().emoji("Icon must be an emoji").optional(),
});
