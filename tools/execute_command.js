const { exec } = require('child_process');

module.exports = {
    name: "execute_command",
    description: "Menjalankan perintah terminal/CLI di sistem server (Linux).",
    parameters: {
        type: "OBJECT",
        properties: {
            command: { type: "STRING", description: "Perintah CLI yang akan dijalankan" }
        },
        required: ["command"]
    },
    execute: async (args) => {
        return new Promise((resolve) => {
            exec(args.command, { cwd: process.cwd(), maxBuffer: 2 * 1024 * 1024, timeout: 60000 }, (error, stdout, stderr) => {
                let output = "";
                if (error) output += `ERROR:\n${error.message}\n`;
                if (stderr) output += `STDERR:\n${stderr}\n`;
                if (stdout) output += `STDOUT:\n${stdout}\n`;
                if (!output) output = "Perintah selesai tanpa output.";
                if (output.length > 5000) output = output.substring(0, 5000) + "\n...[DIPOTONG]";
                resolve({ output });
            });
        });
    }
};
