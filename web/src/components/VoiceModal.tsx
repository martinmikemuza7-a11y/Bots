import React, { useState } from 'react';
import { Mic, MicOff, Send, Volume2, X } from 'lucide-react';
import type { Bot } from '../types';
import { BotAvatar } from './BotAvatar';

interface VoiceModalProps {
  bot: Bot;
  onClose: () => void;
  onVoiceTurn: (botId: string, transcript: string) => Promise<{
    spokenReply: string;
    handedToChat: boolean;
  }>;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({ bot, onClose, onVoiceTurn }) => {
  const [listening, setListening] = useState(false);
  const [input, setInput] = useState('');
  const [log, setLog] = useState<Array<{ who: 'user' | 'bot'; text: string; handed?: boolean }>>([
    {
      who: 'bot',
      text: `Voice connected to ${bot.name} (${bot.screen.display}). Real work is handed straight to chat with my same memory and tools.`,
    },
  ]);

  const speak = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.03;
      window.speechSynthesis.speak(utter);
    }
  };

  const submitTranscript = async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setLog((prev) => [...prev, { who: 'user', text: clean }]);
    setInput('');
    const res = await onVoiceTurn(bot.id, clean);
    setLog((prev) => [...prev, { who: 'bot', text: res.spokenReply, handed: res.handedToChat }]);
    speak(res.spokenReply);
  };

  const toggleMic = () => {
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (!SpeechRec) {
      setListening(false);
      return;
    }

    if (listening) {
      setListening(false);
      return;
    }

    const recognition = new SpeechRec() as {
      lang: string;
      interimResults: boolean;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
    };
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    setListening(true);
    recognition.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript || '';
      setListening(false);
      if (transcript) void submitTranscript(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <BotAvatar variant={bot.avatarVariant} color={bot.accentColor} size="sm" />
            <div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Voice · {bot.name}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                xAI Realtime Voice &amp; Chat Handoff
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
          {log.map((item, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                item.who === 'user'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 ml-8'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 mr-8'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5 text-[10px] uppercase tracking-wider opacity-70">
                {item.who === 'bot' && <Volume2 className="w-3 h-3" />}
                <span>{item.who === 'user' ? 'You' : bot.name}</span>
              </div>
              {item.text}
              {item.handed && (
                <div className="mt-1.5 text-[11px] font-medium text-orange-600 dark:text-orange-400">
                  → Handed off to chat task queue
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMic}
            className={`p-2.5 rounded-xl transition-colors ${
              listening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-orange-500 text-white hover:bg-orange-600'
            }`}
            title="Speak with microphone"
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitTranscript(input);
            }}
            className="flex-1 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Or type what you’d say aloud..."
              className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <button
              type="submit"
              className="p-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
