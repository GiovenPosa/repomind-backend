"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIGenerator = void 0;
const openai_1 = __importDefault(require("openai"));
class OpenAIGenerator {
    constructor(opts) {
        this.client = new openai_1.default({ apiKey: opts?.apiKey ?? process.env.OPENAI_API_KEY });
        this.model = opts?.model ?? process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
    }
    async generate(prompt, opts) {
        const res = await this.client.chat.completions.create({
            model: this.model,
            messages: [
                { role: "system", content: opts?.system ?? "You are a helpful codebase assistant. Only use the provided context." },
                { role: "user", content: prompt }
            ],
            max_tokens: opts?.maxTokens ?? 500,
            temperature: opts?.temperature ?? 0.2,
        });
        return res.choices[0]?.message?.content ?? "";
    }
}
exports.OpenAIGenerator = OpenAIGenerator;
