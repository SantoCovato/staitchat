// Configurazione minimale per forzare la connessione
const peer = new Peer(undefined, {
    host: 'peerjs.live',
    port: 443,
    secure: true,
    debug: 3
});

let conn = null;

// Quando il nodo è pronto
peer.on('open', (id) => {
    document.getElementById('my-id').innerText = "IL TUO ID: " + id;
});

// Gestione errori
peer.on('error', (err) => {
    document.getElementById('my-id').innerText = "ERRORE: " + err.type;
    console.error(err);
});

// Ricezione connessione
peer.on('connection', (c) => {
    conn = c;
    gestisciConnessione();
});

function connetti() {
    const target = document.getElementById('target-id').value;
    conn = peer.connect(target);
    gestisciConnessione();
}

function gestisciConnessione() {
    conn.on('open', () => {
        document.getElementById('status').innerText = "Stato: Connesso!";
    });

    conn.on('data', (data) => {
        aggiungiMessaggio("Lui: " + data);
    });
}

function invia() {
    if (conn && conn.open) {
        const msg = document.getElementById('msg-input').value;
        conn.send(msg);
        aggiungiMessaggio("Io: " + msg);
        document.getElementById('msg-input').value = "";
    }
}

function aggiungiMessaggio(testo) {
    const div = document.createElement('div');
    div.innerText = testo;
    document.getElementById('messages').appendChild(div);
}
