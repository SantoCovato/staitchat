// Inizializzazione pulita
const peer = new Peer(); 
let conn = null;

// Quando il nodo è pronto
peer.on('open', (id) => {
    document.getElementById('my-id').innerText = "IL TUO ID: " + id;
});

// Gestione errori di rete
peer.on('error', (err) => {
    console.error(err);
    document.getElementById('my-id').innerText = "ERRORE RETE: " + err.type;
});

// Quando qualcuno si connette a noi
peer.on('connection', (c) => {
    conn = c;
    setupConnessione();
});

// Connessione manuale verso un ID
function connetti() {
    const target = document.getElementById('target-id').value;
    conn = peer.connect(target);
    setupConnessione();
}

// Configura i listener per messaggi e stato
function setupConnessione() {
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
