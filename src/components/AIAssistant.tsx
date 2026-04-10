import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { BrainCircuit, Send, User, Bot, Loader2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const AIAssistant: React.FC = () => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
    { role: 'assistant', content: "Hello! I'm your Parkinson's Care Assistant. How can I help you today? You can ask me about treatments, exercises, or lifestyle tips." }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message to UI immediately
    const newUserMessage = { role: 'user' as const, content: userMessage };
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      // Convert messages to Gemini format for history
      const history = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: "You are a specialized medical assistant for Parkinson's disease. Provide helpful, empathetic, and evidence-based information about Parkinson's treatment, exercises, diet, and lifestyle. Always clarify that you are an AI and not a substitute for professional medical advice. If the user asks about their specific data, remind them that their doctor can see their tremor history and medication logs in the shared portal. Keep responses concise and scannable.",
        },
        history: history
      });

      const result = await chat.sendMessage({ message: userMessage });
      const assistantMessage = result.text || "I'm sorry, I couldn't process that request.";
      
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "I encountered an error. Please try again later." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-none shadow-xl bg-white h-[calc(100vh-12rem)] flex flex-col overflow-hidden">
      <CardHeader className="border-b border-[#141414]/5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#5A5A40]/10 rounded-lg">
            <BrainCircuit className="h-6 w-6 text-[#5A5A40]" />
          </div>
          <div>
            <CardTitle className="font-serif text-xl">Care Assistant</CardTitle>
            <CardDescription>AI-powered support for Parkinson's management</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 min-h-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 pb-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'user' ? 'bg-[#5A5A40] text-white' : 'bg-gray-100 text-[#5A5A40]'
                  }`}>
                    {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={`p-3 rounded-2xl text-sm shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-[#5A5A40] text-white rounded-tr-none' 
                      : 'bg-white border border-[#141414]/10 text-[#141414] rounded-tl-none'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-3 items-center text-[#141414]/40 text-xs italic">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Assistant is thinking...
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
        <div className="p-4 border-t border-[#141414]/5 bg-gray-50/50 flex-shrink-0">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2"
          >
            <Input 
              placeholder="Ask about exercises, diet, or symptoms..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="bg-white border-[#141414]/10 focus-visible:ring-[#5A5A40]"
            />
            <Button type="submit" disabled={isLoading} className="bg-[#5A5A40] hover:bg-[#4A4A30]">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};
