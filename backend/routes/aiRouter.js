const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const db = require('../db/connection');
require('dotenv').config();

// Node.js 18+ has built-in fetch; if using older version, uncomment:
// const fetch = require('node-fetch');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

let pipeline = null;
const getPipeline = async () => {
    if (!pipeline) {
        const module = await import('@xenova/transformers');
        pipeline = module.pipeline;
    }
    return pipeline;
};

const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `
You are a highly efficient, peer-like database engine assistant for a Malaysian factory management system.

## CORE OPERATIONS
* **CREATE/UPDATE/DELETE:** Validate inputs against the dynamic schema provided in context. Construct precise SQL queries using \`queryDatabase\`.
* **READ:** Fetch data efficiently using SELECT with smart JOINs. If no records match, state it naturally in a single sentence.
* **SAFETY:** Never execute destructive queries (e.g., DELETE, UPDATE) without an explicit WHERE clause targeting a specific identifier.

## CRITICAL CONSTRAINTS
* **TIMEZONE:** DB timestamps are UTC. Convert to Malaysian Time (MYT, +8 hours). Format as DD/MM/YYYY or write out naturally. Never output raw UTC strings.
* **IDs & COLUMNS:** Case-sensitive. Match the injected schema context exactly. Hide raw internal auto-incrementing primary keys.
* **DATA RESTRICTIONS:** NO JSON dumps, NO Markdown/HTML tables (\`|\`, \`---\`). Summarize structural outputs or lists in clean bullet points.
* **TIMESTAMP VALUES:** When inserting or updating timestamp columns (created_at, updated_at, etc.), always use the MySQL function NOW() – never send the string 'now()'.
* **DELETING PROJECTS:** Use deleteRecord with table="projects", idColumn="projectNo", idValue="the job number". This will call the full cascading delete API.

## STRICT RESPONSE FORMAT
Be exceptionally concise. Eliminate all greetings, pleasantries, introductory remarks, or concluding explanations.
* Use bullet points starting with \`- \` for multiple attributes/items.
* For single results or action confirmations, state them directly in one brief sentence.
`;

