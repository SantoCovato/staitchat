// Elementi della UI
const setupScreen = document.getElementById('setup-screen');
const appScreen = document.getElementById('app-screen');
const myIdText = document.getElementById('my-id-text');
const qrcodeContainer = document.getElementById('qrcode');

let miaChiavePrivata = null;
let miaChiavePubblicaStringa = "";

// Al caricamento, controlla l'identità locale
window.addEventListener('DOMContentLoaded', async () => {
    const chiaveSalvata = localStorage.getItem('stait_chiave_pubblica');
    
    if (chiaveSalvata) {
        miaChiavePubblicaStringa = chiaveSalvata;
        mostraApp();
    } else {
        // Nascondiamo l'app screen se non siamo configurati per non mostrare flash grafici
        appScreen.style.display = 'none';
        setupScreen.style.display = 'flex';
    }
});

// Generazione delle chiavi crittografiche
async function inizializzaProfilo() {
    try {
        const btn = setupScreen.querySelector('button');
        btn.innerText = "GENESI PROTOCOLLO...";
        btn.disabled = true;

        // Genera coppia di chiavi asimmetriche
        const coppiaChiavi = await window.crypto.subtle.generateKey(
            {
                name: "ECDH",
                namedCurve: "P-256"
            },
            true,
            ["deriveKey", "deriveBits"]
        );

        miaChiavePrivata = coppiaChiavi.privateKey;

        // Esporta chiave pubblica
        const exportPubblica = await window.crypto.subtle.exportKey("raw", coppiaChiavi.publicKey);
        miaChiavePubblicaStringa = arrayBufferToHex(exportPubblica);

        // Salva l'identità pubblica nel browser
        localStorage.setItem('stait_chiave_pubblica', miaChiavePubblicaStringa);

        mostraApp();

    } catch (error) {
        console.error("Errore di inizializzazione:", error);
        alert("Errore hardware nella generazione delle chiavi.");
    }
}

// Mostra l'interfaccia oscura
function mostraApp() {
    setupScreen.style.display = 'none';
    appScreen.style.display = 'flex';

    // Formatta l'ID per renderlo ordinato e in linea con lo stile
    myIdText.innerText = "STAIT_ID: " + miaChiavePubblicaStringa.substring(0, 16).toUpperCase() + "...";
    myIdText.title = miaChiavePubblicaStringa;

    // Genera il QR Code
    qrcodeContainer.innerHTML = "";
    new QRCode(qrcodeContainer, {
        text: miaChiavePubblicaStringa,
        width: 120,
        height: 120,
        colorDark : "#050505",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.M
    });
}

// Funzione placeholder per aggiungere un contatto
function aggiungiContatto() {
    const idAmico = prompt("Inserisci la Chiave Pubblica (ID) del Peer distante:");
    if(idAmico) {
        alert("Identità agganciata. Ricerca del Peer nella rete distribuita in corso...");
    }
}

// Gestione dell'invio dei messaggi a schermo
function inviaMessaggio() {
    const input = document.getElementById('message-input');
    const container = document.getElementById('messages-box');
    
    if(input.value.trim() === "") return;

    // Crea la bolla del messaggio a schermo (Stile inviato)
    const row = document.createElement('div');
    row.className = 'message-row sent';
    row.innerHTML = `<div class="bubble">${input.value}</div>`;
    
    container.appendChild(row);
    input.value = "";
    
    // Auto-scroll in basso
    container.scrollTop = container.scrollHeight;
}

// Utilità: converte buffer in testo esadecimale
function arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}