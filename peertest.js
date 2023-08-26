var peer = new Peer();
const params = new URLSearchParams(window.location.search)
const q = params.get("host")
var isHost = null
var conn = null
if (q == null) {
    isHost = true
} else {
    conn = peer.connect(q);
    conn.send("hi")
    console.log(q)
    console.log(conn)
    isHost = false
}
peer.on('open', function(id) {
	console.log('My peer ID is: ' + id);
}); 

document.addEventListener("DOMContentLoaded", () => {
    peer.on('open', function(id) {
        console.log('My peer ID is: ' + id);

    peer.on('connection', function(c) { 
        conn = c
        console.log(conn)
        conn.on('data', function(data) {
            console.log('Received', data);
            document.getElementById("messageText").textContent = data
        });
        alert("someone joined!")
    });
    
    document.getElementById("button").onclick = () => {
        console.log(conn)
        conn.send(document.getElementById("messageToSend").textContent)
    }

    });
    
})
