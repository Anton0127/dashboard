const axios = require('axios');
console.log("✅ Axios berhasil di-load");
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());

let callStatus = { request: false, confirmed: false };
let callHistory = [];
let repairHistory = [];

// Kirim data mesin ke semua client (operator & teknisi)
setInterval(fetchArduinoData, 2000);

const ARDUINO_IP = 'http://192.168.223.39/data';
async function fetchArduinoData() {
    try {
        console.log("🔄 Mengambil data dari Arduino...");
        const response = await axios.get(ARDUINO_IP, { timeout: 5000 });

        if (!response.data) {
            throw new Error("Data dari Arduino kosong atau tidak valid");
        }

        const data = response.data;
        machineData = {
            status: data.status || "OFF",
            speed: Number(data.speed) || 0,
            counter: Number(data.counter) || 0,
            oilAlarm: Boolean(data.oilAlarm) || false
        };

        console.log("📡 Data dari Arduino:", machineData);
        io.emit('updateData', machineData); // Kirim data ke dashboard
    } catch (error) {
        console.error("⚠️ Error fetching data from Arduino:", error.message);
    }
}



io.on('connection', (socket) => {
    console.log('✅ Client connected');

    // Kirim data history ke client yang baru terhubung
    socket.emit('updateCallStatus', { callHistory, repairHistory });

    socket.on('callTechnician', () => {
        const timestamp = new Date().toLocaleString();
        callHistory.push({ message: "Memanggil Teknisi", timestamp });
        if (callHistory.length > 10) callHistory.shift();
        
        console.log("📜 History Pemanggilan:", callHistory); // Debugging log
        io.emit('notifyTechnician', "🚨 Butuh bantuan broo!");
        io.emit('notifyOperator', "📢 Teknisi telah dipanggil!");
        io.emit('updateCallStatus', { callHistory, repairHistory }); // Kirim history yang diperbarui
    });

    socket.on('confirmCall', () => {
        const timestamp = new Date().toLocaleString();
        callHistory.push({ message: "Teknisi Merespon Panggilan", timestamp });
        if (callHistory.length > 10) callHistory.shift();

        console.log("📜 History Pemanggilan:", callHistory); // Debugging log
        io.emit('notifyOperator', "✅ Teknisi dalam perjalanan!");
        io.emit('updateCallStatus', { callHistory, repairHistory }); // Kirim history yang diperbarui
    });

    socket.on('finishJob', () => {
        const timestamp = new Date().toLocaleString();
        repairHistory.push({ message: "Perbaikan Selesai", timestamp });
        if (repairHistory.length > 10) repairHistory.shift();

        console.log("🛠️ History Perbaikan:", repairHistory); // Debugging log
        io.emit('jobFinished');
        io.emit('updateCallStatus', { callHistory, repairHistory }); // Kirim history yang diperbarui
    });

    socket.on('oilAlarm', () => {
        console.log("⚠️ Oli perlu diganti!");
        const timestamp = new Date().toLocaleString();
        repairHistory.push({ message: "Oli perlu diganti", timestamp });
    
        if (repairHistory.length > 10) repairHistory.shift();
        saveHistory();
    
        io.emit('notifyTechnician', "⚠️ Oli perlu diganti!");
        io.emit('updateCallStatus', { callHistory, repairHistory });
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Client disconnected');
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});
