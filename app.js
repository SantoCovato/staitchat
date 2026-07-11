// Configurazione forzata per evitare server-error
const peer = new Peer(undefined, {
    host: '0.peerjs.com',
    port: 443,
    path: '/',
    secure: true,
    debug: 3
});

let conn = null;

peer.on('open', (id) => {
    document.getElementById('my-id').innerText = "IL TUO ID: " + id;
});

peer.on('error', (err) => {
    // Se fallisce, stampiamo l'errore per capire cosa succede
    document.getElementById('my-id').innerText = "ERRORE: " + err.type;
    console.error("PeerJS Error:", err);
});

peer.on('connection', (c) => {
    conn = c;
    gestisciConnessione();
});

function connetti() {
    const target = document.getElementById('target-id').value;
    if(!target) return alert("Inserisci un ID");
    conn = peer.connect(target, { reliable: true });
    gestisciConnessione();
}

function gestisciConnessione() {
    conn.on('open', () => {
        document.getElementById('status').innerText = "Stato: Connesso!";
    });
    conn.on('data', (data) => {
        aggiungiMessaggio("Lui: " + data);
    });
    conn.on('error', (err) => {
        console.error("Connessione fallita", err);
    });
}

function invia() {
    if (conn && conn.open) {
        const msg = document.getElementById('msg-input').value;
        conn.send(msg);
        aggiungiMessaggio("Io: " + msg);
        document.getElementById('msg-input').value = "";
    } else {
        alert("Non sei connesso!");
    }
}

function aggiungiMessaggio(testo) {
    const box = document.getElementById('messages');
    box.innerHTML += `<div>${testo}</div>`;
}
