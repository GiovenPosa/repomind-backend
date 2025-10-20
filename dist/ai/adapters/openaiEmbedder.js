"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIEmbedder = void 0;
const openai_1 = __importDefault(require("openai"));
class OpenAIEmbedder {
    constructor(opts) {
        this.name = "openai";
        // Good default: cheaper 1536-dim model
        this.dim = 1536;
        this.client = new openai_1.default({ apiKey: opts?.apiKey ?? process.env.OPENAI_API_KEY });
        this.model = opts?.model ?? process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small";
    }
    async embed(texts) {
        if (!texts.length)
            return [];
        const res = await this.client.embeddings.create({
            model: this.model,
            input: texts,
        });
        return res.data.map(d => d.embedding);
    }
}
exports.OpenAIEmbedder = OpenAIEmbedder;
