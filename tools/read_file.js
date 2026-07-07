const fs = require('fs');
const path = require('path');

module.exports = {
    name: "read_file",
    description: "Membaca isi teks dari file di Second Brain (bisa baca folder mana aja).",
    parameters: {
        type: "OBJECT",
        properties: {
            filePath: { type: "STRING", description: "Path file yang akan dibaca" }
        },
        required: ["filePath"]
    },
    execute: async (args) => {
        try {
            let targetPath = args.filePath;
            if (!path.isAbsolute(targetPath)) {
                targetPath = path.resolve(process.cwd(), targetPath);
            }
            if (!fs.existsSync(targetPath)) {
                return { error: "File tidak ditemukan: " + targetPath };
            }
            const stat = fs.statSync(targetPath);
            if (stat.size > 500000) {
                return { error: "File terlalu besar (>500KB), baca manual ya" };
            }
            const content = fs.readFileSync(targetPath, 'utf-8');
            let output = content;
            if (output.length > 5000) output = output.substring(0, 5000) + "\n...[DIPOTONG]";
            return { content: output };
        } catch (error) {
            return { error: error.message };
        }
    }
};