const tools = [
  {
    type: 'function',
    function: {
      name: 'queryDatabase',
      description: 'Run a standard parameterized SELECT query on the database to search data.',
      parameters: {
        type: 'object',
        properties: {
          sql: { type: 'string', description: 'The SELECT statement. Use "?" for parameters.' },
          params: { type: 'array', items: { type: 'string' }, description: 'Values for query placeholders.' }
        },
        required: ['sql', 'params']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'insertRecord',
      description: 'Insert a new row into any table.',
      parameters: {
        type: 'object',
        properties: { table: { type: 'string' }, data: { type: 'object' } },
        required: ['table', 'data']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'updateRecord',
      description: 'Update fields in a table using an ID.',
      parameters: {
        type: 'object',
        properties: { table: { type: 'string' }, idColumn: { type: 'string' }, idValue: { type: 'string' }, updates: { type: 'object' } },
        required: ['table', 'idColumn', 'idValue', 'updates']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'deleteRecord',
      description: 'Remove a row from a table based on an ID identifier.',
      parameters: {
        type: 'object',
        properties: { table: { type: 'string' }, idColumn: { type: 'string' }, idValue: { type: 'string' } },
        required: ['table', 'idColumn', 'idValue']
      }
    }
  }
];

// ==========================================
// IN-MEMORY EMBEDDING RAG STORE FOR SCHEMA
// ==========================================
let vectorStore = [];
let embeddingPipeline = null;

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function initializeSchemaRAGStore() {
  if (!embeddingPipeline) {
    const pipelineFunc = await getPipeline();
    embeddingPipeline = await pipelineFunc('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  console.log("Indexing Database Schema into RAG Vector Store...");
  
  const [columns] = await db.query(`
    SELECT table_name AS tableName, column_name AS columnName, data_type AS dataType 
    FROM information_schema.columns 
    WHERE table_schema = DATABASE()
  `);

  const schemaMap = {};
  columns.forEach(row => {
    if (!schemaMap[row.tableName]) schemaMap[row.tableName] = [];
    schemaMap[row.tableName].push(`${row.columnName} (${row.dataType})`);
  });

  vectorStore = [];
  
  for (const [tableName, fields] of Object.entries(schemaMap)) {
    const textContent = `Table: ${tableName}. Columns: ${fields.join(', ')}`;
    const output = await embeddingPipeline(textContent, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data);

    vectorStore.push({
      tableName,
      textContent,
      embedding
    });
  }
  console.log("RAG Vector Store initialization complete.");
}

async function retrieveRelevantSchema(userQuery) {
  if (vectorStore.length === 0) await initializeSchemaRAGStore();
  
  const output = await embeddingPipeline(userQuery, { pooling: 'mean', normalize: true });
  const queryEmbedding = Array.from(output.data);

  const scored = vectorStore.map(item => ({
    ...item,
    similarity: cosineSimilarity(queryEmbedding, item.embedding)
  }));

  const topResults = scored.sort((a, b) => b.similarity - a.similarity).slice(0, 2);
  return topResults.map(item => item.textContent).join('\n\n');
}

function fixUnionCollation(sql) {
  if (!/UNION/i.test(sql)) return sql;
  const parts = sql.split(/\s+UNION\s+ALL\s+/i);
  return parts.map(part => {
    const selectMatch = part.match(/^SELECT\s+(.*?)\s+FROM/i);
    if (!selectMatch) return part;
    let columns = selectMatch[1]
      .replace(/\btitle\b/gi, 'title COLLATE utf8mb4_unicode_ci')
      .replace(/\bstatus\b/gi, 'status COLLATE utf8mb4_unicode_ci');
    return part.replace(/^SELECT\s+.*?\s+FROM/i, `SELECT ${columns} FROM`);
  }).join(' UNION ALL ');
}

function fixCamelCaseColumns(sql) {
  return sql.replace(/\bcreatedAt\b/gi, 'created_at').replace(/\bupdatedAt\b/gi, 'updated_at');
}

function sanitizeDatetimeValues(data) {
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && value.toLowerCase() === 'now()') {
      sanitized[key] = new Date();
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// ==========================================
// TOOL EXECUTOR – with special project delete
// ==========================================
async function executeTool(name, parsedArgs) {
  switch (name) {
    case 'queryDatabase':
      if (!parsedArgs.sql.trim().toUpperCase().startsWith('SELECT')) {
        return { error: 'Security Exception: Only SELECT queries are allowed.' };
      }
      let sql = fixCamelCaseColumns(fixUnionCollation(parsedArgs.sql));
      const [rows] = await db.query(sql, parsedArgs.params || []);
      return rows;

    case 'insertRecord':
      if (/[^a-zA-Z0-9_]/.test(parsedArgs.table)) return { error: 'Invalid table format.' };
      
      if (parsedArgs.table === 'project_files') {
        const fileData = parsedArgs.data.file_data;
        if (!fileData || (Buffer.isBuffer(fileData) && fileData.length === 0)) {
          return { error: 'No file data provided – cannot insert empty record into project_files.' };
        }
      }

      const sanitizedData = sanitizeDatetimeValues(parsedArgs.data);
      const fields = Object.keys(sanitizedData);
      const placeholders = fields.map(() => '?').join(', ');
      const [insertResult] = await db.query(
        `INSERT INTO \`${parsedArgs.table}\` (${fields.join(', ')}) VALUES (${placeholders})`,
        Object.values(sanitizedData)
      );
      return { success: true, insertId: insertResult.insertId };

    case 'updateRecord':
      if (/[^a-zA-Z0-9_]/.test(parsedArgs.table) || /[^a-zA-Z0-9_]/.test(parsedArgs.idColumn)) 
        return { error: 'Invalid properties.' };
      
      const sanitizedUpdates = sanitizeDatetimeValues(parsedArgs.updates);
      const updates = Object.entries(sanitizedUpdates)
        .map(([key]) => `\`${key}\` = ?`).join(', ');
      const [updateResult] = await db.query(
        `UPDATE \`${parsedArgs.table}\` SET ${updates} WHERE \`${parsedArgs.idColumn}\` = ?`,
        [...Object.values(sanitizedUpdates), parsedArgs.idValue]
      );
      return { success: true, affectedRows: updateResult.affectedRows };

    case 'deleteRecord':
      if (/[^a-zA-Z0-9_]/.test(parsedArgs.table) || /[^a-zA-Z0-9_]/.test(parsedArgs.idColumn)) 
        return { error: 'Invalid properties.' };

      // SPECIAL CASE: Deleting a project – use full cascade API (by job number)
      if (parsedArgs.table === 'projects') {
        const identifier = encodeURIComponent(parsedArgs.idValue);
        const apiUrl = `http://localhost:5000/api/projects/${identifier}`;
        const response = await fetch(apiUrl, { method: 'DELETE' });
        if (!response.ok) {
          let errorMsg = `Delete failed with status ${response.status}`;
          try {
            const errBody = await response.json();
            errorMsg = errBody.error || errorMsg;
          } catch (_) {}
          return { error: errorMsg };
        }
        const result = await response.json();
        return { success: true, message: result.message || `Project ${parsedArgs.idValue} deleted` };
      }

      // For all other tables (tasks, files, etc.) – simple SQL delete (no cascade needed)
      const [deleteResult] = await db.query(
        `DELETE FROM \`${parsedArgs.table}\` WHERE \`${parsedArgs.idColumn}\` = ?`,
        [parsedArgs.idValue]
      );
      return { success: true, affectedRows: deleteResult.affectedRows };

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

function normalizeToolCalls(messages) {
  return messages.map(msg => {
    if (msg.role === 'assistant' && msg.tool_calls) {
      return { ...msg, content: msg.content || null };
    }
    return msg;
  });
}

const sessions = new Map();

initializeSchemaRAGStore().catch(console.error);

// ==========================================
// MAIN CHAT ENDPOINT (STREAMING)
// ==========================================
router.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  if (!message || !sessionId) return res.status(400).json({ error: 'Missing parameters' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    let conversationHistory = sessions.get(sessionId) || [];

    if (conversationHistory.length === 0) {
      conversationHistory.push({ role: 'system', content: SYSTEM_PROMPT });
    }

    conversationHistory.push({ role: 'user', content: message });
    let isMutation = false;
    let keepLooping = true;
    let loopCount = 0;

    const contextSchemaSnippet = await retrieveRelevantSchema(message);

    while (keepLooping && loopCount < 5) {
      loopCount++;
      
      let normalizedHistory = normalizeToolCalls(conversationHistory);

      if (normalizedHistory[0] && normalizedHistory[0].role === 'system') {
        normalizedHistory[0] = {
          ...normalizedHistory[0],
          content: `${SYSTEM_PROMPT}\n\n**RELEVANT LIVE DATABASE SCHEMA CONTEXT:**\n${contextSchemaSnippet}`
        };
      }

      const stream = await groq.chat.completions.create({
        model: MODEL,
        messages: normalizedHistory,
        tools: tools,
        temperature: 0.1,
        max_completion_tokens: 600,
        stream: true,
      });

      let contentAccumulator = '';
      let toolCallsBuffer = [];

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          contentAccumulator += delta.content;
          sendEvent({ type: 'chunk', data: delta.content });
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCallsBuffer[tc.index]) {
              toolCallsBuffer[tc.index] = { id: tc.id, type: 'function', function: { name: '', arguments: '' } };
            }
            if (tc.id) toolCallsBuffer[tc.index].id = tc.id;
            if (tc.function?.name) toolCallsBuffer[tc.index].function.name += tc.function.name;
            if (tc.function?.arguments) toolCallsBuffer[tc.index].function.arguments += tc.function.arguments;
          }
        }
      }

      const finalToolCalls = toolCallsBuffer.filter(Boolean);

      if (finalToolCalls.length > 0) {
        conversationHistory.push({ role: 'assistant', content: contentAccumulator || null, tool_calls: finalToolCalls });

        for (const toolCall of finalToolCalls) {
          if (toolCall.function.name !== 'queryDatabase') isMutation = true;
          let parsedArgs = {};
          try {
            parsedArgs = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
          } catch {
            parsedArgs = {};
          }
          const result = await executeTool(toolCall.function.name, parsedArgs);
          conversationHistory.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: JSON.stringify(result) });
        }
        keepLooping = true;
      } else {
        if (contentAccumulator) conversationHistory.push({ role: 'assistant', content: contentAccumulator });
        keepLooping = false;
      }
    }

    sessions.set(sessionId, conversationHistory);
    sendEvent({ type: 'done', isMutation });
    res.end();

  } catch (error) {
    console.error('AI Processing error:', error);
    sendEvent({ type: 'error', error: error.message });
    res.end();
  }
});

module.exports = router;