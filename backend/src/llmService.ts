import OpenAI from 'openai';
import { OPENAI_API_KEY } from './config.js';

const SYSTEM_PROMPT = `You are a helpful AI assistant in a messaging app that showcases the Sui Stack Messaging SDK. 
You help users understand how the messaging SDK works and answer questions about it. 
Be friendly, concise, and helpful. Keep responses conversational and not too technical unless asked.`;

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

      return response.trim();
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

