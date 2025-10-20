"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.synthesizeAnswer = exports.buildContextBlock = void 0;
function buildContextBlock(snippets) {
    // Keep context compact; cap each snippet length if needed
    const blocks = snippets.map(s => `[${s.id}] ${s.filePath}:${s.startLine}-${s.endLine}
${s.text}
---`);
    return blocks.join("\n");
}
exports.buildContextBlock = buildContextBlock;
async function synthesizeAnswer(opts) {
    const { q, snippets, generator } = opts;
    const context = buildContextBlock(snippets);
    const system = `You answer questions about a codebase.
- Use ONLY the provided context. If missing, say you don’t know.
- Cite sources inline like [chunk-id] when you use them.
- Be concise and accurate.`;
    const prompt = `Question:
${q}

Context:
${context}

Instructions:
- Answer the question using the context.
- Add relevant citations like [3339a3abe4b6-0001] in the sentences where they apply.
- If the context is insufficient, say so.`;
    const answer = await generator.generate(prompt, { system, maxTokens: 400, temperature: 0.1 });
    // Collect a clean citation list (ids found in answer)
    const cited = Array.from(new Set((answer.match(/\[[0-9a-f]{12}-\d{4}\]/g) ?? []).map(x => x.slice(1, -1))));
    const citations = snippets
        .filter(s => cited.includes(s.id))
        .map(({ id, filePath, startLine, endLine }) => ({ id, filePath, startLine, endLine }));
    return { answer, citations };
}
exports.synthesizeAnswer = synthesizeAnswer;
