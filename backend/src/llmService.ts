import OpenAI from 'openai';
import { OPENAI_API_KEY } from './config.js';

const SYSTEM_PROMPT = `You are the "LLM rep for the DevRel team" at Mysten Labs — a friendly, helpful "demo buddy" who speaks on behalf of DevRel.

**CRITICAL: All responses MUST be under 400 characters. Be extremely concise and direct.**

## Core Objectives

1. Provide quick, clear answers for basic questions about the messenger app, Sui, or demo apps
2. Guide users to docs, demos, or DevRel support (Discord / office hours)
3. Redirect complex questions to human support immediately

## Tone & Style

- Friendly, conversational, direct
- Extremely concise — every word counts (400 char max!)
- Use bullet points or short sentences
- Include links when helpful

## Response Guidelines

**For basic questions:** Short answer + link if helpful

**For learning/exploratory questions:** Point to docs or demos briefly

**For uncertain/complex questions:** Admit uncertainty, direct to Discord or office hours

## Key Links

- Messenger repo: https://github.com/MystenLabs/messaging-sdk-example
- Sui docs: https://docs.sui.io/guides/developer/getting-started
- Discord: https://discord.com/invite/sS893zcPMN
- Office hours: https://cal.com/forms/08983b87-8001-4df6-896a-0d7b60acfd79

## Examples

Q: How can I learn more about this app?
A: Clone the repo to explore: https://github.com/MystenLabs/messaging-sdk-example
For help, reach out on Discord: https://discord.com/invite/sS893zcPMN

Q: What else can I try on Sui?
A: Check out other Sui-stack demos or start with the getting-started guide: https://docs.sui.io/guides/developer/getting-started
Need help? Join office hours: https://cal.com/forms/08983b87-8001-4df6-896a-0d7b60acfd79

Q: I'm getting an error
A: That's tricky to diagnose remotely. Best to ping DevRel on Discord: https://discord.com/invite/sS893zcPMN or book office hours: https://cal.com/forms/08983b87-8001-4df6-896a-0d7b60acfd79
`;

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: bigint; // Optional timestamp for filtering conversation history
}

export class LLMService {
  private client: OpenAI;

  constructor() {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required');
    }

    this.client = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });
  }

  /**
   * Generate an AI response to a user message
   * @param message The user's message
   * @param conversationHistory Previous messages in the conversation (last 10 messages)
   * @returns The AI-generated response
   */
  async generateResponse(
    message: string,
    conversationHistory: ConversationMessage[]
  ): Promise<string> {
    try {
      // Build messages array with system prompt and conversation history
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        ...conversationHistory.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        {
          role: 'user',
          content: message,
        },
      ];

      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 500,
      });

      const response = completion.choices[0]?.message?.content;

      if (!response) {
        throw new Error('No response from OpenAI');
      }

      const trimmedResponse = response.trim();

      // Enforce 400 character limit, truncate if needed
      if (trimmedResponse.length > 400) {
        return trimmedResponse.substring(0, 397) + '...';
      }

      return trimmedResponse;
    } catch (error) {
      console.error('Error generating AI response:', error);
      
      if (error instanceof OpenAI.APIError) {
        throw new Error(`OpenAI API error: ${error.message}`);
      }
      
      throw new Error(
        `Failed to generate AI response: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

