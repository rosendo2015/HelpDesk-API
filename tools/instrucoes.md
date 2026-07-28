📘 Guia de Uso — Script `generate-md.ts`

Este utilitário percorre todo o projeto (backend ou frontend) e gera um arquivo `.md` com o conteúdo dos arquivos, formatado em Markdown e destacado por tipo de código.

---

## 🛠️ Estrutura do Projeto
````
meu-projeto/
├─ backend/
│   ├─ src/
│   └─ tools/
│       └─ generate-md.ts
├─ frontend/
│   ├─ src/
│   └─ tools/
│       └─ generate-md.ts
├─ package.json
└─ tsconfig.json
---
````
## 📂 Script `generate-md.ts`

Coloque este arquivo dentro da pasta `tools` de cada parte (backend e frontend):

```ts
import { readdirSync, statSync, readFileSync, appendFileSync, existsSync, unlinkSync } from "fs";
import { join, extname, dirname, resolve, relative, basename } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// raiz do projeto (um nível acima da pasta tools)
const projectPath = resolve(__dirname, "..");

// nome da pasta raiz (ex: backend ou frontend)
const projectName = basename(projectPath);

// arquivo de saída dentro da pasta tools
const outputFile = join(__dirname, `${projectName}.md`);

const extensions = [".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".env", ".css"];
const specialFiles = [
  "Dockerfile", "Makefile", ".eslintrc", ".prettierrc",
  "vite.config.ts", "vite.config.js", "tailwind.config.js", "postcss.config.js"
];
const excludeDirs = ["node_modules", ".git", "dist", "build", "generated"];
const excludeFiles = ["package-lock.json"];

if (existsSync(outputFile)) unlinkSync(outputFile);

function formatHeader(fullPath: string): string {
  const rel = relative(projectPath, fullPath);
  return `## ${rel}`;
}

function wrapContent(ext: string, content: string): string {
  if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) return `\n\`\`\`${ext.replace(".", "")}\n${content}\n\`\`\`\n`;
  if (ext === ".json") return `\n\`\`\`json\n${content}\n\`\`\`\n`;
  if (ext === ".md") return `\n${content}\n`;
  if (ext === ".env") return `\n\`\`\`env\n${content}\n\`\`\`\n`;
  if (ext === ".css") return `\n\`\`\`css\n${content}\n\`\`\`\n`;
  if (specialFiles.includes(ext)) return `\n\`\`\`\n${content}\n\`\`\`\n`;
  return `\n${content}\n`;
}

function walk(dir: string): void {
  for (const file of readdirSync(dir)) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!excludeDirs.includes(file)) walk(fullPath);
    } else {
      const ext = extname(file) || file;
      if ((extensions.includes(ext) || specialFiles.includes(file)) && !excludeFiles.includes(file)) {
        try {
          const content = readFileSync(fullPath, "utf8");
          appendFileSync(outputFile, `\n${formatHeader(fullPath)}\n`);
          appendFileSync(outputFile, wrapContent(ext, content));
        } catch (err) {
          console.error("⚠️ Erro ao ler arquivo:", fullPath, (err as Error).message);
        }
      }
    }
  }
}

console.log(`🔍 Gerando arquivo ${projectName}.md...`);
walk(projectPath);
console.log(`✅ Arquivo gerado com sucesso em ${outputFile}`);
```
⚙️ Configuração do TypeScript
- No tsconfig.json da raiz, adicione:

````
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ES2020",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "types": ["node"]
  },
  "include": ["src", "tools"]
}
````
📦 Dependências
- Instale:

````
"scripts": {
  "generate-md": "ts-node --esm tools/generate-md.ts"
}

````
🚀 Como Rodar
- No terminal, vá até a pasta desejada e rode:
````
npm run generate-md
````
