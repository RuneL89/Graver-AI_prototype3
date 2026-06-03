import { z } from "zod";
import type { AgentSkill, AgentContext } from "@graver-ai/shared";
import { LLMClient } from "../llm/client.js";

const inputSchema = z.object({
  message: z.string(),
});

const outputSchema = z.object({
  reply: z.string(),
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

export const testConnectionSkill: AgentSkill<Input, Output> = {
  name: "testConnection",
  description: "Sends a simple prompt to the LLM to verify connectivity.",
  inputSchema,
  outputSchema,
  async execute(input: Input, context: AgentContext): Promise<Output> {
    const prompt = `The user sent this message: "${input.message}". Please reply with a short, friendly greeting.`;
    const reply = await context.llmClient.complete(prompt);
    return { reply: reply.trim() };
  },
};

export { LLMClient };
