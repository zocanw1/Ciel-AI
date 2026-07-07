const fs = require('fs');
const path = require('path');

module.exports = {
    name: "write_file",
    description: "Membuat file baru atau menimpa file yang sudah ada. CUMA BISA nulis di folder Notes (second-brain/Second Brain/02 - Human View/Notes/).",
    parameters: {
        type: "OBJECT",
        properties: {
            filePath: { type: "STRING", description: "Path file tujuan. Contoh: second-brain/Second Brain/02 - Human View/Notes/Nama Catatan.md" },
            content: { type: "STRING", description: "Isi konten file" }
        },
        required: ["filePath", "content"]
    },
    execute: async (args) => {
        try {
            let targetPath = args.filePath;
            if (!path.isAbsolute(targetPath)) {
                targetPath = path.resolve(process.cwd(), targetPath);
            }
            const dir = path.dirname(targetPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(targetPath, args.content, 'utf-8');
            return { success: true, filePath: targetPath, message: "File berhasil ditulis." };
        } catch (error) {
            return { error: error.message };
        }
    }
};
